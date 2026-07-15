"""Tests for timezone handling (set_timezone / --tz) and the --project filter."""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime

import pytest

from lib import parser as PR
from lib import paths as P


def _run_cli(cli_path, *args, env_overrides=None):
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    # Tests run inside a real Claude Code session inherit a real
    # CLAUDE_CODE_SESSION_ID from the ambient environment — scrub both session-id
    # vars first so a test's fake env_overrides isn't silently outranked by it.
    env.pop("CLAUDE_CODE_SESSION_ID", None)
    env.pop("CLAUDE_SESSION_ID", None)
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        [sys.executable, str(cli_path), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )


@pytest.fixture(autouse=True)
def _reset_tz():
    yield
    PR.set_timezone(None)


# ── set_timezone / _parse_timestamp ─────────────────────────────────────────

def test_parse_timestamp_default_is_naive():
    dt = PR._parse_timestamp("2026-05-01T10:00:00Z")
    assert dt is not None
    assert dt.tzinfo is None


def test_parse_timestamp_utc():
    PR.set_timezone("UTC")
    assert PR._parse_timestamp("2026-05-01T10:00:00Z") == datetime(2026, 5, 1, 10, 0)


def test_parse_timestamp_offset():
    PR.set_timezone("+2")
    assert PR._parse_timestamp("2026-05-01T10:00:00Z") == datetime(2026, 5, 1, 12, 0)


def test_set_timezone_half_hour_offset():
    PR.set_timezone("+05:30")
    assert PR._parse_timestamp("2026-05-01T10:00:00Z") == datetime(2026, 5, 1, 15, 30)


def test_set_timezone_iana():
    try:
        PR.set_timezone("America/New_York")
    except ValueError:
        pytest.skip("IANA tz database not available on this machine")
    dt = PR._parse_timestamp("2026-01-15T10:00:00Z")  # EST = UTC-5
    assert dt == datetime(2026, 1, 15, 5, 0)


def test_set_timezone_invalid_raises():
    with pytest.raises(ValueError):
        PR.set_timezone("Mars/Olympus_Mons")


def test_epoch_to_display_utc():
    PR.set_timezone("UTC")
    # 2026-05-01T10:00:00Z as epoch
    epoch = datetime(2026, 5, 1, 10, 0).replace(
        tzinfo=__import__("datetime").timezone.utc
    ).timestamp()
    assert PR.epoch_to_display(epoch) == datetime(2026, 5, 1, 10, 0)


def test_display_to_epoch_roundtrip_offset_tz():
    PR.set_timezone("+2")
    epoch = 1772546400.0
    assert PR.display_to_epoch(PR.epoch_to_display(epoch)) == epoch


def test_now_display_matches_utc_clock():
    from datetime import timezone as _tzmod
    PR.set_timezone("UTC")
    delta = abs((PR.now_display() - datetime.now(_tzmod.utc).replace(tzinfo=None)).total_seconds())
    assert delta < 5


def test_parse_timespec_now_respects_tz():
    from datetime import timezone as _tzmod
    PR.set_timezone("UTC")
    now_spec = P.parse_timespec("now")
    delta = abs((now_spec - datetime.now(_tzmod.utc).replace(tzinfo=None)).total_seconds())
    assert delta < 5


def test_json_timestamps_are_display_tz(cli_path, fixtures_dir):
    # basic-session events are 10:00:0xZ — with +2 the JSON timestamps read 12:00
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "basic-session.jsonl"),
        "--mode", "last", "--format", "json", "--tz", "+2",
    )
    assert r.returncode == 0
    data = json.loads(r.stdout)
    assert data[-1]["timestamp"].startswith("2026-05-01T12:00:05")


# ── --project filter ─────────────────────────────────────────────────────────

@pytest.fixture
def multi_root(fixtures_dir, tmp_path):
    root = tmp_path / "projects"
    keel = root / "C--Users-x-Keel-Project"
    other = root / "C--Users-x-Other-Claude-Code"
    keel.mkdir(parents=True)
    other.mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", keel / "keelsession.jsonl")
    shutil.copy(fixtures_dir / "tool-zoo.jsonl", other / "othersession.jsonl")
    return root


def test_filter_projects_substring(multi_root):
    dirs = P.filter_projects(multi_root, "keel")
    assert len(dirs) == 1
    assert "Keel" in dirs[0].name


def test_filter_projects_spaces_match_hyphens(multi_root):
    dirs = P.filter_projects(multi_root, "Keel Project")
    assert len(dirs) == 1


def test_cli_project_no_match_exits_1(cli_path, multi_root):
    r = _run_cli(
        cli_path, "--root", str(multi_root), "--mode", "list", "--project", "zzz",
    )
    assert r.returncode == 1
