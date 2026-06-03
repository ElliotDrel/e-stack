"""Tests for the engagement mode (attention-time accounting)."""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta

import pytest

import read_transcript as RT
from lib import parser as PR


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
def utc_tz():
    PR.set_timezone("UTC")
    yield
    PR.set_timezone(None)


def _fake_root(tmp_path, **projects):
    """Build a fake projects root: {project_dir_name: [(fixture, uuid), ...]}."""
    root = tmp_path / "projects"
    for proj_name, files in projects.items():
        pd = root / proj_name
        pd.mkdir(parents=True)
        for src, uuid in files:
            shutil.copy(src, pd / f"{uuid}.jsonl")
    return root


def _build(root, **kw):
    defaults = dict(
        report_dirs=None,
        report_file=None,
        since=datetime(2026, 5, 1),
        until=datetime(2026, 5, 2),
        break_minutes=10,
        current_uuid=None,
    )
    defaults.update(kw)
    return RT.build_engagement(root, **defaults)


# ── unit: gap math ───────────────────────────────────────────────────────────

def test_gaps_straddle_threshold(fixtures_dir, tmp_path, utc_tz):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    data = _build(root)
    (s,) = data["sessions"].values()
    # 5m + 3m active, 32m break (Claude finished 10:09, reply 10:40 — too late),
    # then 5m active = 13m.
    assert s["active"] == timedelta(minutes=13)
    assert s["user_messages"] == 5
    assert len(data["breaks"]) == 1
    assert data["breaks"][0][0] == datetime(2026, 5, 1, 10, 8)
    assert data["breaks"][0][1] == datetime(2026, 5, 1, 10, 40)


def test_waiting_on_claude_credit(fixtures_dir, tmp_path, utc_tz):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-waiting.jsonl", "bbbb2222")]}
    )
    data = _build(root)
    (s,) = data["sessions"].values()
    # 32m gap, but Claude's last event was 10:30 and the user replied 10:32
    # (2m ≤ 10m) — the whole gap counts as waiting-on-Claude.
    assert s["active"] == timedelta(minutes=32)
    assert data["breaks"] == []


def test_noise_exclusion(fixtures_dir, tmp_path, utc_tz):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-noise.jsonl", "cccc3333")]}
    )
    data = _build(root)
    (s,) = data["sessions"].values()
    # Only the two real prompts (10:01, 10:06) count: compact continuation,
    # isMeta injections, and tool results are all excluded from the user stream.
    assert s["user_messages"] == 2
    assert s["first"] == datetime(2026, 5, 1, 10, 1)
    assert s["active"] == timedelta(minutes=5)


def test_parallel_sessions_never_double_count(fixtures_dir, tmp_path, utc_tz):
    root = _fake_root(
        tmp_path,
        **{
            "C--proj-a": [(fixtures_dir / "engagement-parallel-a.jsonl", "aaaa1111")],
            "C--proj-b": [(fixtures_dir / "engagement-parallel-b.jsonl", "bbbb2222")],
        },
    )
    data = _build(root)
    by_uuid = {s["summary"]["uuid"]: s for s in data["sessions"].values()}
    # Stream: 10:00 A, 10:10 B, 10:20 B, 10:30 A. Each segment goes to the
    # session of the LATER prompt: B gets 10:00–10:20 (20m), A gets 10:20–10:30
    # (10m). Total 30m == wall clock, not the naive 40m.
    assert by_uuid["bbbb2222"]["active"] == timedelta(minutes=20)
    assert by_uuid["aaaa1111"]["active"] == timedelta(minutes=10)
    total = sum((s["active"] for s in data["sessions"].values()), timedelta())
    assert total == timedelta(minutes=30)


def test_single_message_session(tmp_path, utc_tz):
    root = tmp_path / "projects"
    pd = root / "C--proj-a"
    pd.mkdir(parents=True)
    (pd / "dddd4444.jsonl").write_text(
        '{"type":"user","timestamp":"2026-05-01T10:00:00Z",'
        '"message":{"role":"user","content":"one and done"}}\n',
        encoding="utf-8",
    )
    data = _build(root)
    (s,) = data["sessions"].values()
    assert s["active"] == timedelta(0)
    assert s["user_messages"] == 1


def test_report_scope_filters_but_stream_stays_global(fixtures_dir, tmp_path, utc_tz):
    root = _fake_root(
        tmp_path,
        **{
            "C--proj-a": [(fixtures_dir / "engagement-parallel-a.jsonl", "aaaa1111")],
            "C--proj-b": [(fixtures_dir / "engagement-parallel-b.jsonl", "bbbb2222")],
        },
    )
    data = _build(root, report_dirs=[root / "C--proj-a"])
    # Only A is reported, but B's prompts still split the stream — A gets its
    # interval-correct 10m, not a naive 30m.
    (s,) = data["sessions"].values()
    assert s["summary"]["uuid"] == "aaaa1111"
    assert s["active"] == timedelta(minutes=10)


# ── CLI ──────────────────────────────────────────────────────────────────────

def test_engagement_cli_text(cli_path, fixtures_dir, tmp_path):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "engagement", "--date", "2026-05-01",
    )
    assert r.returncode == 0
    assert "13m" in r.stdout
    assert "break=10m" in r.stdout
    assert "Breaks >10m" in r.stdout


def test_engagement_cli_json(cli_path, fixtures_dir, tmp_path):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "engagement", "--date", "2026-05-01", "--format", "json",
    )
    assert r.returncode == 0
    data = json.loads(r.stdout)
    assert data["break_minutes"] == 10
    assert data["totals"]["active_minutes"] == 13
    assert data["totals"]["sessions"] == 1
    s = data["sessions"][0]
    assert s["uuid"] == "aaaa1111"
    assert s["elapsed_minutes"] == 45
    assert s["ratio"] == round(13 / 45, 2)
    assert len(data["stream_breaks"]) == 1
    assert data["stream_breaks"][0]["minutes"] == 32


def test_engagement_cli_file_window_derived(cli_path, fixtures_dir, tmp_path):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-waiting.jsonl", "bbbb2222")]}
    )
    f = root / "C--proj-a" / "bbbb2222.jsonl"
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "engagement", "--file", str(f),
    )
    assert r.returncode == 0
    assert "32m" in r.stdout
    assert "Prompt gaps" in r.stdout


def test_engagement_cli_custom_break(cli_path, fixtures_dir, tmp_path):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "engagement", "--date", "2026-05-01",
        "--break", "1h", "--format", "json",
    )
    assert r.returncode == 0
    data = json.loads(r.stdout)
    # 1h threshold swallows the 32m gap — everything is active: 45m.
    assert data["totals"]["active_minutes"] == 45
    assert data["stream_breaks"] == []


def test_engagement_cli_invalid_break(cli_path, tmp_path):
    root = tmp_path / "projects"
    root.mkdir()
    r = _run_cli(
        cli_path, "--root", str(root),
        "--mode", "engagement", "--break", "soon",
    )
    assert r.returncode == 1


def test_engagement_cli_empty_range(cli_path, fixtures_dir, tmp_path):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "engagement", "--date", "2020-01-01",
    )
    assert r.returncode == 0
    assert "no user messages" in r.stdout
