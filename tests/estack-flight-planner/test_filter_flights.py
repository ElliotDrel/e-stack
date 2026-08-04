"""Tests for estack-flight-planner/scripts/filter_flights.py.

Resolve the script directory from FLIGHT_PLANNER_SCRIPTS so the same file can
run against the repo copy (default) or an installed copy under ~/.agents.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(os.environ.get(
    "FLIGHT_PLANNER_SCRIPTS",
    Path(__file__).resolve().parents[2] / "skills" / "estack-flight-planner" / "scripts",
))
sys.path.insert(0, str(SCRIPTS))

import filter_flights as ff  # noqa: E402


# --------------------------------------------------------------------------
# helpers: build SerpAPI-shaped fixtures
# --------------------------------------------------------------------------

def leg(dep, arr, dep_time, arr_time, number, airline="United", delayed=False):
    d = {
        "departure_airport": {"id": dep, "time": dep_time},
        "arrival_airport": {"id": arr, "time": arr_time},
        "airline": airline,
        "flight_number": number,
        "airplane": "Boeing 737",
    }
    if delayed:
        d["often_delayed_by_over_30_min"] = True
    return d


def write_route(dirpath, dep, arr, date, groups):
    p = Path(dirpath) / f"{dep}_{arr}_{date}.json"
    p.write_text(json.dumps({"best_flights": groups}), encoding="utf-8")
    return p


def nonstop(price=180, dep="EWR", arr="IND", date="2026-08-20",
            dep_time="14:00", arr_time="16:20", number="UA 100",
            airline="United", delayed=False, duration=140):
    return {
        "flights": [leg(dep, arr, f"{date} {dep_time}", f"{date} {arr_time}",
                        number, airline, delayed)],
        "price": price,
        "total_duration": duration,
    }


def onestop(price=150, dep="EWR", arr="IND", date="2026-08-20",
            first=("UA 100", "United"), second=("AA 200", "American"),
            duration=400, delayed_leg=None):
    return {
        "flights": [
            leg(dep, "ORD", f"{date} 09:00", f"{date} 11:00", first[0], first[1],
                delayed_leg == 0),
            leg("ORD", arr, f"{date} 13:00", f"{date} 14:40", second[0], second[1],
                delayed_leg == 1),
        ],
        "price": price,
        "total_duration": duration,
    }


def run_cli(json_dir, *extra):
    return subprocess.run(
        [sys.executable, str(SCRIPTS / "filter_flights.py"), "--json-dir", str(json_dir), *extra],
        capture_output=True, text=True,
    )


# --------------------------------------------------------------------------
# parsing
# --------------------------------------------------------------------------

def test_multi_leg_itinerary_keeps_every_carrier(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [onestop()])
    flights = ff.load_flights(tmp_path)
    assert len(flights) == 1
    f = flights[0]
    assert f["airline_iatas"] == ["UA", "AA"]
    assert f["airline_iata"] == "UA"
    assert f["stops"] == 1
    assert "UA 100" in f["flight"] and "AA 200" in f["flight"]


def test_arrival_comes_from_the_last_leg(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [onestop()])
    f = ff.load_flights(tmp_path)[0]
    assert f["departs"] == "09:00"
    assert f["arrives"] == "14:40"          # not the ORD arrival at 11:00
    assert f["arrives_full"] == "2026-08-20 14:40"


@pytest.mark.parametrize("delayed_leg", [0, 1])
def test_delay_flag_is_read_from_any_leg(tmp_path, delayed_leg):
    """often_delayed_by_over_30_min lives on the leg, not the itinerary."""
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [onestop(delayed_leg=delayed_leg)])
    assert ff.load_flights(tmp_path)[0]["delayed"] is True


def test_no_delay_flag_when_no_leg_is_flagged(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [onestop()])
    assert ff.load_flights(tmp_path)[0]["delayed"] is False


# --------------------------------------------------------------------------
# filters
# --------------------------------------------------------------------------

def test_airline_filter_rejects_a_connection_on_a_non_preferred_carrier(tmp_path):
    """A UA -> AA itinerary is not "a United flight"."""
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [onestop()])
    f = ff.load_flights(tmp_path)[0]
    assert "airlines" in ff.violations_for(f, None, [], set(), set(), {"UA"}, False)


def test_airline_filter_accepts_an_all_preferred_connection(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20",
                [onestop(second=("UA 200", "United"))])
    f = ff.load_flights(tmp_path)[0]
    assert ff.violations_for(f, None, [], set(), set(), {"UA"}, False) == []


def test_duration_filter(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [onestop(duration=400)])
    f = ff.load_flights(tmp_path)[0]
    assert "duration" in ff.violations_for(f, None, [], set(), set(), set(), False,
                                           max_duration=300)
    assert ff.violations_for(f, None, [], set(), set(), set(), False,
                             max_duration=500) == []


def test_nonstop_and_price_filters(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [onestop(price=500)])
    f = ff.load_flights(tmp_path)[0]
    v = ff.violations_for(f, 200, [], set(), set(), set(), True)
    assert set(v) == {"max-price", "nonstop"}


def test_time_band_filter(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20",
                [nonstop(dep_time="06:15", arr_time="08:30")])
    f = ff.load_flights(tmp_path)[0]
    bands = ff.parse_bands("11:00-14:00,14:00-22:00")
    assert "time-priority" in ff.violations_for(f, None, bands, set(), set(), set(), False)
    assert ff.priority_band(f, bands) == 2      # outside every band


# --------------------------------------------------------------------------
# ranking
# --------------------------------------------------------------------------

def test_rank_score_is_price_plus_penalties():
    f = {"price": 189, "priority_band": 0}
    score, why = ff.rank_score(f, ["airlines"], ff.DEFAULT_PENALTIES, ff.DEFAULT_BAND_STEP)
    assert score == 229                          # 189 + 40
    assert why == ["airlines +$40"]


def test_max_price_violation_is_not_double_charged():
    """Going over budget already shows up as a higher price."""
    f = {"price": 400, "priority_band": 0}
    score, why = ff.rank_score(f, ["max-price"], ff.DEFAULT_PENALTIES, ff.DEFAULT_BAND_STEP)
    assert score == 400
    assert why == []


def test_band_step_costs_each_rung():
    f = {"price": 100, "priority_band": 2}
    score, _ = ff.rank_score(f, [], ff.DEFAULT_PENALTIES, ff.DEFAULT_BAND_STEP)
    assert score == 100 + 2 * ff.DEFAULT_BAND_STEP


def test_unpriced_flight_scores_infinite():
    score, why = ff.rank_score({"price": None}, [], ff.DEFAULT_PENALTIES, 15)
    assert score == float("inf")
    assert why == ["no price available"]


def test_penalty_overrides_parse():
    p = ff.parse_penalties("airlines:80,nonstop:0")
    assert p["airlines"] == 80
    assert p["nonstop"] == 0
    assert p["time-priority"] == ff.DEFAULT_PENALTIES["time-priority"]


def test_cli_soft_preference_does_not_outrank_a_much_cheaper_flight(tmp_path):
    """The regression this ranking model exists to prevent."""
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [
        nonstop(price=400, number="UA 900", airline="United"),
        nonstop(price=189, number="AA 900", airline="American"),
    ])
    proc = run_cli(tmp_path, "--airlines", "UA", "--max-price", "150",
                   "--soft-filters", "airlines,max-price")
    assert proc.returncode == 0, proc.stderr
    out = json.loads(proc.stdout)
    assert out[0]["flight"] == "AA 900"          # 189 + 40 beats 400 + 0
    assert out[0]["rank_score"] == 229
    assert out[1]["flight"] == "UA 900"


def test_cli_hard_filter_still_excludes(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [
        nonstop(price=400, number="UA 900"),
        nonstop(price=189, number="AA 900", airline="American"),
    ])
    proc = run_cli(tmp_path, "--airlines", "UA")   # no --soft-filters: hard
    assert proc.returncode == 0, proc.stderr
    out = json.loads(proc.stdout)
    assert [f["flight"] for f in out] == ["UA 900"]


def test_cli_rejects_unknown_soft_filter(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [nonstop()])
    proc = run_cli(tmp_path, "--soft-filters", "bogus")
    assert proc.returncode == 2
    assert "unknown --soft-filters" in proc.stderr


def test_cli_rejects_unknown_penalty_name(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [nonstop()])
    proc = run_cli(tmp_path, "--soft-penalties", "bogus:10")
    assert proc.returncode == 2
    assert "unknown --soft-penalties" in proc.stderr


def test_cli_cluster_analysis_reports_each_constraint(tmp_path):
    write_route(tmp_path, "EWR", "IND", "2026-08-20", [
        nonstop(price=400, number="UA 900"),
        onestop(price=189, duration=900),
    ])
    proc = run_cli(tmp_path, "--cluster-analysis", "--max-price", "150",
                   "--nonstop", "--max-duration-min", "300")
    assert proc.returncode == 0, proc.stderr
    rep = json.loads(proc.stdout)
    assert rep["total_flights"] == 2
    assert rep["passing_all_filters"] == 0
    assert rep["constraint_impact"]["max-price"]["eliminated"] == 2
    assert rep["constraint_impact"]["nonstop"]["eliminated"] == 1
    assert rep["constraint_impact"]["duration"]["eliminated"] == 1
    assert rep["price_distribution"]["min"] == 189
