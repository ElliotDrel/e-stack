"""Tests for estack-flight-planner/scripts/pair_shuttles.py.

Resolve the script directory from FLIGHT_PLANNER_SCRIPTS so the same file can
run against the repo copy (default) or an installed copy under ~/.agents.
"""
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pytest

SCRIPTS = Path(os.environ.get(
    "FLIGHT_PLANNER_SCRIPTS",
    Path(__file__).resolve().parents[2] / "skills" / "estack-flight-planner" / "scripts",
))
sys.path.insert(0, str(SCRIPTS))

import pair_shuttles as ps  # noqa: E402


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def flight(date="2026-08-20", frm="EWR", to="IND", departs="14:00", arrives="16:20",
           price=180, **kw):
    f = {
        "date": date, "from": frm, "to": to,
        "flight": "UA 1234", "airline": "United",
        "departs": departs, "arrives": arrives,
        "departs_full": f"{date} {departs}",
        "arrives_full": f"{kw.pop('arrives_date', date)} {arrives}",
        "price": price, "stops": 0,
    }
    f.update(kw)
    return f


def shuttle(airport="IND", direction="from_airport", departs="17:30", arrives="18:45",
            company="Acme", **kw):
    s = {"company": company, "airport": airport, "direction": direction,
         "departs_local": departs, "arrives_local": arrives}
    s.update(kw)
    return s


def norm(entries):
    return [ps.normalize_shuttle(s, i) for i, s in enumerate(entries)]


def run_cli(tmp_path, flights, shuttles, *extra):
    fj = tmp_path / "flights.json"
    sj = tmp_path / "shuttles.json"
    fj.write_text(json.dumps(flights), encoding="utf-8")
    sj.write_text(json.dumps({"shuttles": shuttles}), encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS / "pair_shuttles.py"),
         "--flights-json", str(fj), "--shuttles-json", str(sj), *extra],
        capture_output=True, text=True,
    )
    return proc


# --------------------------------------------------------------------------
# normalize_shuttle
# --------------------------------------------------------------------------

def test_normalize_explicit_schema():
    s = ps.normalize_shuttle(shuttle(), 0)
    assert s["airport"] == "IND"
    assert s["direction"] == "from_airport"
    assert s["departs"] == "17:30" and s["arrives"] == "18:45"


def test_normalize_legacy_to_airport():
    """Old schema: from/to labels plus departs_et."""
    s = ps.normalize_shuttle(
        {"company": "Reindeer", "from": "Purdue", "to": "ORD",
         "departs_et": "14:15", "arrives_local": "16:30"}, 0)
    assert s["airport"] == "ORD"
    assert s["direction"] == "to_airport"
    assert s["departs"] == "14:15"


def test_normalize_legacy_from_airport():
    s = ps.normalize_shuttle(
        {"company": "Reindeer", "from": "IND", "to": "Purdue",
         "departs_local": "19:00", "arrives_local": "20:15"}, 0)
    assert s["airport"] == "IND"
    assert s["direction"] == "from_airport"


def test_normalize_rejects_unresolvable():
    with pytest.raises(ValueError, match="cannot be resolved"):
        ps.normalize_shuttle({"company": "X", "from": "Home", "to": "Town",
                              "departs_local": "08:00", "arrives_local": "09:00"}, 3)


# --------------------------------------------------------------------------
# pre-flight leg (shuttle -> departure airport)
# --------------------------------------------------------------------------

def test_pre_leg_basic_buffer():
    f = flight(frm="IND", to="EWR", departs="14:00")
    s = norm([shuttle(airport="IND", direction="to_airport",
                      departs="11:00", arrives="12:00")])
    got, dt, buf, v = ps.best_pairing(f, s, "pre", 90, 240)
    assert got is not None
    assert buf == 120
    assert v == "COMFORTABLE"
    assert dt == datetime(2026, 8, 20, 12, 0)


def test_pre_leg_rejects_shuttle_arriving_after_departure():
    f = flight(frm="IND", to="EWR", departs="10:00")
    s = norm([shuttle(airport="IND", direction="to_airport",
                      departs="11:00", arrives="12:00")])
    # nearest valid candidate is the previous day: 22h buffer, beyond 3x max wait
    got, _, _, _ = ps.best_pairing(f, s, "pre", 90, 240)
    assert got is None


