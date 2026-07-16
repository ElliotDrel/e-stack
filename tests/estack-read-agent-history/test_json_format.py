"""Tests for --format json across modes."""

import json
import os
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


