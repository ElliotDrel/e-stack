"""Tests for estack-flight-planner/scripts/load_flights.py.

The loader's whole job is to preserve everything and decide nothing, so these
tests mostly assert that fields survive the trip.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(os.environ.get(
    "FLIGHT_PLANNER_SCRIPTS",
    Path(__file__).resolve().parents[2] / "skills" / "estack-flight-planner" / "scripts",
))
sys.path.insert(0, str(SCRIPTS))

import load_flights as lf  # noqa: E402


def leg(dep, arr, dep_time, arr_time, number, airline="United", **kw):
    d = {
        "departure_airport": {"id": dep, "name": f"{dep} Airport", "time": dep_time},
        "arrival_airport": {"id": arr, "name": f"{arr} Airport", "time": arr_time},
        "airline": airline,
        "flight_number": number,
        "airplane": "Boeing 737",
        "travel_class": "Economy",
        "legroom": "30 in",
        "duration": 140,
        "extensions": ["Wi-Fi"],
    }
    d.update(kw)
    return d


def write(dirpath, dep, arr, date, groups, price_insights=None, key="other_flights"):
    doc = {key: groups}
    if price_insights:
        doc["price_insights"] = price_insights
    (Path(dirpath) / f"{dep}_{arr}_{date}.json").write_text(
        json.dumps(doc), encoding="utf-8")


def run_cli(json_dir, *extra):
    return subprocess.run(
        [sys.executable, str(SCRIPTS / "load_flights.py"), "--json-dir", str(json_dir), *extra],
        capture_output=True, text=True,
    )


# --------------------------------------------------------------------------
# the loader decides nothing
# --------------------------------------------------------------------------

def test_nothing_is_filtered_out(tmp_path):
    """A $4000 red-eye with 3 stops still comes back. Judgment is the caller's."""
    write(tmp_path, "EWR", "IND", "2026-08-20", [
        {"flights": [leg("EWR", "IND", "2026-08-20 14:00", "2026-08-20 16:20", "UA 1")],
         "price": 180, "total_duration": 140},
        {"flights": [leg("EWR", "IND", "2026-08-20 23:30", "2026-08-21 06:00", "XX 9")],
         "price": 4000, "total_duration": 390},
        {"flights": [leg("EWR", "IND", "2026-08-20 08:00", "2026-08-20 10:00", "YY 3")],
         "total_duration": 120},   # no price at all
    ])
    flights, _ = lf.load(tmp_path)
    assert len(flights) == 3
    assert {f["price"] for f in flights} == {180, 4000, None}


def test_best_and_other_buckets_are_labeled_not_merged_away(tmp_path):
    p = tmp_path / "EWR_IND_2026-08-20.json"
    p.write_text(json.dumps({
        "best_flights": [{"flights": [leg("EWR", "IND", "2026-08-20 14:00",
                                          "2026-08-20 16:20", "UA 1")],
                          "price": 180, "total_duration": 140}],
        "other_flights": [{"flights": [leg("EWR", "IND", "2026-08-20 18:00",
                                           "2026-08-20 20:20", "UA 2")],
                           "price": 210, "total_duration": 140}],
    }), encoding="utf-8")
    flights, _ = lf.load(tmp_path)
    assert {f["result_group"] for f in flights} == {"best", "other"}


# --------------------------------------------------------------------------
# the parsing traps this script exists to centralize
# --------------------------------------------------------------------------

def test_arrival_comes_from_the_last_leg(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [{
        "flights": [
            leg("EWR", "ORD", "2026-08-20 09:00", "2026-08-20 11:00", "UA 1"),
            leg("ORD", "IND", "2026-08-20 13:00", "2026-08-20 14:40", "UA 2"),
        ],
        "price": 150, "total_duration": 340,
        "layovers": [{"id": "ORD", "name": "O'Hare", "duration": 120}],
    }])
    f = lf.load(tmp_path)[0][0]
    assert f["departs"] == "09:00"
    assert f["arrives"] == "14:40"
    assert f["stops"] == 1
    assert f["layovers"][0]["airport"] == "ORD"
    assert f["layover_min"] == 120


def test_delay_flag_is_per_leg(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [{
        "flights": [
            leg("EWR", "ORD", "2026-08-20 09:00", "2026-08-20 11:00", "UA 1"),
            leg("ORD", "IND", "2026-08-20 13:00", "2026-08-20 14:40", "UA 2",
                often_delayed_by_over_30_min=True),
        ],
        "price": 150, "total_duration": 340,
    }])
    f = lf.load(tmp_path)[0][0]
    assert f["delayed"] is True
    assert [l["delayed"] for l in f["legs"]] == [False, True]


def test_every_marketing_carrier_is_kept(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [{
        "flights": [
            leg("EWR", "ORD", "2026-08-20 09:00", "2026-08-20 11:00", "UA 1", "United"),
            leg("ORD", "IND", "2026-08-20 13:00", "2026-08-20 14:40", "AA 2", "American"),
        ],
        "price": 150, "total_duration": 340,
    }])
    f = lf.load(tmp_path)[0][0]
    assert f["airline_iatas"] == ["UA", "AA"]
    assert "United" in f["airline"] and "American" in f["airline"]


