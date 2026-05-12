"""
Pair filtered flights with the best shuttle option and output a ranked
markdown plans table.

Inputs:
  --flights-json    JSON list from filter_flights.py (file path or "-" for stdin)
  --shuttles-json   JSON dict with "shuttles" array (see references/shuttle_schedules.md)
  --shuttle-costs   Comma-separated AIRPORT:USD list (e.g. "ORD:60,IND:30"). Each
                    airport in your shuttle config must be listed here.
  --tz-offsets      Comma-separated AIRPORT:OFFSET_MIN list relative to home/origin
                    timezone (e.g. "ORD:-60,MDW:-60"). Airports omitted assume 0
                    (same timezone as the shuttle's `departs_local` zone).
  --min-buffer-min  Min minutes between shuttle arrival at airport and flight
                    departure. Default 90 (1.5h).
  --max-wait-min    Max acceptable wait at airport. Default 240 (4h).

Output: markdown table on stdout, one row per flight, sorted by viability
then total cost then departure time.

Timezones: shuttle entries record departure time in the home timezone
(`departs_local`) and arrival time in the airport's local timezone
(`arrives_local`). Pass --tz-offsets so this script can compare them on a
single timeline for buffer math.
"""
import argparse
import json
import sys


def parse_kv_int(csv: str, value_label: str):
    """Parse "KEY:VAL,KEY:VAL" into a dict[str,int]."""
    out = {}
    if not csv:
        return out
    for item in csv.split(","):
        item = item.strip()
        if not item:
            continue
        if ":" not in item:
            print(f"ERROR: bad {value_label} entry {item!r} — expected KEY:VAL", file=sys.stderr)
            sys.exit(2)
        k, v = item.split(":", 1)
        try:
            out[k.strip()] = int(v.strip())
        except ValueError:
            print(f"ERROR: {value_label} {k!r} value {v!r} is not an int", file=sys.stderr)
            sys.exit(2)
    return out


def hm_to_min(hm: str) -> int:
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


def viability(buffer_min: int, min_buffer: int, max_wait: int) -> str:
    if buffer_min < min_buffer:
        return "TOO_TIGHT"
    if buffer_min > max_wait:
        return "LONG_WAIT"
    if buffer_min < min_buffer + 30:
        return "TIGHT"
    if buffer_min <= min_buffer + 90:
        return "COMFORTABLE"
    return "GENEROUS"


VIABILITY_RANK = {"COMFORTABLE": 0, "GENEROUS": 1, "TIGHT": 2, "LONG_WAIT": 3, "TOO_TIGHT": 4}
VIABILITY_NOTE = {
    "COMFORTABLE": "Comfortable buffer",
    "GENEROUS": "Comfortable, longer wait",
    "TIGHT": "Tight - runs on shuttle being on time",
    "LONG_WAIT": "Long airport wait",
    "TOO_TIGHT": "Too tight - not viable",
}


def to_home_min(time_local: str, airport: str, tz_offsets: dict) -> int:
    """Convert a local-airport HH:MM into home-timezone-equivalent minutes."""
    return hm_to_min(time_local) - tz_offsets.get(airport, 0)


def best_shuttle_for_flight(flight, shuttles, min_buffer, max_wait, tz_offsets):
    """Pick the shuttle with the best viability score for this flight."""
    dep_airport = flight["from"]
    flight_dep_min = to_home_min(flight["departs"], dep_airport, tz_offsets)
    candidates = []
    for s in shuttles:
        if s.get("to") != dep_airport:
            continue
        arr = s.get("arrives_local", "")
        if not arr:
            continue
        shuttle_arr_min = to_home_min(arr, dep_airport, tz_offsets)
        buffer = flight_dep_min - shuttle_arr_min
        if buffer < 0:
            continue  # shuttle arrives after flight leaves
        v = viability(buffer, min_buffer, max_wait)
        candidates.append((VIABILITY_RANK[v], buffer, v, s))
    if not candidates:
        return None, None, None
    candidates.sort(key=lambda c: c[0])
    _, buf, v, s = candidates[0]
    return s, buf, v


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--flights-json", required=True, help="Path to filter_flights.py output, or '-' for stdin")
    p.add_argument("--shuttles-json", required=True)
    p.add_argument("--shuttle-costs", default="",
                   help='Comma-separated "AIRPORT:USD" pairs (e.g. "ORD:60,IND:30")')
    p.add_argument("--tz-offsets", default="",
                   help='Comma-separated "AIRPORT:OFFSET_MIN" pairs relative to home tz')
    p.add_argument("--min-buffer-min", type=int, default=90)
    p.add_argument("--max-wait-min", type=int, default=240)
    args = p.parse_args()

    shuttle_costs = parse_kv_int(args.shuttle_costs, "--shuttle-costs")
    tz_offsets = parse_kv_int(args.tz_offsets, "--tz-offsets")

    if args.flights_json == "-":
        flights = json.load(sys.stdin)
    else:
        with open(args.flights_json, encoding="utf-8") as f:
            flights = json.load(f)

    with open(args.shuttles_json, encoding="utf-8") as f:
        shuttles = json.load(f).get("shuttles", [])

    rows = []
    for fl in flights:
        s, buf, v = best_shuttle_for_flight(
            fl, shuttles, args.min_buffer_min, args.max_wait_min, tz_offsets,
        )
        if s is None:
            continue
        shuttle_cost = shuttle_costs.get(fl["from"], 0)
        total = (fl["price"] or 0) + shuttle_cost
        rows.append({
            "flight": fl, "shuttle": s, "buffer_min": buf, "viability": v,
            "shuttle_cost": shuttle_cost, "total": total,
        })

    # Sort: viability tier, then priority band, then total cost, then departure time
    rows.sort(key=lambda r: (
        VIABILITY_RANK[r["viability"]],
        r.get("flight", {}).get("priority_band", 0),
        r["total"],
        r["flight"]["departs"],
    ))

    if not rows:
        print("(no viable flight+shuttle pairings)")
        return 0

    print("| # | Date | Flight | From | To | Departs | Arrives | Shuttle | Shuttle Departs | Buffer | Flight $ | Shuttle $ | **Total** | Notes |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for i, r in enumerate(rows, 1):
        f = r["flight"]; s = r["shuttle"]
        depart_label = s.get("departs_local") or s.get("departs_et") or "?"
        print(
            f"| {i} | {f['date']} | {f['flight']} | {f['from']} | {f['to']} | "
            f"{f['departs']} | {f['arrives']} | {s.get('company','?')} | "
            f"{depart_label} | {r['buffer_min']} min | "
            f"${f['price']} | ${r['shuttle_cost']} | **${r['total']}** | "
            f"{VIABILITY_NOTE[r['viability']]} |"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
