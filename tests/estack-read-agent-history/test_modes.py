"""End-to-end CLI tests via subprocess.run.

Exercises mode dispatch + argument parsing. Library-level behavior is
covered by the unit tests in test_paths/parser/tools/search/subagents.
"""

import json
import os
import shutil
import subprocess
import sys



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


def test_last_mode(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "basic-session.jsonl"), "--mode", "last")
    assert r.returncode == 0
    assert "Here is help" in r.stdout


def test_last_default_role_is_assistant(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "role-mix.jsonl"), "--mode", "last")
    assert r.returncode == 0
    assert "Assistant message" in r.stdout
    assert "User message" not in r.stdout
    assert "Second real prompt" not in r.stdout


def test_last_role_user_excludes_meta_and_compact(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "role-mix.jsonl"),
        "--mode", "last", "--role", "user",
    )
    assert r.returncode == 0
    assert "Second real prompt" in r.stdout
    assert "First real prompt" in r.stdout
    assert "Injected hook context" not in r.stdout          # isMeta
    assert "tool output envelope" not in r.stdout           # tool_result envelope
    assert "being continued from a previous" not in r.stdout  # compact marker
    assert "Assistant message" not in r.stdout


def test_last_role_both_interleaves(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "role-mix.jsonl"),
        "--mode", "last", "--role", "both", "-n", "10",
    )
    assert r.returncode == 0
    assert "User message" in r.stdout
    assert "Assistant message" in r.stdout
    # Chronological: last message is the assistant's, preceded by the user's.
    assert r.stdout.index("Second real prompt") < r.stdout.index("Reply two")


def test_advisor_mode(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "with-advisor.jsonl"), "--mode", "advisor")
    assert r.returncode == 0
    assert "advisor" in r.stdout.lower()


def test_pre_compact_mode(cli_path, fixtures_dir):
    r = _run_cli(cli_path, "--file", str(fixtures_dir / "with-compact.jsonl"), "--mode", "pre-compact")
    assert r.returncode == 0
    assert "Pre-compact" in r.stdout or "First answer" in r.stdout


def test_tool_usage_skill_filter(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "tool-zoo.jsonl"),
        "--mode", "tool-usage", "--tool", "Skill",
    )
    assert r.returncode == 0
    assert "Skill" in r.stdout
    assert "using-superpowers" in r.stdout
    # Filtering to Skill must drop every other tool.
    assert "Bash" not in r.stdout
    assert "Glob" not in r.stdout


def test_tool_usage_until_keeps_in_window_calls(cli_path, fixtures_dir, tmp_path):
    # The tool-zoo calls are stamped 2026-05-01T10:00:0x. Copy the fixture, then
    # bump its mtime far past --until. A naive mtime filter would drop the file
    # and report zero; per-call timestamp filtering must still count the calls.
    import os
    fake_root = tmp_path / "projects"
    fake_proj = fake_root / "C--fake-proj"
    fake_proj.mkdir(parents=True)
    target = fake_proj / "a.jsonl"
    shutil.copy(fixtures_dir / "tool-zoo.jsonl", target)
    future = 1_900_000_000  # ~2030, well after the --until bound below
    os.utime(target, (future, future))
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--cwd", "C:\\fake\\proj",
        "--mode", "tool-usage", "--until", "2026-05-02", "--format", "json",
    )
    assert r.returncode == 0
    data = json.loads(r.stdout)
    assert data["total"] == 9, data  # all 9 calls are inside the window
    assert data["sessions"] == 1


def test_tool_usage_include_subagents(cli_path, fixtures_dir):
    # Parent calls: Skill(commit) + Agent. Subagent calls: Skill(estack-repo-search) + Bash.
    # --include-subagents must fold the subagent's calls in, without counting the
    # subagent as its own session.
    parent = fixtures_dir / "tool-usage-parent.jsonl"
    without = json.loads(_run_cli(
        cli_path, "--file", str(parent), "--mode", "tool-usage", "--format", "json",
    ).stdout)
    assert without["total"] == 2
    assert without["sessions"] == 1
    assert {s["skill"] for s in without["skills"]} == {"commit"}

    with_sub = json.loads(_run_cli(
        cli_path, "--file", str(parent), "--mode", "tool-usage",
        "--include-subagents", "--format", "json",
    ).stdout)
    assert with_sub["total"] == 4  # +Skill(estack-repo-search) +Bash
    assert with_sub["sessions"] == 1  # subagent is not a separate session
    assert {s["skill"] for s in with_sub["skills"]} == {"commit", "estack-repo-search"}


def test_subagent_finals(cli_path, fixtures_dir):
    r = _run_cli(
        cli_path, "--file", str(fixtures_dir / "subagent-parent.jsonl"),
        "--mode", "subagent-finals",
    )
    assert r.returncode == 0
    assert "Found it" in r.stdout


def test_whoami_no_session_id(cli_path, tmp_path):
    # Both env vars unset (or blanked out) — no live session to resolve.
    env = dict(os.environ)
    env.pop("CLAUDE_CODE_SESSION_ID", None)
    env.pop("CLAUDE_SESSION_ID", None)
    r = subprocess.run(
        [sys.executable, str(cli_path), "--root", str(tmp_path), "--mode", "whoami"],
        capture_output=True, text=True, encoding="utf-8",
        env={**env, "PYTHONIOENCODING": "utf-8"},
    )
    assert r.returncode == 1
    assert "CLAUDE_CODE_SESSION_ID" in r.stdout


def test_whoami_resolves_via_real_claude_code_env_var(cli_path, fixtures_dir, tmp_path):
    # CLAUDE_CODE_SESSION_ID is the actual OS env var Claude Code sets in a live
    # session (confirmed against a real session's process environment).
    # CLAUDE_SESSION_ID is a DIFFERENT thing — a SKILL.md text substitution,
    # never exported as a real env var — so this is the path real usage hits.
    fake_root = tmp_path / "projects"
    fake_proj = fake_root / "C--fake-proj"
    fake_proj.mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", fake_proj / "real.jsonl")
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--cwd", "C:\\fake\\proj", "--mode", "whoami",
        env_overrides={"CLAUDE_CODE_SESSION_ID": "real"},
    )
    assert r.returncode == 0
    assert "real.jsonl" in r.stdout


def test_whoami_wrong_cwd_falls_back_to_full_scan(cli_path, fixtures_dir, tmp_path):
    # --cwd points at a project dir that doesn't exist (or doesn't hold the
    # session) — whoami must still find it by scanning every project under
    # --root, not just report failure because the fast path missed.
    fake_root = tmp_path / "projects"
    right_proj = fake_root / "C--right-proj"
    right_proj.mkdir(parents=True)
    (fake_root / "C--other-proj").mkdir(parents=True)
    shutil.copy(fixtures_dir / "basic-session.jsonl", right_proj / "cur.jsonl")
    r = _run_cli(
        cli_path, "--root", str(fake_root), "--cwd", "C:\\nonexistent\\proj", "--mode", "whoami",
        env_overrides={"CLAUDE_SESSION_ID": "cur"},
    )
    assert r.returncode == 0
    assert "cur.jsonl" in r.stdout


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


