"""Tests for cross-scope search output budgeting: summary-by-default, --full,
the char-budget degrade, and TTY-gated progress."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

import read_transcript as RT
from lib.search import Match


def _run_cli(cli_path, *args):
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, str(cli_path), *args],
        capture_output=True, text=True, encoding="utf-8", env=env,
    )


# A realistic epoch base so _fmt_mtime renders sane dates if output is printed.
_BASE_MTIME = 1_700_000_000


def _mk(stem, project, mtime, window, role="assistant", where="text"):
    sp = Path("/root") / project / f"{stem}.jsonl"
    return Match(session_path=sp, mtime=mtime, role=role, where=where,
                 timestamp=None, window_text=window)


@pytest.fixture
def wide_root(fixtures_dir, tmp_path):
    """A fake projects root with two projects, each holding a session."""
    root = tmp_path / "projects"
    keel = root / "C--Users-x-Keel-Project"
    other = root / "C--Users-x-Other-Claude-Code"
    keel.mkdir(parents=True)
    other.mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", keel / "keelsession.jsonl")
    shutil.copy(fixtures_dir / "basic-session.jsonl", other / "othersession.jsonl")
    return root


# ── unit: renderers ──────────────────────────────────────────────────────────

def test_one_line_collapses_and_truncates():
    assert RT._one_line("a\n  b   c", 100) == "a b c"
    assert RT._one_line("x" * 200, 10) == "x" * 10 + "…"
    assert RT._one_line("", 10) == ""


def test_summary_counts_all_hits_and_orders_newest_first():
    matches = [
        _mk("aaaaaaaa11", "C--Users-x-Proj", _BASE_MTIME, "hello world"),
        _mk("aaaaaaaa11", "C--Users-x-Proj", _BASE_MTIME, "hello again"),
        _mk("bbbbbbbb22", "C--Users-x-Proj", _BASE_MTIME + 100, "hello there"),
    ]
    out = RT._render_search_summary("hello", matches)
    assert '"hello": 3 matches across 2 sessions' in out
    assert "2 hits" in out  # the aaaa session has 2
    # bbbb (BASE+100, newer) sorts before aaaa (BASE, older) — newest first
    assert out.index("bbbbbbbb") < out.index("aaaaaaaa")
    assert "--- Match #" not in out  # no full windows in summary


def test_summary_caps_sessions_but_counts_all(monkeypatch):
    monkeypatch.setattr(RT, "SEARCH_SUMMARY_SESSION_CAP", 2)
    matches = [_mk(f"sess{i:04d}xx", "C--Users-x-Proj", _BASE_MTIME + i, "hit") for i in range(5)]
    out = RT._render_search_summary("hit", matches)
    assert "5 matches across 5 sessions" in out  # header counts everything
    assert "3 more session" in out  # 5 total - 2 shown


def test_search_summary_json_has_no_windows():
    matches = [_mk("aaaaaaaa11", "C--Users-x-My-Proj", _BASE_MTIME, "hello world snippet")]
    js = RT._search_summary_json(matches)
    assert js[0]["uuid"] == "aaaaaaaa11"
    assert js[0]["hits"] == 1
    assert "window" not in js[0]
    assert js[0]["first_snippet"] == "hello world snippet"


def test_single_file_full_degrades_to_summary_when_oversized(monkeypatch, fixtures_dir):
    # Even a single-file search degrades if its full windows exceed the budget.
    monkeypatch.setattr(RT, "SEARCH_CHAR_BUDGET", 10)
    out = RT.mode_search_v2(
        root=Path("."), cwd=None, all_projects=False,
        file_path=fixtures_dir / "basic-session.jsonl",
        query="Hello", role="both", in_channel="text",
        since=None, until=None, fmt="text",
    )
    assert out.startswith("[note: full output")
    assert '"Hello":' in out  # summary header is appended after the note


def test_wide_full_degrades_to_summary_when_oversized(monkeypatch, wide_root):
    # The advertised path: wide scope + --full, oversized, degrades to summary.
    monkeypatch.setattr(RT, "SEARCH_CHAR_BUDGET", 10)
    out = RT.mode_search_v2(
        root=wide_root, cwd=None, all_projects=True, file_path=None,
        query="Hello", role="both", in_channel="text",
        since=None, until=None, fmt="text", full=True,
    )
    assert out.startswith("[note: full output")
    assert "matches across" in out  # summary header appended
    assert "--- Match #" not in out  # degraded — no windows survive


# ── CLI: end-to-end ──────────────────────────────────────────────────────────

def test_wide_search_summarizes_by_default(cli_path, wide_root):
    r = _run_cli(cli_path, "--root", str(wide_root), "--mode", "search",
                 "--query", "Hello", "--all-projects")
    assert r.returncode == 0
    assert '"Hello":' in r.stdout and "matches across" in r.stdout  # real summary header
    assert "--- Match #" not in r.stdout  # summary, not windows


def test_wide_search_full_shows_windows(cli_path, wide_root):
    r = _run_cli(cli_path, "--root", str(wide_root), "--mode", "search",
                 "--query", "Hello", "--all-projects", "--full")
    assert r.returncode == 0
    assert "--- Match #" in r.stdout  # full windows present


def test_progress_suppressed_when_stderr_not_a_tty(cli_path, wide_root):
    # stderr is captured (not a TTY) — the Searching i/N progress must not appear.
    r = _run_cli(cli_path, "--root", str(wide_root), "--mode", "search",
                 "--query", "Hello", "--all-projects")
    assert "Searching" not in r.stderr


def test_cwd_search_matches_user_messages(cli_path, wide_root):
    # "Hello" lives only in the user message of basic-session.jsonl. A --cwd
    # search now routes through mode_search_v2 (role=both), so it must be found —
    # the old assistant-only --cwd path would have missed it.
    found = _run_cli(cli_path, "--root", str(wide_root), "--mode", "search",
                     "--query", "Hello", "--cwd", "Keel")
    assert found.returncode == 0
    assert '"Hello":' in found.stdout and "across" in found.stdout
    assert "keelsess" in found.stdout

    # Restricting to assistant role excludes the user-only hit.
    asst = _run_cli(cli_path, "--root", str(wide_root), "--mode", "search",
                    "--query", "Hello", "--cwd", "Keel", "--role", "assistant")
    assert asst.returncode == 0
    assert "No matches" in asst.stdout


def test_json_role_filter_excludes_user_only_match(cli_path, wide_root):
    # JSON path honors --role too: assistant-only over a user-only term → empty list.
    r = _run_cli(cli_path, "--root", str(wide_root), "--mode", "search",
                 "--query", "Hello", "--cwd", "Keel",
                 "--role", "assistant", "--format", "json")
    assert r.returncode == 0
    assert json.loads(r.stdout) == []
