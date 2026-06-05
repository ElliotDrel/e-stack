"""
Filter and rank flights from saved SerpAPI JSON files.

Reads JSON files written by fetch_flights.py, applies filters (price, time
window, route, airlines, nonstop), ranks results, and outputs a JSON list to
stdout. Filters can be marked "soft" via --soft-filters — soft filters include
non-matching flights but flag them with `soft_filter_violations` and rank them
lower.

With --cluster-analysis, prints a constraint-impact report instead of
filtering: shows which constraint(s) eliminated which flight counts, plus a
price distribution. The skill uses this to propose specific relaxations when
hard filters return zero results.

Usage:
    python filter_flights.py --json-dir /tmp/estack-flight-planner/ --max-price 200 --from IND --to EWR
    python filter_flights.py --json-dir /tmp/estack-flight-planner/ --max-price 200 \\
        --soft-filters max-price,time-priority
    python filter_flights.py --json-dir /tmp/estack-flight-planner/ --cluster-analysis

All filter args (--max-price, --time-priority, --from, --to, --airlines, --nonstop)
are required for normal filter mode (no defaults — caller passes config values).
Cluster-analysis mode echoes back impact of each provided filter.
"""
import argparse
import glob
import json
import sys
import tempfile
from pathlib import Path


SOFT_FILTER_NAMES = {"max-price", "time-priority", "airlines", "nonstop", "route"}


def parse_band(b: str):
    a, c = b.split("-")
    return a.strip(), c.strip()


def in_band(t: str, lo: str, hi: str) -> bool:
    return lo <= t <= hi


def parse_set(csv: str):
    if not csv:
        return set()
    return {x.strip() for x in csv.split(",") if x.strip()}


def parse_bands(csv: str):
    if not csv:
        return []
    return [parse_band(b) for b in csv.split(",") if b.strip()]


