"""
Pair filtered flights with ground-shuttle runs on either end of the trip and
output a ranked plans table.

Two shuttle legs are supported and can both apply to the same flight:

  pre-flight  (direction "to_airport")   home -> departure airport, must ARRIVE
                                         at least --min-buffer-min before the
                                         flight departs.
  post-flight (direction "from_airport") arrival airport -> home, must DEPART
                                         at least --min-connect-min after the
                                         flight lands.

Inputs:
  --flights-json      JSON list from filter_flights.py (file path or "-" for stdin)
  --shuttles-json     JSON dict with a "shuttles" array (see
                      references/shuttle_schedules.md)
  --shuttle-costs     Comma-separated AIRPORT:USD list (e.g. "ORD:60,IND:30").
                      Charged once per shuttle leg used.
  --legs              auto (default) | pre | post | both
                        auto - use whichever legs the shuttle data can serve
                        pre  - only pair a shuttle to the departure airport
                        post - only pair a shuttle from the arrival airport
                        both - require BOTH legs; drop flights missing either
  --min-buffer-min    Pre-flight floor: shuttle arrival -> flight departure. Default 90.
  --min-connect-min   Post-flight floor: flight arrival -> shuttle departure. Default 60.
  --max-wait-min      Max acceptable wait on either leg before it is labeled a
                      long wait. Default 240.
  --now               Optional ISO datetime ("2026-08-04T16:00") for the
                      reservation-cutoff check. Omit to skip the check.
  --reservation-lead-hours  Hours of notice the shuttle company requires. Default 0.
  --include-unpaired  Keep flights that have no viable shuttle, flagged in Notes.
  --format            markdown (default) | json

Ranking: rows sort on `plan_score` -- the flight's `rank_score` from
filter_flights.py (price plus soft-preference penalties) + real shuttle cost +
a dollar-equivalent penalty for an awkward connection. One scale, so a tight
connection or a missed preference costs what it's worth instead of trumping
price outright. The `Total` column stays real dollars.

Times: every shuttle time is local to the place the event happens -- a
"to_airport" run departs in home time and arrives in airport time; a
"from_airport" run departs in airport time and arrives in home time. Buffer math
only ever compares the airport-side shuttle time against the flight time, and
both are already in that airport's local zone, so no timezone conversion is
needed. Overnight runs are handled by testing the adjacent calendar day.
"""
import argparse
import json
import sys
from datetime import datetime, timedelta

DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

VIABILITY_RANK = {"COMFORTABLE": 0, "GENEROUS": 1, "TIGHT": 2, "LONG_WAIT": 3, "TOO_TIGHT": 4}
# Dollar-equivalent cost of an awkward connection, so plans rank on one scale
# alongside the flight's own rank_score. TOO_TIGHT is priced to sort last
# without being hidden.
VIABILITY_PENALTY = {"COMFORTABLE": 0, "GENEROUS": 10, "TIGHT": 25,
                     "LONG_WAIT": 45, "TOO_TIGHT": 1000}
# Stand-in score for an itinerary SerpAPI returned without a price. Large enough
# to sort last, finite so the result stays valid JSON.
UNPRICED = 10 ** 9
VIABILITY_NOTE = {
    "COMFORTABLE": "comfortable",
    "GENEROUS": "comfortable, longer wait",
    "TIGHT": "tight - runs on the shuttle being on time",
    "LONG_WAIT": "long wait",
    "TOO_TIGHT": "TOO TIGHT - under the buffer floor",
}


def parse_kv_int(csv: str, value_label: str):
    """Parse "KEY:VAL,KEY:VAL" into a dict[str, int]."""
    out = {}
    if not csv:
        return out
    for item in csv.split(","):
        item = item.strip()
        if not item:
            continue
        if ":" not in item:
            print(f"ERROR: bad {value_label} entry {item!r} - expected KEY:VAL", file=sys.stderr)
            sys.exit(2)
        k, v = item.split(":", 1)
        try:
            out[k.strip()] = int(v.strip())
        except ValueError:
            print(f"ERROR: {value_label} {k!r} value {v!r} is not an int", file=sys.stderr)
            sys.exit(2)
    return out