def test_pre_leg_too_tight_is_kept_and_labeled():
    f = flight(frm="IND", to="EWR", departs="12:30")
    s = norm([shuttle(airport="IND", direction="to_airport",
                      departs="11:00", arrives="12:00")])
    got, _, buf, v = ps.best_pairing(f, s, "pre", 90, 240)
    assert buf == 30
    assert v == "TOO_TIGHT"


def test_pre_leg_overnight_uses_previous_day():
    """A 01:00 departure pairs with a shuttle that arrived at 22:00 the night before."""
    f = flight(frm="IND", to="EWR", departs="01:00")
    s = norm([shuttle(airport="IND", direction="to_airport",
                      departs="20:30", arrives="22:00")])
    got, dt, buf, v = ps.best_pairing(f, s, "pre", 90, 240)
    assert buf == 180
    assert dt == datetime(2026, 8, 19, 22, 0)
    assert v == "COMFORTABLE"


def test_pre_leg_prefers_best_viability_not_earliest():
    f = flight(frm="IND", to="EWR", departs="14:00")
    s = norm([
        shuttle(company="Early", airport="IND", direction="to_airport",
                departs="05:00", arrives="06:00"),   # 480m -> LONG_WAIT
        shuttle(company="Right", airport="IND", direction="to_airport",
                departs="11:00", arrives="12:00"),   # 120m -> COMFORTABLE
    ])
    got, _, buf, v = ps.best_pairing(f, s, "pre", 90, 240)
    assert got["company"] == "Right"
    assert buf == 120


# --------------------------------------------------------------------------
# post-flight leg (arrival airport -> home)
# --------------------------------------------------------------------------

def test_post_leg_basic_buffer():
    f = flight(frm="EWR", to="IND", arrives="16:20")
    s = norm([shuttle(airport="IND", direction="from_airport",
                      departs="17:30", arrives="18:45")])
    got, dt, buf, v = ps.best_pairing(f, s, "post", 60, 240)
    assert buf == 70
    assert v == "TIGHT"           # 70 < 60 + 30
    assert dt == datetime(2026, 8, 20, 17, 30)


def test_post_leg_never_pairs_a_shuttle_that_left_before_landing():
    """The 09:00 run on the arrival day is unusable; the next morning's is 11h out."""
    f = flight(frm="EWR", to="IND", arrives="22:00")
    s = norm([shuttle(airport="IND", direction="from_airport",
                      departs="09:00", arrives="10:15")])
    got, dt, buf, v = ps.best_pairing(f, s, "post", 60, 240)
    assert dt == datetime(2026, 8, 21, 9, 0)   # next day, not the same day
    assert buf == 660
    assert v == "LONG_WAIT"


def test_max_gap_drops_pairings_beyond_the_ceiling():
    f = flight(frm="EWR", to="IND", arrives="22:00")
    s = norm([shuttle(airport="IND", direction="from_airport",
                      departs="09:00", arrives="10:15")])
    got, _, _, _ = ps.best_pairing(f, s, "post", 60, 240, max_gap=600)
    assert got is None


def test_post_leg_overnight_uses_next_day():
    f = flight(frm="EWR", to="IND", arrives="23:40")
    s = norm([shuttle(airport="IND", direction="from_airport",
                      departs="01:00", arrives="02:15")])
    got, dt, buf, v = ps.best_pairing(f, s, "post", 60, 240)
    assert buf == 80
    assert dt == datetime(2026, 8, 21, 1, 0)


def test_post_leg_ignores_wrong_direction_entries():
    f = flight(frm="EWR", to="IND", arrives="16:20")
    s = norm([shuttle(airport="IND", direction="to_airport",
                      departs="17:30", arrives="18:45")])
    got, _, _, _ = ps.best_pairing(f, s, "post", 60, 240)
    assert got is None


# --------------------------------------------------------------------------
# day-of-week filtering
# --------------------------------------------------------------------------

def test_days_filter_excludes_non_operating_day():
    # 2026-08-20 is a Thursday
    assert datetime(2026, 8, 20).strftime("%a") == "Thu"
    f = flight(frm="EWR", to="IND", arrives="16:20")
    s = norm([shuttle(airport="IND", direction="from_airport",
                      departs="17:30", arrives="18:45", days=["Sat", "Sun"])])
    got, _, _, _ = ps.best_pairing(f, s, "post", 60, 240)
    assert got is None


