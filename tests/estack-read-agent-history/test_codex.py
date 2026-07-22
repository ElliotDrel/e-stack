"""Tests for Codex (OpenAI codex-cli) history support.

Covers the normalization adapter (lib/codex.py), the parse_lines routing, and
the --agent flag on the cross-session CLI modes. Codex discovery is pointed at a
fixture tree via the ESTACK_CODEX_SESSIONS_DIR env var so nothing touches the
real ~/.codex.
"""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime

import pytest

import read_transcript as RT
from lib import codex as CX
from lib import parser as PR


# ── rollout builder ──────────────────────────────────────────────────────────

def _line(ts, typ, payload):
    return json.dumps({"timestamp": ts, "type": typ, "payload": payload})


def write_rollout(dirpath, uuid, cwd="C:\\Users\\me\\proj", day="2026-05-01"):
    """Write a minimal-but-representative Codex rollout, return its Path.

    Two user prompts, two agent messages, one exec tool call, one applied patch.
    """
    dirpath.mkdir(parents=True, exist_ok=True)
    f = dirpath / f"rollout-{day}T10-00-00-{uuid}.jsonl"
    lines = [
        _line(f"{day}T10:00:00.000Z", "session_meta",
              {"type": "session_meta", "session_id": uuid, "id": uuid, "cwd": cwd,
               "originator": "codex-tui", "cli_version": "0.144.4"}),
        _line(f"{day}T10:00:01.000Z", "event_msg",
              {"type": "task_started", "turn_id": "t1"}),
        _line(f"{day}T10:00:02.000Z", "event_msg",
              {"type": "user_message", "message": "add a widget to the dashboard"}),
        _line(f"{day}T10:00:05.000Z", "response_item",
              {"type": "reasoning", "summary": []}),  # encrypted → dropped
        _line(f"{day}T10:00:06.000Z", "event_msg",
              {"type": "agent_message", "message": "On it.", "phase": "commentary"}),
        _line(f"{day}T10:00:07.000Z", "response_item",
              {"type": "custom_tool_call", "name": "exec", "call_id": "c1",
               "input": "tools.shell_command({command:'ls'})"}),
        _line(f"{day}T10:00:08.000Z", "event_msg",
              {"type": "patch_apply_end", "call_id": "c1", "success": True,
               "changes": {f"{cwd}\\widget.js": {"type": "add", "content": "x"}}}),
        _line(f"{day}T10:04:00.000Z", "event_msg",
              {"type": "user_message", "message": "now write a test"}),
        _line(f"{day}T10:04:03.000Z", "event_msg",
              {"type": "agent_message", "message": "Done — widget added and tested.",
               "phase": "final_answer"}),
        _line(f"{day}T10:04:04.000Z", "event_msg",
              {"type": "patch_apply_end", "call_id": "c2", "success": True,
               "changes": {f"{cwd}\\widget.test.js": {"type": "update", "content": "y"}}}),
        _line(f"{day}T10:04:05.000Z", "event_msg",
              {"type": "token_count", "info": {"total_token_usage": {"total_tokens": 1}}}),
    ]
    f.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return f


@pytest.fixture
def codex_tree(tmp_path):
    """A fixture ~/.codex/sessions tree with one rollout on 2026-05-01."""
    root = tmp_path / "codex-sessions"
    write_rollout(root / "2026" / "05" / "01", "aaaa1111-2222-3333-4444-555566667777")
    return root


@pytest.fixture
def claude_root(fixtures_dir, tmp_path):
    """A fake Claude projects root carrying the shared timeline-day fixture."""
    root = tmp_path / "projects"
    proj = root / "C--fake-proj"
    proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "timeline-day-test.jsonl", proj / "abc12345.jsonl")
    return root


def _run_cli(cli_path, *args, codex_dir=None):
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env.pop("CLAUDE_CODE_SESSION_ID", None)
    env.pop("CLAUDE_SESSION_ID", None)
    if codex_dir is not None:
        env["ESTACK_CODEX_SESSIONS_DIR"] = str(codex_dir)
    else:
        env.pop("ESTACK_CODEX_SESSIONS_DIR", None)
    return subprocess.run(
        [sys.executable, str(cli_path), *args],
        capture_output=True, text=True, encoding="utf-8", env=env,
    )


# ── detection / identity ─────────────────────────────────────────────────────

def test_is_codex_rollout(tmp_path):
    assert CX.is_codex_rollout(tmp_path / "rollout-2026-05-01T10-00-00-uuid.jsonl")
    assert not CX.is_codex_rollout(tmp_path / "abc12345.jsonl")
    assert not CX.is_codex_rollout(tmp_path / "rollout-2026.txt")


# ── normalization ────────────────────────────────────────────────────────────