def looks_like_iata(token) -> bool:
    return isinstance(token, str) and len(token) == 3 and token.isalpha() and token.isupper()


def normalize_shuttle(s: dict, index: int):
    """Return a shuttle dict with airport/direction/departs/arrives resolved.

    Accepts the current schema (explicit `airport` + `direction`) and the
    older one (`from`/`to` labels where one side is an IATA code, and
    `departs_et` instead of `departs_local`).
    """
    out = dict(s)
    out["departs"] = s.get("departs_local") or s.get("departs_et") or ""
    out["arrives"] = s.get("arrives_local") or s.get("arrives_et") or ""

    airport = s.get("airport")
    direction = s.get("direction")

    if not airport or not direction:
        frm, to = s.get("from"), s.get("to")
        if looks_like_iata(to):
            airport, direction = airport or to, direction or "to_airport"
        elif looks_like_iata(frm):
            airport, direction = airport or frm, direction or "from_airport"

    if not airport or direction not in ("to_airport", "from_airport"):
        raise ValueError(
            f"shuttle #{index} cannot be resolved: needs an `airport` IATA code and a "
            f'`direction` of "to_airport" or "from_airport" '
            f"(got airport={airport!r}, direction={direction!r})"
        )

    out["airport"] = airport
    out["direction"] = direction
    return out


def runs_on(shuttle: dict, date_str: str) -> bool:
    """True if this shuttle operates on the given YYYY-MM-DD."""
    days = shuttle.get("days")
    if not days:
        return True
    weekday = DAY_NAMES[datetime.strptime(date_str, "%Y-%m-%d").weekday()]
    return any(str(d).strip().lower().startswith(weekday) for d in days)


def flight_dt(flight: dict, which: str):
    """Resolve a flight's departure/arrival as a datetime.

    Prefers the full "YYYY-MM-DD HH:MM" string; falls back to the flight's
    search date plus the HH:MM field.
    """
    full = flight.get(f"{which}_full") or ""
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(full.strip(), fmt)
        except ValueError:
            continue
    hm = flight.get(which) or ""
    date = flight.get("date") or ""
    try:
        return datetime.strptime(f"{date} {hm}", "%Y-%m-%d %H:%M")
    except ValueError:
        return None


def shuttle_dt_candidates(anchor: datetime, hm: str):
    """Datetimes for an HH:MM daily run near `anchor` (day before/of/after)."""
    try:
        h, m = (int(x) for x in hm.split(":"))
    except (ValueError, AttributeError):
        return []
    base = anchor.replace(hour=h, minute=m, second=0, microsecond=0)
    return [base + timedelta(days=d) for d in (-1, 0, 1)]


def trip_date(shuttle: dict, dt: datetime, leg: str) -> str:
    """The calendar date the shuttle run *departs* on, for day-of-week matching.

    For a "post" leg `dt` is already the departure. For a "pre" leg `dt` is the
    airport arrival, so a run whose departure clock time is later than its
    arrival clock time wrapped past midnight and departed the day before.
    """
    if leg == "post":
        return dt.strftime("%Y-%m-%d")
    departs, arrives = shuttle.get("departs", ""), shuttle.get("arrives", "")
    if departs and arrives and departs > arrives:
        return (dt - timedelta(days=1)).strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d")


def viability(buffer_min: int, floor_min: int, max_wait: int) -> str:
    if buffer_min < floor_min:
        return "TOO_TIGHT"
    if buffer_min > max_wait:
        return "LONG_WAIT"
    if buffer_min < floor_min + 30:
        return "TIGHT"
    if buffer_min <= floor_min + 90:
        return "COMFORTABLE"
    return "GENEROUS"


