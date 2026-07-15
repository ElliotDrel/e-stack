"""Tests for the timeline mode (build/render/gap parsing + CLI)."""

import os
import shutil
import subprocess
import sys
from datetime import datetime

import pytest

import read_transcript as RT


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
def fake_root(fixtures_dir, tmp_path):
    root = tmp_path / "projects"
    proj = root / "C--fake-proj"
    proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "timeline-day-test.jsonl", proj / "abc12345.jsonl")
    return root


# ── unit: gap + duration helpers ─────────────────────────────────────────────

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
    assert "2 block(s)" in r.stdout
    # Timeline makes no attention claim — that's engagement mode's job.
    assert "active" not in r.stdout


