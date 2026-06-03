"""End-to-end CLI tests via subprocess.run.

Exercises mode dispatch + argument parsing. Library-level behavior is
covered by the unit tests in test_paths/parser/tools/search/subagents.
"""

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
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        [sys.executable, str(cli_path), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )


def test_help(cli_path):
    r = _run_cli(cli_path, "--help")
    assert r.returncode == 0
    assert "--mode" in r.stdout


def test_last_mode(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "basic-session.jsonl"), "--mode", "last")
    assert r.returncode == 0
    assert "Here is help" in r.stdout


def test_advisor_mode(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "with-advisor.jsonl"), "--mode", "advisor")
    assert r.returncode == 0
    assert "advisor" in r.stdout.lower()


def test_pre_compact_mode(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "with-compact.jsonl"), "--mode", "pre-compact")
    assert r.returncode == 0
    assert "Pre-compact" in r.stdout or "First answer" in r.stdout


def test_debug_mode(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "basic-session.jsonl"), "--mode", "debug")
    assert r.returncode == 0
    assert "Entry type distribution" in r.stdout


def test_brief_mode(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"), "--mode", "brief")
    assert r.returncode == 0
    body = r.stdout
    # 6 lines expected
    assert "intent:" in body
    assert "last:" in body
    assert "edits:" in body
    assert "tools:" in body
    assert "subagents:" in body


def test_brief_with_include_subagents(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "subagent-parent.jsonl"),
        "--mode", "brief", "--include-subagents",
    )
    assert r.returncode == 0
    assert "subagent" in r.stdout.lower()
    assert "Found it" in r.stdout


def test_changelog(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"), "--mode", "changelog")
    assert r.returncode == 0
    assert "Bash" in r.stdout
    assert "Read" in r.stdout


def test_file_edits(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"), "--mode", "file-edits")
    assert r.returncode == 0
    assert "foo.py" in r.stdout
    assert "bar.py" in r.stdout


def test_tool_calls(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"), "--mode", "tool-calls")
    assert r.returncode == 0
    assert "Bash" in r.stdout


def test_tool_calls_filter(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"),
        "--mode", "tool-calls", "--tool", "Bash",
    )
    assert r.returncode == 0
    assert "Bash" in r.stdout
    assert "Glob" not in r.stdout


def test_subagent_list(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "subagent-parent.jsonl"),
        "--mode", "subagent-list",
    )
    assert r.returncode == 0
    assert "agent-xyz123" in r.stdout


def test_subagent_finals(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "subagent-parent.jsonl"),
        "--mode", "subagent-finals",
    )
    assert r.returncode == 0
    assert "Found it" in r.stdout


def test_diff_mode(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--mode", "diff",
        "--file-a", str(fixtures_dir / "basic-session.jsonl"),
        "--file-b", str(fixtures_dir / "with-thinking.jsonl"),
    )
    assert r.returncode == 0
    assert "A>" in r.stdout
    assert "B>" in r.stdout


def test_lookup_no_match(cli_path, fixtures_dir, tmp_path):
    # Point --root at an empty dir so lookup definitely misses
    r = _run_cli(cli_path, "--root", str(tmp_path), "--mode", "lookup", "--uuid", "nope")
    assert r.returncode == 1


def test_list_legacy_format(cli_path, fixtures_dir, tmp_path):
    # Build a fake project root + cwd that matches encoding
    fake_root = tmp_path / "projects"
    fake_proj = fake_root / "C--fake-proj"
    fake_proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", fake_proj / "abc.jsonl")
    r = _run_cli(cli_path, "--root", str(fake_root), "--cwd", "C:\\fake\\proj", "--list")
    assert r.returncode == 0
    assert "abc.jsonl" in r.stdout


def test_exclude_current(cli_path, fixtures_dir, tmp_path):
    fake_root = tmp_path / "projects"
    fake_proj = fake_root / "C--fake-proj"
    fake_proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", fake_proj / "abc.jsonl")
    shutil.copy(fixtures_dir / "tool-zoo.jsonl", fake_proj / "def.jsonl")
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--cwd", "C:\\fake\\proj",
        "--mode", "list", "--exclude-current",
        env_overrides={"CLAUDE_SESSION_ID": "abc"},
    )
    assert r.returncode == 0
    assert "def" in r.stdout
    assert "abc" not in r.stdout


def test_dump_large_file_degrades(cli_path, fixtures_dir, tmp_path):
    # Build a 6MB padded fixture by writing many valid lines
    big = tmp_path / "big.jsonl"
    line = '{"type":"user","timestamp":"2026-05-01T10:00:00Z","message":{"role":"user","content":"'
    pad = "x" * 1000 + '"}}\n'
    with open(big, "w", encoding="utf-8") as f:
        # Each line ~1KB → write ~7000 to hit 6MB+
        for _ in range(7000):
            f.write(line + pad)
    r = _run_cli(cli_path, "--file", str(big), "--mode", "dump")
    assert r.returncode == 0
    assert "degraded" in r.stderr.lower()


def test_dump_large_file_force(cli_path, tmp_path):
    big = tmp_path / "big.jsonl"
    line = '{"type":"user","timestamp":"2026-05-01T10:00:00Z","message":{"role":"user","content":"'
    pad = "x" * 1000 + '"}}\n'
    with open(big, "w", encoding="utf-8") as f:
        for _ in range(7000):
            f.write(line + pad)
    r = _run_cli(cli_path, "--file", str(big), "--mode", "dump", "--force-dump")
    assert r.returncode == 0
    # No degrade note when forced
    assert "degraded" not in r.stderr.lower()
