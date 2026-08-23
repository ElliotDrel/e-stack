"""
Normalize saved SerpAPI Google Flights responses into one clean JSON array.

This script collects data. It does not filter, rank, or decide anything.

That split is deliberate. Parsing SerpAPI's nested shape is repetitive, happens
on every single run, and is expensive to get subtly wrong (arrival time comes
from the LAST leg, the delay flag lives on a leg rather than the itinerary, a
"UA" itinerary can have an AA second leg). Deciding which flights are good is
one-off judgment that depends on what the user actually asked for this time --
so that part is yours. Load with this, then write whatever filter or ranking
pass the request calls for.

Every field SerpAPI returns is preserved, including per-leg detail, layovers,
delay and overnight flags, legroom, aircraft, operating carrier, carbon
figures, booking tokens, and the route's price insights.

Usage:
    python load_flights.py --json-dir /tmp/estack-flight-planner
    python load_flights.py --json-dir <dir> --with-meta          # + price insights
    python load_flights.py --json-dir <dir> --format table       # quick eyeball
    python load_flights.py --json-dir <dir> --format csv > flights.csv

The default JSON output is a flat array, which is exactly what pair_shuttles.py
expects on --flights-json.

Top-level fields on each itinerary:

    date from to price currency stops duration_min
    departs arrives departs_full arrives_full overnight
    flight airline airline_iata airline_iatas operated_by
    aircraft delayed travel_class legroom
    layovers[] legs[] extensions carbon booking_token result_group

`legs[]` carries the same detail per segment, so anything the summary flattens
is still reachable.
"""
import argparse
import csv
import glob
import io
import json
import sys
import tempfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from party import (parse_party, party_label, party_seats,  # noqa: E402
                   party_token)


def _dt(s):
    """Parse SerpAPI's "YYYY-MM-DD HH:MM" into a datetime, or None."""
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime((s or "").strip(), fmt)
        except ValueError:
            continue
    return None


def parse_leg(lg: dict) -> dict:
    dep, arr = lg.get("departure_airport", {}), lg.get("arrival_airport", {})
    number = lg.get("flight_number", "") or ""
    return {
        "from": dep.get("id", ""),
        "from_name": dep.get("name", ""),
        "to": arr.get("id", ""),
        "to_name": arr.get("name", ""),
        "departs_full": dep.get("time", ""),
        "arrives_full": arr.get("time", ""),
        "departs": (dep.get("time") or "")[-5:],
        "arrives": (arr.get("time") or "")[-5:],
        "flight": number,
        "airline_iata": number.split()[0] if number.split() else "",
        "airline": lg.get("airline", ""),
        "operated_by": lg.get("plane_and_crew_by", ""),
        "aircraft": lg.get("airplane", ""),
        "duration_min": lg.get("duration"),
        "travel_class": lg.get("travel_class", ""),
        "legroom": lg.get("legroom", ""),
        "delayed": bool(lg.get("often_delayed_by_over_30_min")),
        "overnight": bool(lg.get("overnight")),
        "extensions": lg.get("extensions", []),
    }


def parse_filename(stem: str):
    """Split "IND+ORD_EWR_2026-11-24_p2a1c" into (dep, arr, date, party).
    A file written before the party token existed is read as a single adult, so
    old temp dirs keep working."""
    parts = stem.split("_")
    if len(parts) < 3:
        return None
    party = parse_party("1a")
    if len(parts) > 3 and parts[-1].lower().startswith("p"):
        try:
            party = parse_party(parts[-1][1:])
            parts = parts[:-1]
        except ValueError:
            pass          # not a party token after all, so it belongs to the date
    dep, arr = parts[0], parts[1]
    date = "_".join(parts[2:])
    return dep, arr, date, party


