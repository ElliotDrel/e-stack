"""Tests for --format json across modes."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


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


def _json(r):
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def test_last_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "basic-session.jsonl"),
        "--mode", "last", "--format", "json",
    ))
    assert isinstance(data, list)
    assert data[-1]["n_from_end"] == 1
    assert "Here is help" in data[-1]["text"]


def test_last_json_role_user(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "role-mix.jsonl"),
        "--mode", "last", "--role", "user", "--format", "json",
    ))
    assert [m["role"] for m in data] == ["user", "user"]
    assert data[-1]["n_from_end"] == 1
    assert data[-1]["text"] == "Second real prompt"


def test_json_alias_flag(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "basic-session.jsonl"),
        "--mode", "last", "--json",
    ))
    assert isinstance(data, list)


def test_advisor_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "with-advisor.jsonl"),
        "--mode", "advisor", "--format", "json",
    ))
    assert data == ["The advisor says do X then Y."]


def test_pre_compact_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "with-compact.jsonl"),
        "--mode", "pre-compact", "--format", "json",
    ))
    assert data["found_compact"] is True
    assert any("First answer" in m["text"] for m in data["messages"])


def test_dump_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "basic-session.jsonl"),
        "--mode", "dump", "--format", "json",
    ))
    assert isinstance(data, list)
    assert data[0]["role"] == "user"


def test_debug_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "with-advisor.jsonl"),
        "--mode", "debug", "--format", "json",
    ))
    assert data["advisor_blocks"] == 1
    assert "entry_types" in data


def test_brief_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"),
        "--mode", "brief", "--format", "json",
    ))
    assert data["exists"] is True
    assert data["tool_counts"]["Bash"] == 1
    assert isinstance(data["files_touched"], list)


def test_changelog_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"),
        "--mode", "changelog", "--format", "json",
    ))
    assert len(data) == 9
    assert data[0]["tool"] == "Bash"
    assert "input" not in data[0]


def test_tool_calls_json_includes_input(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"),
        "--mode", "tool-calls", "--format", "json", "--tool", "Bash",
    ))
    assert len(data) == 1
    assert data[0]["input"]["command"] == "ls -la /tmp"


def test_file_edits_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"),
        "--mode", "file-edits", "--format", "json",
    ))
    paths = [row["path"] for row in data]
    assert any("foo.py" in p for p in paths)


def test_subagent_finals_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "subagent-parent.jsonl"),
        "--mode", "subagent-finals", "--format", "json",
    ))
    assert data[0]["agentType"] == "Explore"
    assert "Found it" in data[0]["text"]


def test_search_json_single_file(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--file", str(fixtures_dir / "basic-session.jsonl"),
        "--mode", "search", "--query", "help", "--format", "json",
    ))
    assert len(data) == 1
    assert data[0]["role"] == "assistant"


def test_list_json(cli_path, fixtures_dir, tmp_path):
    fake_root = tmp_path / "projects"
    fake_proj = fake_root / "C--fake-proj"
    fake_proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", fake_proj / "abc.jsonl")
    data = _json(_run_cli(
        cli_path, "--root", str(fake_root), "--all-projects",
        "--mode", "list", "--format", "json",
    ))
    assert len(data) == 1
    assert data[0]["uuid"] == "abc"


def test_journal_json(cli_path, fixtures_dir, tmp_path):
    fake_root = tmp_path / "projects"
    fake_proj = fake_root / "C--fake-proj"
    fake_proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "tool-zoo.jsonl", fake_proj / "def.jsonl")
    data = _json(_run_cli(
        cli_path, "--root", str(fake_root), "--all-projects",
        "--mode", "journal", "--since", "2020-01-01", "--format", "json",
    ))
    assert data[0]["uuid"] == "def"
    assert data[0]["tool_counts"]["Bash"] == 1


def test_count_json(cli_path, fixtures_dir, tmp_path):
    fake_root = tmp_path / "projects"
    fake_proj = fake_root / "C--fake-proj"
    fake_proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", fake_proj / "abc.jsonl")
    data = _json(_run_cli(
        cli_path, "--root", str(fake_root), "--all-projects",
        "--mode", "count", "--query", "help", "--format", "json",
    ))
    assert data == {"sessions": 1, "messages": 2, "matches": 1}


def test_count_text_unchanged(cli_path, fixtures_dir, tmp_path):
    fake_root = tmp_path / "projects"
    fake_proj = fake_root / "C--fake-proj"
    fake_proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", fake_proj / "abc.jsonl")
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--all-projects",
        "--mode", "count", "--query", "help",
    )
    assert r.returncode == 0
    assert r.stdout.strip() == "1"
    assert "1 sessions" in r.stderr


def test_diff_json(cli_path, fixtures_dir):
    data = _json(_run_cli(
        cli_path, "--mode", "diff",
        "--file-a", str(fixtures_dir / "basic-session.jsonl"),
        "--file-b", str(fixtures_dir / "with-thinking.jsonl"),
        "--format", "json",
    ))
    sources = {m["source"] for m in data["messages"]}
    assert sources == {"A", "B"}