def test_days_filter_accepts_operating_day_long_and_short_names():
    f = flight(frm="EWR", to="IND", arrives="16:20")
    for names in (["Thu"], ["Thursday"], ["thu", "fri"]):
        s = norm([shuttle(airport="IND", direction="from_airport",
                          departs="17:30", arrives="18:45", days=names)])
        got, _, _, _ = ps.best_pairing(f, s, "post", 60, 240)
        assert got is not None, names


def test_trip_date_uses_departure_day_for_overnight_pre_run():
    """A run leaving 23:00 and arriving 01:30 departs the day before it lands."""
    s = ps.normalize_shuttle(shuttle(airport="ORD", direction="to_airport",
                                     departs="23:00", arrives="01:30"), 0)
    assert ps.trip_date(s, datetime(2026, 8, 21, 1, 30), "pre") == "2026-08-20"
    # a same-day run keeps its own date
    s2 = ps.normalize_shuttle(shuttle(airport="ORD", direction="to_airport",
                                      departs="14:00", arrives="16:30"), 0)
    assert ps.trip_date(s2, datetime(2026, 8, 20, 16, 30), "pre") == "2026-08-20"


# --------------------------------------------------------------------------
# viability tiers
# --------------------------------------------------------------------------

@pytest.mark.parametrize("buf,expected", [
    (30, "TOO_TIGHT"), (89, "TOO_TIGHT"),
    (90, "TIGHT"), (119, "TIGHT"),
    (120, "COMFORTABLE"), (180, "COMFORTABLE"),
    (181, "GENEROUS"), (240, "GENEROUS"),
    (241, "LONG_WAIT"),
])
def test_viability_tiers(buf, expected):
    assert ps.viability(buf, 90, 240) == expected


# --------------------------------------------------------------------------
# CLI end to end
# --------------------------------------------------------------------------

def test_cli_auto_uses_only_the_arrival_side(tmp_path):
    """Shuttle data covers IND arrivals only; an EWR->IND flight still pairs."""
    proc = run_cli(
        tmp_path,
        [flight(frm="EWR", to="IND", arrives="16:20", price=180)],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
        "--shuttle-costs", "IND:30",
    )
    assert proc.returncode == 0, proc.stderr
    assert "Shuttle from airport" in proc.stdout
    assert "Shuttle to airport" not in proc.stdout
    assert "**$210**" in proc.stdout      # 180 flight + 30 shuttle


def test_cli_charges_both_legs_when_both_pair(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight(frm="IND", to="ORD", departs="14:00", arrives="14:30", price=100)],
        [
            shuttle(airport="IND", direction="to_airport", departs="11:00", arrives="12:00"),
            shuttle(airport="ORD", direction="from_airport", departs="16:15", arrives="18:30"),
        ],
        "--shuttle-costs", "IND:30,ORD:60", "--legs", "both",
    )
    assert proc.returncode == 0, proc.stderr
    assert "**$190**" in proc.stdout      # 100 + 30 + 60
    assert "Shuttle to airport" in proc.stdout and "Shuttle from airport" in proc.stdout


def test_cli_legs_both_drops_flights_missing_a_leg(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight(frm="IND", to="ORD", departs="14:00", arrives="14:30")],
        [shuttle(airport="IND", direction="to_airport", departs="11:00", arrives="12:00")],
        "--legs", "both",
    )
    assert proc.returncode == 0, proc.stderr
    assert "no viable flight + shuttle pairings" in proc.stdout
    assert "1 missing a post-flight shuttle" in proc.stderr


def test_cli_include_unpaired_keeps_the_flight(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight(frm="IND", to="ORD", departs="14:00", arrives="14:30")],
        [shuttle(airport="IND", direction="to_airport", departs="11:00", arrives="12:00")],
        "--legs", "both", "--include-unpaired",
    )
    assert proc.returncode == 0, proc.stderr
    assert "no shuttle from the arrival airport" in proc.stdout


def test_cli_reservation_cutoff_note(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight(frm="EWR", to="IND", arrives="16:20")],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
        "--now", "2026-08-20T08:00", "--reservation-lead-hours", "24",
    )
    assert proc.returncode == 0, proc.stderr
    assert "reservation cutoff" in proc.stdout