def test_normalize_rollout_messages_and_tools(codex_tree):
    f = next(codex_tree.rglob("rollout-*.jsonl"))
    entries = CX.normalize_rollout(f)
    # Two real user prompts survive; task_started/token_count/reasoning dropped.
    users = [e for e in entries if PR.classify_entry(e) == "user"]
    assert len(users) == 2
    assert users[0]["message"]["content"][0]["text"] == "add a widget to the dashboard"
    # Assistant text messages (agent_message) both present.
    assistant_texts = [
        b["text"]
        for e in entries if e["type"] == "assistant"
        for b in e["message"]["content"] if b.get("type") == "text"
    ]
    assert "On it." in assistant_texts
    assert "Done — widget added and tested." in assistant_texts


def test_normalize_rollout_file_edits(codex_tree):
    from lib import tools as T
    f = next(codex_tree.rglob("rollout-*.jsonl"))
    files = T.files_touched(CX.normalize_rollout(f))
    names = {p.name for p in files}
    assert "widget.js" in names
    assert "widget.test.js" in names


# ── session_summary (routes through parse_lines) ─────────────────────────────

def test_session_summary_codex(codex_tree):
    f = next(codex_tree.rglob("rollout-*.jsonl"))
    s = PR.session_summary(f)
    assert s["source"] == "codex"
    assert s["uuid"] == "aaaa1111-2222-3333-4444-555566667777"
    assert s["decoded_project"]  # derived from session_meta cwd, not the day dir
    assert s["subagent_count"] == 0
    assert s["status"] == "clean"  # no dangling tool_use ids → not "interrupted"


# ── discovery ────────────────────────────────────────────────────────────────

def test_list_codex_sessions_project_filter(codex_tree, monkeypatch):
    monkeypatch.setenv("ESTACK_CODEX_SESSIONS_DIR", str(codex_tree))
    assert len(CX.list_codex_sessions(project="proj")) == 1
    assert len(CX.list_codex_sessions(project="nonexistent")) == 0


# ── CLI: single-file ─────────────────────────────────────────────────────────

def test_cli_brief_codex_file(cli_path, codex_tree):
    f = next(codex_tree.rglob("rollout-*.jsonl"))
    r = _run_cli(cli_path, "--file", str(f), "--mode", "brief")
    assert r.returncode == 0
    assert "add a widget" in r.stdout
    assert "subagents: 0" in r.stdout


# ── CLI: --agent selection ───────────────────────────────────────────────────

def test_cli_list_agent_codex_only(cli_path, claude_root, codex_tree):
    r = _run_cli(cli_path, "--root", str(claude_root), "--mode", "list",
                 "--all-projects", "--agent", "codex", codex_dir=codex_tree)
    assert r.returncode == 0
    assert "codex▹" in r.stdout
    assert "abc12345" not in r.stdout  # the Claude session is excluded


def test_cli_list_agent_claude_excludes_codex(cli_path, claude_root, codex_tree):
    r = _run_cli(cli_path, "--root", str(claude_root), "--mode", "list",
                 "--all-projects", "--agent", "claude", codex_dir=codex_tree)
    assert r.returncode == 0
    assert "codex▹" not in r.stdout


def test_cli_timeline_both_merges(cli_path, claude_root, codex_tree):
    r = _run_cli(cli_path, "--root", str(claude_root), "--tz", "UTC",
                 "--mode", "timeline", "--date", "2026-05-01", "--agent", "both",
                 codex_dir=codex_tree)
    assert r.returncode == 0
    assert "codex ▹" in r.stdout          # codex session present
    assert "2 session(s)" in r.stdout      # claude + codex


def test_cli_engagement_codex_active_time(cli_path, claude_root, codex_tree):
    r = _run_cli(cli_path, "--root", str(claude_root), "--tz", "UTC",
                 "--mode", "engagement", "--date", "2026-05-01", "--agent", "codex",
                 codex_dir=codex_tree)
    assert r.returncode == 0
    assert "codex ▹" in r.stdout
    assert "you 2" in r.stdout  # two real user prompts counted


def test_cli_lookup_codex(cli_path, claude_root, codex_tree):
    r = _run_cli(cli_path, "--root", str(claude_root), "--mode", "lookup",
                 "--uuid", "aaaa1111", codex_dir=codex_tree)
    assert r.returncode == 0
    assert "rollout-" in r.stdout


def test_cli_engagement_no_codex_when_disabled(cli_path, claude_root, codex_tree):
    # No env override + a non-live --root → Codex gate is closed even with
    # --agent both, so the real ~/.codex never leaks into a scoped run.
    r = _run_cli(cli_path, "--root", str(claude_root), "--tz", "UTC",
                 "--mode", "timeline", "--date", "2026-05-01", "--agent", "both",
                 codex_dir=None)
    assert r.returncode == 0
    assert "codex ▹" not in r.stdout
