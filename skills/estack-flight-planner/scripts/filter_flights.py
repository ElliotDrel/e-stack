"""
Filter and rank flights from saved SerpAPI JSON files.

OPTIONAL CONVENIENCE, not a required stage. This covers the common shape of a
request -- a budget, some airlines, nonstop, a couple of time windows -- so you
don't rewrite it every run. If the user wants something this doesn't express
(fare class, layover airport, red-eyes only, arrive-before-X, a bespoke
tradeoff between price and departure time), do NOT contort the request into
these flags. Run load_flights.py instead and write the pass you actually need;
its output is the same shape this produces. Parsing is the part worth sharing,
not the judgment.

Reads JSON files written by fetch_flights.py, applies filters (price, time
window, route, airlines, nonstop), ranks results, and outputs a JSON list to
stdout. Filters can be marked "soft" via --soft-filters — soft filters include
non-matching flights but flag them with `soft_filter_violations` and rank them
lower.

Ranking is a single dollar-equivalent `rank_score`: the real price plus a
per-violation penalty for each soft preference the flight misses (see
DEFAULT_PENALTIES, override with --soft-penalties). This keeps a soft preference
a thumb on the scale — a $400 flight that matches every preference should not
outrank a $189 flight that misses one. `rank_explanation` shows the arithmetic.

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
import json
import sys
import tempfile
from pathlib import Path

from load_flights import load as _load   # one parser, shared with load_flights.py


SOFT_FILTER_NAMES = {"max-price", "time-priority", "airlines", "nonstop", "route", "duration"}

# What each soft-filter violation is "worth" in dollars when ranking. A soft
# preference is a thumb on the scale, not a veto: without this, one violated
# soft filter would push a $189 flight below a $400 one that happens to match
# every preference. max-price defaults to 0 because the price is already the
# thing being scored -- counting it again would double-charge going over budget.
DEFAULT_PENALTIES = {
    "max-price": 0,
    "route": 50,
    "airlines": 40,
    "nonstop": 60,
    "time-priority": 30,
    "duration": 40,
}
# Cost of dropping one rung down the time-priority band list (band 0 is best).
DEFAULT_BAND_STEP = 15


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
    """Delegate to load_flights.py so there is exactly one SerpAPI parser."""
    flights, _meta = _load(json_dir)
    return flights


def violations_for(f, max_price, bands, origins, dests, airlines, nonstop_required,
                   max_duration=None):
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
    if airlines:
        # An itinerary only counts as "on a preferred airline" if every leg is.
        codes = f.get("airline_iatas") or (
            [f["airline_iata"]] if f.get("airline_iata") else [])
        if codes and not all(c in airlines for c in codes):
            v.append("airlines")
    if nonstop_required and f.get("stops", 0) > 0:
        v.append("nonstop")
    if max_duration is not None and (f.get("duration_min") or 0) > max_duration:
        v.append("duration")
    return v


def parse_penalties(csv: str):
    """Merge "NAME:USD,NAME:USD" overrides onto DEFAULT_PENALTIES."""
    out = dict(DEFAULT_PENALTIES)
    for item in (csv or "").split(","):
        item = item.strip()
        if not item:
            continue
        if ":" not in item:
            print(f"ERROR: bad --soft-penalties entry {item!r} - expected NAME:USD",
                  file=sys.stderr)
            sys.exit(2)
        k, v = item.split(":", 1)
        k = k.strip()
        if k not in SOFT_FILTER_NAMES:
            print(f"ERROR: unknown --soft-penalties name {k!r}. "
                  f"Valid: {sorted(SOFT_FILTER_NAMES)}", file=sys.stderr)
            sys.exit(2)
        try:
            out[k] = float(v.strip())
        except ValueError:
            print(f"ERROR: --soft-penalties {k!r} value {v!r} is not a number",
                  file=sys.stderr)
            sys.exit(2)
    return out


def rank_score(f, violations, penalties, band_step):
    """Dollar-equivalent ranking score: real price plus soft-preference penalties.

    Returns (score, explanation_list). A flight with no price sorts last.
    """
    price = f.get("price")
    if price is None:
        return float("inf"), ["no price available"]
    score = float(price)
    why = []
    for name in violations:
        p = penalties.get(name, 0)
        if p:
            score += p
            why.append(f"{name} +${p:g}")
    band = f.get("priority_band", 0)
    if band and band_step:
        score += band * band_step
        why.append(f"time band {band} +${band * band_step:g}")
    return score, why


def priority_band(f, bands):
    """Return index of first band the departure time falls into, or len(bands) if outside all."""
    if not bands or not f["departs"]:
        return 0
    for i, (lo, hi) in enumerate(bands):
        if in_band(f["departs"], lo, hi):
            return i
    return len(bands)


def cluster_analysis(flights, max_price, bands, origins, dests, airlines, nonstop_required,
                     max_duration=None):
    """Report which constraint eliminated which flight counts + price distribution."""
    prices = sorted({f["price"] for f in flights if f["price"] is not None})

    # Per-constraint impact: how many would be eliminated by this filter alone
    constraint_impact = {}
    all_violations = [
        violations_for(f, max_price, bands, origins, dests, airlines, nonstop_required,
                       max_duration)
        for f in flights
    ]
    for name in ("route", "max-price", "time-priority", "airlines", "nonstop", "duration"):
        constraint_impact[name] = {
            "eliminated": sum(1 for v in all_violations if name in v),
            "of_total": len(flights),
        }

    # All-filters combined: how many pass everything
    passing_all = sum(1 for v in all_violations if not v)

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
            "max_duration_min": max_duration,
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
    p.add_argument("--max-duration-min", type=int, default=None,
                   help="Max total door-to-door itinerary minutes. Omit for no limit.")
    p.add_argument("--soft-filters", default="",
                   help="Comma-separated filter names treated as soft (rank, don't exclude). "
                        "Valid: max-price, time-priority, airlines, nonstop, route, duration.")
    p.add_argument("--soft-penalties", default="",
                   help='Comma-separated "NAME:USD" overrides for what a soft violation '
                        'costs in the ranking (e.g. "airlines:80,nonstop:120"). '
                        f"Defaults: {DEFAULT_PENALTIES}")
    p.add_argument("--band-step", type=float, default=DEFAULT_BAND_STEP,
                   help="Dollar cost of each rung down the time-priority band list. "
                        f"Default {DEFAULT_BAND_STEP}.")
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
    penalties = parse_penalties(args.soft_penalties)
    bad_soft = soft - SOFT_FILTER_NAMES
    if bad_soft:
        print(f"ERROR: unknown --soft-filters values: {sorted(bad_soft)}. "
              f"Valid: {sorted(SOFT_FILTER_NAMES)}", file=sys.stderr)
        return 2

    if args.cluster_analysis:
        report = cluster_analysis(flights, args.max_price, bands, origins, dests,
                                  airlines, args.nonstop, args.max_duration_min)
        print(json.dumps(report, indent=2))
        return 0

    out = []
    for f in flights:
        v = violations_for(f, args.max_price, bands, origins, dests, airlines, args.nonstop,
                           args.max_duration_min)
        hard_v = [name for name in v if name not in soft]
        if hard_v:
            continue  # excluded by a hard filter
        f["priority_band"] = priority_band(f, bands)
        f["soft_filter_violations"] = v  # may be empty
        score, why = rank_score(f, v, penalties, args.band_step)
        f["rank_score"] = None if score == float("inf") else round(score, 2)
        f["rank_explanation"] = why
        out.append(f)

    # Rank on one dollar-equivalent scale so a soft preference is a thumb on the
    # scale rather than a veto.
    out.sort(key=lambda f: (
        f["rank_score"] if f["rank_score"] is not None else 10**9,
        f.get("departs", ""),
    ))
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