def test_cli_no_cutoff_note_when_booked_far_ahead(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight(frm="EWR", to="IND", arrives="16:20")],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
        "--now", "2026-08-04T08:00", "--reservation-lead-hours", "24",
    )
    assert proc.returncode == 0, proc.stderr
    assert "reservation cutoff" not in proc.stdout


def test_cli_json_format(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight(frm="EWR", to="IND", arrives="16:20", price=180)],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
        "--shuttle-costs", "IND:30", "--format", "json",
    )
    assert proc.returncode == 0, proc.stderr
    data = json.loads(proc.stdout)
    assert data["plans"][0]["total"] == 210
    assert data["plans"][0]["post"]["buffer_min"] == 130
    assert data["plans"][0]["pre"]["shuttle"] is None


def test_cli_sorts_comfortable_above_too_tight(tmp_path):
    proc = run_cli(
        tmp_path,
        [
            flight(frm="EWR", to="IND", flight="UA 1 TIGHT", arrives="18:00", price=100),
            flight(frm="EWR", to="IND", flight="UA 2 GOOD", arrives="16:20", price=300),
        ],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
    )
    assert proc.returncode == 0, proc.stderr
    body = [ln for ln in proc.stdout.splitlines() if ln.startswith("| 1 ")][0]
    assert "UA 2 GOOD" in body          # cheaper flight loses to the safer connection


def test_cli_rejects_bad_shuttle_costs(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight()],
        [shuttle()],
        "--shuttle-costs", "IND-30",
    )
    assert proc.returncode == 2
    assert "expected KEY:VAL" in proc.stderr


def test_cli_errors_on_unresolvable_shuttle(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight()],
        [{"company": "X", "from": "Home", "to": "Town",
          "departs_local": "08:00", "arrives_local": "09:00"}],
    )
    assert proc.returncode == 2
    assert "cannot be resolved" in proc.stderr


def test_cli_tz_offsets_accepted_but_ignored(tmp_path):
    proc = run_cli(
        tmp_path,
        [flight(frm="EWR", to="IND", arrives="16:20")],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
        "--tz-offsets", "IND:0",
    )
    assert proc.returncode == 0, proc.stderr
    assert "--tz-offsets is ignored" in proc.stderr


def test_cli_unpriced_flight_sorts_last_not_first(tmp_path):
    """A missing price is not a free flight."""
    priced = flight(frm="EWR", to="IND", arrives="16:20", price=400)
    priced["flight"] = "UA PRICED"
    unpriced = flight(frm="EWR", to="IND", arrives="16:20", price=None)
    unpriced["flight"] = "XX UNPRICED"
    proc = run_cli(
        tmp_path, [unpriced, priced],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
    )
    assert proc.returncode == 0, proc.stderr
    first = [ln for ln in proc.stdout.splitlines() if ln.startswith("| 1 ")][0]
    assert "UA PRICED" in first


def test_cli_soft_violations_and_delay_surface_in_notes(tmp_path):
    f = flight(frm="EWR", to="IND", arrives="16:20")
    f["soft_filter_violations"] = ["max-price", "airlines"]
    f["delayed"] = True
    proc = run_cli(
        tmp_path, [f],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
    )
    assert proc.returncode == 0, proc.stderr
    assert "misses max-price, airlines" in proc.stdout
    assert "often delayed 30+ min" in proc.stdout


def test_cli_soft_preference_does_not_trump_a_much_cheaper_flight(tmp_path):
    """rank_score from filter_flights.py drives the order, not violation counts."""
    cheap = flight(frm="EWR", to="IND", arrives="16:20", price=189)
    cheap["flight"] = "AA CHEAP"
    cheap["soft_filter_violations"] = ["airlines"]
    cheap["rank_score"] = 229          # 189 + $40 airline penalty
    pricey = flight(frm="EWR", to="IND", arrives="16:20", price=400)
    pricey["flight"] = "UA PRICEY"
    pricey["soft_filter_violations"] = []
    pricey["rank_score"] = 400
    proc = run_cli(
        tmp_path, [pricey, cheap],
        [shuttle(airport="IND", direction="from_airport", departs="18:30", arrives="19:45")],
    )
    assert proc.returncode == 0, proc.stderr
    first = [ln for ln in proc.stdout.splitlines() if ln.startswith("| 1 ")][0]
    assert "AA CHEAP" in first