def best_pairing(flight, shuttles, leg, floor_min, max_wait, max_gap=720):
    """Best shuttle for one leg of one flight.

    leg is "pre" (shuttle to the departure airport) or "post" (shuttle from the
    arrival airport). Returns (shuttle, shuttle_datetime, buffer_min, viability)
    or (None, None, None, None) when nothing connects.
    """
    if leg == "pre":
        airport, direction, which = flight.get("from"), "to_airport", "departs"
    else:
        airport, direction, which = flight.get("to"), "from_airport", "arrives"

    anchor = flight_dt(flight, which)
    if anchor is None or not airport:
        return None, None, None, None

    candidates = []
    for s in shuttles:
        if s["direction"] != direction or s["airport"] != airport:
            continue
        hm = s["arrives"] if leg == "pre" else s["departs"]
        if not hm:
            continue
        for dt in shuttle_dt_candidates(anchor, hm):
            buffer_min = int((anchor - dt).total_seconds() // 60) if leg == "pre" \
                else int((dt - anchor).total_seconds() // 60)
            if buffer_min < 0:
                continue  # physically impossible: shuttle is on the wrong side of the flight
            if buffer_min > max_gap:
                continue  # too far apart to count as the same trip
            if not runs_on(s, trip_date(s, dt, leg)):
                continue
            v = viability(buffer_min, floor_min, max_wait)
            candidates.append((VIABILITY_RANK[v], buffer_min, v, s, dt))

    if not candidates:
        return None, None, None, None
    candidates.sort(key=lambda c: (c[0], c[1]))
    _, buf, v, s, dt = candidates[0]
    return s, dt, buf, v


def leg_label(s, dt, buffer_min, which: str) -> str:
    stop = s.get("stop") or s.get("pickup_location") or ""
    verb = "arr" if which == "pre" else "dep"
    hm = dt.strftime("%H:%M")
    company = s.get("company", "?")
    bits = [f"{company} {verb} {hm}"]
    if which == "pre":
        depart_hm = s.get("departs")
        if depart_hm:
            bits.append(f"(leaves {depart_hm})")
    else:
        arrive_hm = s.get("arrives")
        if arrive_hm:
            bits.append(f"(home {arrive_hm})")
    if stop:
        bits.append(f"from {stop}" if which == "pre" else f"to {stop}")
    return " ".join(bits) + f" | {buffer_min}m"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--flights-json", required=True, help="filter_flights.py output, or '-' for stdin")
    p.add_argument("--shuttles-json", required=True)
    p.add_argument("--shuttle-costs", default="",
                   help='Comma-separated "AIRPORT:USD" pairs (e.g. "ORD:60,IND:30")')
    p.add_argument("--legs", choices=("auto", "pre", "post", "both"), default="auto")
    p.add_argument("--min-buffer-min", type=int, default=90,
                   help="Pre-flight floor: shuttle arrival -> flight departure")
    p.add_argument("--min-connect-min", type=int, default=60,
                   help="Post-flight floor: flight arrival -> shuttle departure")
    p.add_argument("--max-wait-min", type=int, default=240,
                   help="Above this, a pairing is labeled a long wait but still shown")
    p.add_argument("--max-gap-min", type=int, default=720,
                   help="Hard ceiling: shuttle runs further than this from the flight "
                        "are not treated as a pairing at all. Default 720 (12h).")
    p.add_argument("--now", default="",
                   help='ISO datetime for the reservation-cutoff check (e.g. "2026-08-04T16:00")')
    p.add_argument("--reservation-lead-hours", type=float, default=0)
    p.add_argument("--include-unpaired", action="store_true",
                   help="Keep flights with no viable shuttle, flagged in Notes")
    p.add_argument("--format", choices=("markdown", "json"), default="markdown")
    p.add_argument("--tz-offsets", default=argparse.SUPPRESS,
                   help=argparse.SUPPRESS)  # accepted for compatibility, ignored
    args = p.parse_args()

    if hasattr(args, "tz_offsets"):
        print("NOTE: --tz-offsets is ignored. Flight times and airport-side shuttle "
              "times are both in the airport's local zone, so no conversion is needed.",
              file=sys.stderr)

    shuttle_costs = parse_kv_int(args.shuttle_costs, "--shuttle-costs")

    if args.flights_json == "-":
        flights = json.load(sys.stdin)
    else:
        with open(args.flights_json, encoding="utf-8") as f:
            flights = json.load(f)

    with open(args.shuttles_json, encoding="utf-8") as f:
        raw_shuttles = json.load(f).get("shuttles", [])

    shuttles = []
    for i, s in enumerate(raw_shuttles):
        try:
            shuttles.append(normalize_shuttle(s, i))
        except ValueError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return 2
    if not shuttles:
        print("ERROR: no shuttles in --shuttles-json", file=sys.stderr)
        return 2

    served_pre = {s["airport"] for s in shuttles if s["direction"] == "to_airport"}
    served_post = {s["airport"] for s in shuttles if s["direction"] == "from_airport"}

    now = None
    if args.now:
        for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
            try:
                now = datetime.strptime(args.now.strip(), fmt)
                break
            except ValueError:
                continue
        if now is None:
            print(f"ERROR: --now {args.now!r} is not an ISO datetime", file=sys.stderr)
            return 2

    rows = []
    dropped = {"no_pre": 0, "no_post": 0, "no_shuttle_at_all": 0}

    for fl in flights:
        want_pre = args.legs in ("pre", "both") or (
            args.legs == "auto" and fl.get("from") in served_pre)
        want_post = args.legs in ("post", "both") or (
            args.legs == "auto" and fl.get("to") in served_post)

        pre = best_pairing(fl, shuttles, "pre", args.min_buffer_min,
                           args.max_wait_min, args.max_gap_min) \
            if want_pre else (None, None, None, None)
        post = best_pairing(fl, shuttles, "post", args.min_connect_min,
                            args.max_wait_min, args.max_gap_min) \
            if want_post else (None, None, None, None)

        pre_ok, post_ok = pre[0] is not None, post[0] is not None

        if args.legs == "both":
            if not pre_ok:
                dropped["no_pre"] += 1
            if not post_ok:
                dropped["no_post"] += 1
            if (not pre_ok or not post_ok) and not args.include_unpaired:
                continue
        elif args.legs == "pre":
            if not pre_ok:
                dropped["no_pre"] += 1
                if not args.include_unpaired:
                    continue
        elif args.legs == "post":
            if not post_ok:
                dropped["no_post"] += 1
                if not args.include_unpaired:
                    continue
        else:  # auto: take whichever legs the shuttle data can actually serve
            if want_pre and not pre_ok:
                dropped["no_pre"] += 1
            if want_post and not post_ok:
                dropped["no_post"] += 1
            if not pre_ok and not post_ok:
                dropped["no_shuttle_at_all"] += 1
                if not args.include_unpaired:
                    continue

        shuttle_cost = 0
        if pre[0] is not None:
            shuttle_cost += shuttle_costs.get(fl["from"], 0)
        if post[0] is not None:
            shuttle_cost += shuttle_costs.get(fl["to"], 0)

        worst = max(
            [VIABILITY_RANK[x[3]] for x in (pre, post) if x[3]] or [VIABILITY_RANK["COMFORTABLE"]]
        )
        # One comparable scale: the flight's own dollar-equivalent score (price
        # plus soft-preference penalties, from filter_flights.py) + real shuttle
        # cost + what each awkward connection is worth avoiding.
        base = fl.get("rank_score")
        if base is None:
            base = fl.get("price")
        if base is None:
            # No price at all. Sort last rather than first -- a missing price is
            # not a free flight.
            base = UNPRICED
        plan_score = base + shuttle_cost + sum(
            VIABILITY_PENALTY[x[3]] for x in (pre, post) if x[3])

        notes = []
        missed = fl.get("soft_filter_violations") or []
        if missed:
            notes.append("misses " + ", ".join(missed))
        if fl.get("delayed"):
            notes.append("often delayed 30+ min")
        for x, which in ((pre, "pre"), (post, "post")):
            if x[3] and x[3] != "COMFORTABLE":
                notes.append(f"{'to airport' if which == 'pre' else 'from airport'}: "
                             f"{VIABILITY_NOTE[x[3]]}")
        if pre[0] is None and want_pre:
            notes.append("no shuttle to the departure airport")
        if post[0] is None and want_post:
            notes.append("no shuttle from the arrival airport")

        if now is not None and args.reservation_lead_hours > 0:
            for x, which in ((pre, "pre"), (post, "post")):
                if x[1] is None:
                    continue
                hours = (x[1] - now).total_seconds() / 3600
                if hours < args.reservation_lead_hours:
                    notes.append(
                        f"{'to airport' if which == 'pre' else 'from airport'} shuttle is "
                        f"inside the {args.reservation_lead_hours:g}h reservation cutoff "
                        f"({hours:.0f}h out)")

        rows.append({
            "flight": fl,
            "pre": {"shuttle": pre[0], "at": pre[1].strftime("%Y-%m-%d %H:%M") if pre[1] else None,
                    "buffer_min": pre[2], "viability": pre[3]},
            "post": {"shuttle": post[0], "at": post[1].strftime("%Y-%m-%d %H:%M") if post[1] else None,
                     "buffer_min": post[2], "viability": post[3]},
            "shuttle_cost": shuttle_cost,
            "flight_price": fl.get("price"),
            "total": (fl.get("price") or 0) + shuttle_cost,
            "plan_score": round(plan_score, 2),
            "worst_viability": worst,
            "notes": notes,
            "_pre_raw": pre,
            "_post_raw": post,
        })

    rows.sort(key=lambda r: (r["plan_score"], r["flight"].get("departs", "")))

    summary = (f"paired {len(rows)} of {len(flights)} flights"
               f" | dropped: {dropped['no_pre']} missing a pre-flight shuttle,"
               f" {dropped['no_post']} missing a post-flight shuttle,"
               f" {dropped['no_shuttle_at_all']} with neither")
    print(summary, file=sys.stderr)

    if args.format == "json":
        for r in rows:
            r.pop("_pre_raw", None)
            r.pop("_post_raw", None)
        print(json.dumps({"summary": summary, "plans": rows}, indent=2, default=str))
        return 0

    if not rows:
        print("(no viable flight + shuttle pairings)")
        return 0

    show_pre = any(r["_pre_raw"][0] is not None for r in rows)
    show_post = any(r["_post_raw"][0] is not None for r in rows)

    header = ["#", "Date", "Flight", "Airline", "Route", "Departs", "Arrives", "Stops"]
    if show_pre:
        header.append("Shuttle to airport")
    if show_post:
        header.append("Shuttle from airport")
    header += ["Flight $", "Shuttle $", "**Total**", "Notes"]

    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))

    for i, r in enumerate(rows, 1):
        f = r["flight"]
        cells = [
            str(i), f.get("date", ""), f.get("flight", ""), f.get("airline", ""),
            f"{f.get('from','')}-{f.get('to','')}",
            f.get("departs", ""), f.get("arrives", ""), str(f.get("stops", "")),
        ]
        if show_pre:
            s, dt, buf, _ = r["_pre_raw"]
            cells.append(leg_label(s, dt, buf, "pre") if s else "-")
        if show_post:
            s, dt, buf, _ = r["_post_raw"]
            cells.append(leg_label(s, dt, buf, "post") if s else "-")
        price = f.get("price")
        cells += [
            f"${price}" if price is not None else "?",
            f"${r['shuttle_cost']}",
            f"**${r['total']}**",
            "; ".join(r["notes"]) or "-",
        ]
        print("| " + " | ".join(cells) + " |")

    return 0


if __name__ == "__main__":
    sys.exit(main())
