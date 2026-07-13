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


def test_assistant_message_count_excludes_tool_only_turns(tmp_path, utc_tz):
    root = tmp_path / "projects"
    pd = root / "C--proj-a"
    pd.mkdir(parents=True)
    (pd / "eeee5555.jsonl").write_text(
        # real user prompt
        '{"type":"user","timestamp":"2026-05-01T10:00:00Z",'
        '"message":{"role":"user","content":"hello"}}\n'
        # assistant text reply — counts
        '{"type":"assistant","timestamp":"2026-05-01T10:01:00Z",'
        '"message":{"role":"assistant","content":[{"type":"text","text":"hi there"}]}}\n'
        # assistant tool-only turn — does NOT count (no visible text)
        '{"type":"assistant","timestamp":"2026-05-01T10:02:00Z",'
        '"message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{}}]}}\n'
        # tool result (user-role envelope) — not a user prompt, not an assistant msg
        '{"type":"user","timestamp":"2026-05-01T10:03:00Z",'
        '"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"ok"}]}}\n'
        # second real user prompt
        '{"type":"user","timestamp":"2026-05-01T10:05:00Z",'
        '"message":{"role":"user","content":"do x"}}\n'
        # assistant text reply — counts
        '{"type":"assistant","timestamp":"2026-05-01T10:06:00Z",'
        '"message":{"role":"assistant","content":[{"type":"text","text":"done"}]}}\n',
        encoding="utf-8",
    )
    data = _build(root)
    (s,) = data["sessions"].values()
    assert s["user_messages"] == 2          # only the two typed prompts
    assert s["assistant_messages"] == 2     # tool-only turn excluded
    assert s["active"] == timedelta(minutes=5)


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


def test_engagement_json_has_assistant_messages(cli_path, fixtures_dir, tmp_path):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "engagement", "--date", "2026-05-01", "--format", "json",
    )
    assert r.returncode == 0
    data = json.loads(r.stdout)
    assert "assistant_messages" in data["sessions"][0]


# ── session-report mode ───────────────────────────────────────────────────────

def test_session_report_cli_text(cli_path, fixtures_dir, tmp_path):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "session-report", "--date", "2026-05-01",
    )
    assert r.returncode == 0
    assert "Session report" in r.stdout
    assert "1. " in r.stdout                 # numbered block
    assert "ran" in r.stdout and "active" in r.stdout  # both clocks
    assert "you" in r.stdout and "assistant" in r.stdout
    assert "intent:" in r.stdout and "last:" in r.stdout


def test_session_report_cli_json(cli_path, fixtures_dir, tmp_path):
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "session-report", "--date", "2026-05-01", "--format", "json",
    )
    assert r.returncode == 0
    data = json.loads(r.stdout)
    assert data["totals"]["sessions"] == 1
    s = data["sessions"][0]
    for key in ("user_messages", "assistant_messages", "intent",
                "last_message", "elapsed_minutes", "active_minutes", "edits"):
        assert key in s


def test_report_modes_emit_12h_with_24h_parens(cli_path, fixtures_dir, tmp_path):
    """session-report, engagement, and timeline render clock times as
    '7:00pm (19:00)' — 12-hour with 24-hour in parens — deterministically."""
    import re
    fmt = re.compile(r"\d{1,2}:\d{2}(?:am|pm) \(\d{2}:\d{2}\)")
    root = _fake_root(
        tmp_path, **{"C--proj-a": [(fixtures_dir / "engagement-gaps.jsonl", "aaaa1111")]}
    )
    for mode in ("session-report", "engagement", "timeline"):
        r = _run_cli(
            cli_path, "--root", str(root), "--tz", "UTC",
            "--mode", mode, "--date", "2026-05-01",
        )
        assert r.returncode == 0, mode
        assert fmt.search(r.stdout), f"{mode} missing 12h(24h) time: {r.stdout[:300]}"
        # The header advertises the convention.
        assert "12h (24h)" in r.stdout, mode


def test_session_report_chronological_order(cli_path, fixtures_dir, tmp_path):
    """Sessions render oldest-first by their first user prompt."""
    root = _fake_root(
        tmp_path,
        **{
            "C--proj-a": [(fixtures_dir / "engagement-parallel-a.jsonl", "aaaa1111")],
            "C--proj-b": [(fixtures_dir / "engagement-parallel-b.jsonl", "bbbb2222")],
        },
    )
    r = _run_cli(
        cli_path, "--root", str(root), "--tz", "UTC",
        "--mode", "session-report", "--date", "2026-05-01", "--format", "json",
    )
    assert r.returncode == 0
    data = json.loads(r.stdout)
    firsts = [s["first"] for s in data["sessions"]]
    assert firsts == sorted(firsts)