def load_flights(json_dir: Path):
    flights = []
    for fname in sorted(glob.glob(str(json_dir / "*.json"))):
        parts = Path(fname).stem.split("_")
        if len(parts) < 3:
            continue
        dep, arr = parts[0], parts[1]
        date = "_".join(parts[2:])
        try:
            with open(fname, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        for fg in data.get("best_flights", []) + data.get("other_flights", []):
            legs = fg.get("flights", [])
            if not legs:
                continue
            leg = legs[0]
            last_leg = legs[-1]
            dep_dt = leg.get("departure_airport", {}).get("time", "")
            arr_dt = last_leg.get("arrival_airport", {}).get("time", "")
            airline_code = leg.get("airline", "") or ""
            airline_iata = (leg.get("airline_logo", "") or "")[-6:-4] if "airline_logo" in leg else ""
            flights.append({
                "date": date, "from": dep, "to": arr,
                "flight": leg.get("flight_number", ""),
                "airline": airline_code,
                "airline_iata": (leg.get("flight_number", "") or "").split()[0] if leg.get("flight_number") else "",
                "departs": dep_dt[-5:] if dep_dt else "",
                "arrives": arr_dt[-5:] if arr_dt else "",
                "departs_full": dep_dt, "arrives_full": arr_dt,
                "price": fg.get("price"),
                "duration_min": fg.get("total_duration", 0),
                "aircraft": leg.get("airplane", ""),
                "delayed": fg.get("often_delayed_by_over_30_min", False),
                "stops": max(0, len(legs) - 1),
            })
    return flights


def violations_for(f, max_price, bands, origins, dests, airlines, nonstop_required):
    """Return a list of filter names this flight violates, or [] if it passes all."""
    v = []
    if origins and f["from"] not in origins:
        v.append("route")
    if dests and f["to"] not in dests:
        if "route" not in v:
            v.append("route")
    if max_price is not None and (f["price"] is None or f["price"] > max_price):
        v.append("max-price")
    if bands:
        if not f["departs"]:
            v.append("time-priority")
        else:
            in_any = any(in_band(f["departs"], lo, hi) for lo, hi in bands)
            if not in_any:
                v.append("time-priority")
    if airlines and f.get("airline_iata") and f["airline_iata"] not in airlines:
        v.append("airlines")
    if nonstop_required and f.get("stops", 0) > 0:
        v.append("nonstop")
    return v


def priority_band(f, bands):
    """Return index of first band the departure time falls into, or len(bands) if outside all."""
    if not bands or not f["departs"]:
        return 0
    for i, (lo, hi) in enumerate(bands):
        if in_band(f["departs"], lo, hi):
            return i
    return len(bands)


def cluster_analysis(flights, max_price, bands, origins, dests, airlines, nonstop_required):
    """Report which constraint eliminated which flight counts + price distribution."""
    prices = sorted({f["price"] for f in flights if f["price"] is not None})

    # Per-constraint impact: how many would be eliminated by this filter alone
    constraint_impact = {}
    for name in ("route", "max-price", "time-priority", "airlines", "nonstop"):
        eliminated = 0
        for f in flights:
            v = violations_for(f, max_price, bands, origins, dests, airlines, nonstop_required)
            if name in v:
                eliminated += 1
        constraint_impact[name] = {
            "eliminated": eliminated,
            "of_total": len(flights),
        }

    # All-filters combined: how many pass everything
    passing_all = sum(
        1 for f in flights
        if not violations_for(f, max_price, bands, origins, dests, airlines, nonstop_required)
    )

    # Price distribution + natural gaps
    gaps = []
    if prices:
        for i in range(1, len(prices)):
            gap = prices[i] - prices[i - 1]
            if gap >= 20:
                gaps.append({"after": prices[i - 1], "before": prices[i], "gap": gap})

    recommended_budgets = []
    if prices:
        if gaps:
            recommended_budgets.append(gaps[0]["after"])
            if len(gaps) > 1:
                recommended_budgets.append(gaps[1]["after"])
        else:
            recommended_budgets.append(prices[len(prices) // 2])

    return {
        "total_flights": len(flights),
        "passing_all_filters": passing_all,
        "constraint_impact": constraint_impact,
        "price_distribution": {
            "min": prices[0] if prices else None,
            "max": prices[-1] if prices else None,
            "unique_prices": len(prices),
            "natural_gaps": gaps[:5],
            "recommended_budgets": recommended_budgets,
        },
        "applied_filters": {
            "max_price": max_price,
            "time_priority_bands": [f"{a}-{b}" for a, b in bands],
            "origins": sorted(origins) if origins else None,
            "destinations": sorted(dests) if dests else None,
            "airlines": sorted(airlines) if airlines else None,
            "nonstop_required": nonstop_required,
        },
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    default_dir = Path(tempfile.gettempdir()) / "estack-flight-planner"
    p.add_argument("--json-dir", default=str(default_dir))
    p.add_argument("--max-price", type=int, default=None,
                   help="Max price in USD. Omit for no price filter.")
    p.add_argument("--time-priority", default="",
                   help="Comma-separated priority bands HH:MM-HH:MM (e.g. 11:00-14:00,14:00-22:00). Empty = no time filter.")
    p.add_argument("--from", dest="origins", default="",
                   help="Comma-separated origin IATA codes. Empty = any origin.")
    p.add_argument("--to", dest="dests", default="",
                   help="Comma-separated destination IATA codes. Empty = any destination.")
    p.add_argument("--airlines", default="",
                   help="Comma-separated airline IATA codes (e.g. UA,DL). Empty = any airline.")
    p.add_argument("--nonstop", action="store_true",
                   help="Require nonstop only (stops==0).")
    p.add_argument("--soft-filters", default="",
                   help="Comma-separated filter names treated as soft (rank, don't exclude). "
                        "Valid: max-price, time-priority, airlines, nonstop, route.")
    p.add_argument("--cluster-analysis", action="store_true",
                   help="Print constraint-impact + price distribution report instead of filtering.")
    args = p.parse_args()

    json_dir = Path(args.json_dir)
    if not json_dir.exists():
        print(f"ERROR: dir not found: {json_dir}", file=sys.stderr)
        return 2

    flights = load_flights(json_dir)
    if not flights:
        print(f"ERROR: no flights parsed from {json_dir}", file=sys.stderr)
        return 2

    origins = parse_set(args.origins)
    dests = parse_set(args.dests)
    airlines = parse_set(args.airlines)
    bands = parse_bands(args.time_priority)
    soft = parse_set(args.soft_filters)
    bad_soft = soft - SOFT_FILTER_NAMES
    if bad_soft:
        print(f"ERROR: unknown --soft-filters values: {sorted(bad_soft)}. "
              f"Valid: {sorted(SOFT_FILTER_NAMES)}", file=sys.stderr)
        return 2

    if args.cluster_analysis:
        report = cluster_analysis(flights, args.max_price, bands, origins, dests,
                                  airlines, args.nonstop)
        print(json.dumps(report, indent=2))
        return 0

    out = []
    for f in flights:
        v = violations_for(f, args.max_price, bands, origins, dests, airlines, args.nonstop)
        hard_v = [name for name in v if name not in soft]
        if hard_v:
            continue  # excluded by a hard filter
        f["priority_band"] = priority_band(f, bands)
        f["soft_filter_violations"] = v  # may be empty
        out.append(f)

    # Sort: # of soft violations asc, then priority band, then price, then departs
    out.sort(key=lambda f: (
        len(f.get("soft_filter_violations", [])),
        f.get("priority_band", 0),
        f.get("price") if f.get("price") is not None else 10**9,
        f.get("departs", ""),
    ))
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