def parse_group(fg: dict, dep: str, arr: str, date: str, result_group: str, party: dict = None):
    """Turn one SerpAPI flight group into a normalized itinerary, or None."""
    raw_legs = fg.get("flights", [])
    if not raw_legs:
        return None
    legs = [parse_leg(lg) for lg in raw_legs]
    first, last = legs[0], legs[-1]

    iatas = []
    for lg in legs:
        if lg["airline_iata"] and lg["airline_iata"] not in iatas:
            iatas.append(lg["airline_iata"])
    airlines = list(dict.fromkeys(lg["airline"] for lg in legs if lg["airline"]))
    operators = list(dict.fromkeys(lg["operated_by"] for lg in legs if lg["operated_by"]))

    dep_dt, arr_dt = _dt(first["departs_full"]), _dt(last["arrives_full"])
    crosses_midnight = bool(
        dep_dt and arr_dt and arr_dt.date() != dep_dt.date()
    ) or any(lg["overnight"] for lg in legs)

    carbon = fg.get("carbon_emissions") or {}

    party = party or parse_party("1a")
    return {
        # --- what most passes key off ---
        "date": date,
        "from": first["from"] or dep,
        "to": last["to"] or arr,
        # SerpAPI's price is the PARTY TOTAL, never a per-passenger fare. A
        # 2-adult search reads roughly double for the same seat, so any
        # comparison across party sizes has to use price_per_seat.
        "price": fg.get("price"),
        "party": dict(party),
        "party_token": party_token(party),
        "party_label": party_label(party),
        "seats": party_seats(party),
        "price_per_seat": (round(fg["price"] / party_seats(party), 2)
                           if fg.get("price") is not None and party_seats(party)
                           else None),
        "currency": "USD",
        "stops": max(0, len(legs) - 1),
        "duration_min": fg.get("total_duration"),
        "departs": first["departs"],
        "arrives": last["arrives"],
        "departs_full": first["departs_full"],
        "arrives_full": last["arrives_full"],
        "overnight": crosses_midnight,
        # --- carrier ---
        "flight": " / ".join(lg["flight"] for lg in legs if lg["flight"]),
        "airline": " / ".join(airlines),
        "airline_iata": iatas[0] if iatas else "",
        "airline_iatas": iatas,
        "operated_by": " / ".join(operators),
        # --- comfort and reliability ---
        "aircraft": " / ".join(dict.fromkeys(lg["aircraft"] for lg in legs if lg["aircraft"])),
        "delayed": any(lg["delayed"] for lg in legs),
        "travel_class": first["travel_class"],
        "legroom": " / ".join(dict.fromkeys(lg["legroom"] for lg in legs if lg["legroom"])),
        # --- connections ---
        "layovers": [
            {"airport": lo.get("id", ""), "name": lo.get("name", ""),
             "duration_min": lo.get("duration"), "overnight": bool(lo.get("overnight"))}
            for lo in fg.get("layovers", [])
        ],
        "layover_min": sum(lo.get("duration") or 0 for lo in fg.get("layovers", [])),
        # --- everything else, kept rather than dropped ---
        "legs": legs,
        "extensions": fg.get("extensions", []),
        "carbon": {
            "this_flight_g": carbon.get("this_flight"),
            "typical_for_route_g": carbon.get("typical_for_this_route"),
            "difference_percent": carbon.get("difference_percent"),
        } if carbon else None,
        "booking_token": fg.get("booking_token"),
        "result_group": result_group,   # "best" or "other", SerpAPI's own bucketing
        "searched_route": f"{dep}-{arr}",
        # Same physical itinerary across party sizes. Join on this to compare
        # a 1-seat and a 2-seat fetch row by row.
        "fingerprint": "|".join([
            date,
            " / ".join(lg["flight"] for lg in legs if lg["flight"]),
            first["departs_full"] or "",
        ]),
    }