def test_overnight_detected_from_dates_and_from_the_leg_flag(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [
        {"flights": [leg("EWR", "IND", "2026-08-20 23:30", "2026-08-21 01:50", "UA 1")],
         "price": 180, "total_duration": 140},
        {"flights": [leg("EWR", "IND", "2026-08-20 09:00", "2026-08-20 11:20", "UA 2",
                         overnight=True)],
         "price": 180, "total_duration": 140},
    ])
    flights, _ = lf.load(tmp_path)
    assert all(f["overnight"] for f in flights)


def test_operating_carrier_is_preserved(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [{
        "flights": [leg("EWR", "IND", "2026-08-20 14:00", "2026-08-20 16:20", "UA 3443",
                        plane_and_crew_by="Republic Airways")],
        "price": 344, "total_duration": 140,
    }])
    f = lf.load(tmp_path)[0][0]
    assert f["operated_by"] == "Republic Airways"
    assert f["legs"][0]["operated_by"] == "Republic Airways"


def test_comfort_and_carbon_survive(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [{
        "flights": [leg("EWR", "IND", "2026-08-20 14:00", "2026-08-20 16:20", "F9 1",
                        legroom="28 in", airline="Frontier")],
        "price": 120, "total_duration": 140,
        "carbon_emissions": {"this_flight": 212000, "typical_for_this_route": 153000,
                             "difference_percent": 39},
        "booking_token": "tok123",
    }])
    f = lf.load(tmp_path)[0][0]
    assert f["legroom"] == "28 in"
    assert f["travel_class"] == "Economy"
    assert f["carbon"]["difference_percent"] == 39
    assert f["booking_token"] == "tok123"


def test_price_insights_come_back_as_route_metadata(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [
        {"flights": [leg("EWR", "IND", "2026-08-20 14:00", "2026-08-20 16:20", "UA 1")],
         "price": 222, "total_duration": 140}],
        price_insights={"lowest_price": 222, "price_level": "high",
                        "typical_price_range": [115, 220]})
    _, meta = lf.load(tmp_path)
    assert meta[0]["route"] == "EWR-IND"
    assert meta[0]["price_level"] == "high"
    assert meta[0]["typical_price_range"] == [115, 220]
    assert meta[0]["itineraries"] == 1


def test_unreadable_file_warns_and_keeps_going(tmp_path):
    (tmp_path / "EWR_IND_2026-08-20.json").write_text("{not json", encoding="utf-8")
    write(tmp_path, "LGA", "ORD", "2026-08-20", [
        {"flights": [leg("LGA", "ORD", "2026-08-20 14:00", "2026-08-20 15:44", "UA 1")],
         "price": 134, "total_duration": 104}])
    proc = run_cli(tmp_path)
    assert proc.returncode == 0
    assert "skipping unreadable" in proc.stderr
    assert len(json.loads(proc.stdout)) == 1


# --------------------------------------------------------------------------
# CLI shapes
# --------------------------------------------------------------------------

def test_cli_default_output_is_a_flat_array(tmp_path):
    """Flat array so it drops straight into pair_shuttles.py --flights-json."""
    write(tmp_path, "EWR", "IND", "2026-08-20", [
        {"flights": [leg("EWR", "IND", "2026-08-20 14:00", "2026-08-20 16:20", "UA 1")],
         "price": 180, "total_duration": 140}])
    proc = run_cli(tmp_path)
    assert proc.returncode == 0, proc.stderr
    data = json.loads(proc.stdout)
    assert isinstance(data, list) and data[0]["flight"] == "UA 1"


def test_cli_with_meta_wraps(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [
        {"flights": [leg("EWR", "IND", "2026-08-20 14:00", "2026-08-20 16:20", "UA 1")],
         "price": 180, "total_duration": 140}],
        price_insights={"lowest_price": 180, "price_level": "typical"})
    proc = run_cli(tmp_path, "--with-meta")
    data = json.loads(proc.stdout)
    assert set(data) == {"flights", "routes"}
    assert data["routes"][0]["price_level"] == "typical"


def test_cli_table_and_csv(tmp_path):
    write(tmp_path, "EWR", "IND", "2026-08-20", [
        {"flights": [leg("EWR", "IND", "2026-08-20 14:00", "2026-08-20 16:20", "UA 1")],
         "price": 180, "total_duration": 140}])
    table = run_cli(tmp_path, "--format", "table")
    assert "EWR-IND" in table.stdout and "$180" in table.stdout
    csv_out = run_cli(tmp_path, "--format", "csv")
    assert csv_out.stdout.splitlines()[0].startswith("date,from,to")
    assert "UA 1" in csv_out.stdout


def test_cli_errors_on_missing_dir(tmp_path):
    proc = run_cli(tmp_path / "nope")
    assert proc.returncode == 2
    assert "dir not found" in proc.stderr


def test_cli_errors_when_no_flights_parsed(tmp_path):
    proc = run_cli(tmp_path)
    assert proc.returncode == 2
    assert "no flights parsed" in proc.stderr
