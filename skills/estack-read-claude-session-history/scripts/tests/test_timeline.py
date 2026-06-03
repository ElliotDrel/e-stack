"""Tests for the timeline mode (build/render/gap parsing + CLI)."""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

import read_transcript as RT


def _run_cli(cli_path, *args, env_overrides=None):
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        [sys.executable, str(cli_path), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )


@pytest.fixture
def fake_root(fixtures_dir, tmp_path):
    root = tmp_path / "projects"
    proj = root / "C--fake-proj"
    proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "timeline-day-test.jsonl", proj / "abc12345.jsonl")
    return root


# ── unit: gap + duration helpers ─────────────────────────────────────────────

def test_parse_gap_default():
    assert RT._parse_gap(None) == 15


def test_parse_gap_minutes():
    assert RT._parse_gap("20m") == 20
    assert RT._parse_gap("20") == 20


def test_parse_gap_hours():
    assert RT._parse_gap("1h") == 60


def test_parse_gap_invalid():
    with pytest.raises(ValueError):
        RT._parse_gap("soon")


def test_fmt_dur():
    assert RT._fmt_dur(timedelta(minutes=8)) == "8m"
    assert RT._fmt_dur(timedelta(minutes=72)) == "1h12m"
    assert RT._fmt_dur(timedelta(seconds=30)) == "<1m"


# ── unit: block grouping ─────────────────────────────────────────────────────

def test_build_timeline_blocks(fake_root):
    from lib import parser as PR
    PR.set_timezone("UTC")
    try:
        data = RT.build_timeline(
            [fake_root / "C--fake-proj"],
            since=datetime(2026, 5, 1),
            until=datetime(2026, 5, 2),
            gap_minutes=15,
            current_uuid=None,
        )
    finally:
        PR.set_timezone(None)
    blocks = data["blocks"]
    assert len(blocks) == 2
    assert blocks[0]["start"] == datetime(2026, 5, 1, 10, 0)
    assert blocks[0]["end"] == datetime(2026, 5, 1, 10, 8)
    assert blocks[1]["start"] == datetime(2026, 5, 1, 12, 0)
    assert blocks[1]["end"] == datetime(2026, 5, 1, 12, 2)


def test_build_timeline_wide_gap_merges(fake_root):
    from lib import parser as PR
    PR.set_timezone("UTC")
    try:
        data = RT.build_timeline(
            [fake_root / "C--fake-proj"],
            since=datetime(2026, 5, 1),
            until=datetime(2026, 5, 2),
            gap_minutes=180,  # 3h gap threshold swallows the 1h52m idle
            current_uuid=None,
        )
    finally:
        PR.set_timezone(None)
    assert len(data["blocks"]) == 1


# ── CLI ──────────────────────────────────────────────────────────────────────

def test_timeline_cli_text(cli_path, fake_root):
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--tz", "UTC",
        "--mode", "timeline", "--date", "2026-05-01",
    )
    assert r.returncode == 0
    assert "10:00" in r.stdout
    assert "12:02" in r.stdout
    assert "idle" in r.stdout
    assert "2 active block(s)" in r.stdout


def test_timeline_cli_json(cli_path, fake_root):
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--tz", "UTC",
        "--mode", "timeline", "--date", "2026-05-01", "--format", "json",
    )
    assert r.returncode == 0
    data = json.loads(r.stdout)
    assert data["totals"]["blocks"] == 2
    assert data["totals"]["sessions"] == 1
    assert data["blocks"][0]["start"].endswith("10:00:00")
    assert data["blocks"][0]["sessions"][0]["uuid"] == "abc12345"


def test_timeline_cli_empty_range(cli_path, fake_root):
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--tz", "UTC",
        "--mode", "timeline", "--date", "2020-01-01",
    )
    assert r.returncode == 0
    assert "no activity" in r.stdout


def test_timeline_cli_project_filter(cli_path, fake_root):
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--tz", "UTC",
        "--mode", "timeline", "--date", "2026-05-01", "--project", "fake",
    )
    assert r.returncode == 0
    assert "10:00" in r.stdout


def test_timeline_cli_exclude_current(cli_path, fake_root):
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--tz", "UTC",
        "--mode", "timeline", "--date", "2026-05-01", "--exclude-current",
        env_overrides={"CLAUDE_SESSION_ID": "abc12345"},
    )
    assert r.returncode == 0
    assert "no activity" in r.stdout


def test_journal_cli_exclude_current(cli_path, fake_root):
    r = _run_cli(
        cli_path, "--root", str(fake_root),
        "--mode", "journal", "--since", "2020-01-01", "--all-projects",
        "--exclude-current",
        env_overrides={"CLAUDE_SESSION_ID": "abc12345"},
    )
    assert r.returncode == 0
    assert "abc12345" not in r.stdout


def test_timeline_cli_project_no_match(cli_path, fake_root):
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--tz", "UTC",
        "--mode", "timeline", "--date", "2026-05-01", "--project", "zzz-nope",
    )
    assert r.returncode == 1