def load(json_dir: Path):
    """Return (itineraries, per-route metadata). Never filters anything out."""
    flights, meta = [], []
    for fname in sorted(glob.glob(str(json_dir / "*.json"))):
        parsed = parse_filename(Path(fname).stem)
        if not parsed:
            continue
        dep, arr, date, party = parsed
        try:
            with open(fname, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"WARNING: skipping unreadable {Path(fname).name}: {e}", file=sys.stderr)
            continue

        count = 0
        for group_name, key in (("best", "best_flights"), ("other", "other_flights")):
            for fg in data.get(key, []):
                item = parse_group(fg, dep, arr, date, group_name, party)
                if item:
                    flights.append(item)
                    count += 1

        pi = data.get("price_insights") or {}
        meta.append({
            "route": f"{dep}-{arr}",
            "date": date,
            "party": party_token(party),
            "itineraries": count,
            "lowest_price": pi.get("lowest_price"),
            "price_level": pi.get("price_level"),
            "typical_price_range": pi.get("typical_price_range"),
        })
    return flights, meta


def as_table(flights):
    out = io.StringIO()
    multi = len({f.get("party_token") for f in flights}) > 1
    cols = ["date", "route", "flight", "airline", "departs", "arrives",
            "stops", "dur", "price"]
    if multi:
        cols += ["party", "$/seat"]
    cols += ["flags"]
    rows = []
    for f in flights:
        flags = []
        if f["delayed"]:
            flags.append("often-delayed")
        if f["overnight"]:
            flags.append("overnight")
        if f["layover_min"]:
            flags.append(f"{f['layover_min']}m layover")
        row = [
            f["date"], f"{f['from']}-{f['to']}", f["flight"], f["airline"],
            f["departs"], f["arrives"], str(f["stops"]),
            f"{(f['duration_min'] or 0)//60}h{(f['duration_min'] or 0)%60:02d}",
            f"${f['price']}" if f["price"] is not None else "?",
        ]
        if multi:
            row += [
                f.get("party_token", "1a"),
                f"${f['price_per_seat']:.0f}" if f.get("price_per_seat") is not None else "?",
            ]
        row.append(", ".join(flags))
        rows.append(row)
    widths = [max(len(str(r[i])) for r in ([cols] + rows)) for i in range(len(cols))]
    for r in [cols] + rows:
        out.write("  ".join(str(c).ljust(w) for c, w in zip(r, widths)).rstrip() + "\n")
    return out.getvalue()


def as_csv(flights):
    out = io.StringIO()
    cols = ["date", "from", "to", "flight", "airline", "airline_iatas", "departs",
            "arrives", "stops", "duration_min", "layover_min", "price",
            "party_token", "seats", "price_per_seat", "delayed",
            "overnight", "aircraft", "legroom", "result_group"]
    w = csv.writer(out, lineterminator="\n")
    w.writerow(cols)
    for f in flights:
        w.writerow([
            "|".join(f[c]) if c == "airline_iatas" else f.get(c, "") for c in cols
        ])
    return out.getvalue()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    default_dir = Path(tempfile.gettempdir()) / "estack-flight-planner"
    p.add_argument("--json-dir", default=str(default_dir))
    p.add_argument("--format", choices=("json", "table", "csv"), default="json")
    p.add_argument("--with-meta", action="store_true",
                   help="Wrap JSON output as {flights, routes} where routes carries "
                        "SerpAPI's price insights per route/date.")
    args = p.parse_args()

    json_dir = Path(args.json_dir)
    if not json_dir.exists():
        print(f"ERROR: dir not found: {json_dir}", file=sys.stderr)
        return 2

    flights, meta = load(json_dir)
    if not flights:
        print(f"ERROR: no flights parsed from {json_dir}", file=sys.stderr)
        return 2

    print(f"loaded {len(flights)} itineraries from {len(meta)} route-days", file=sys.stderr)

    if args.format == "table":
        sys.stdout.write(as_table(flights))
    elif args.format == "csv":
        sys.stdout.write(as_csv(flights))
    elif args.with_meta:
        print(json.dumps({"flights": flights, "routes": meta}, indent=2))
    else:
        print(json.dumps(flights, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
