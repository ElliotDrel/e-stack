"""Dump-mode role and time-window filtering.

Regression cover for the 2026-08-17 bug: `--role`, `--since`, and `--until`
were accepted by `--mode dump` and silently ignored, so a five-minute request
returned the whole session in both roles. Callers stopped trusting the CLI and
hand-rolled their own parsers instead.
"""

import json
import os
import subprocess
import sys


def _run(cli_path, *args):
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, str(cli_path), *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
    )


def _json_messages(cli_path, *args):
    p = _run(cli_path, "--format", "json", *args)
    assert p.returncode == 0, p.stderr
    data = json.loads(p.stdout)
    return data if isinstance(data, list) else data["messages"]


def test_role_user_returns_only_user(cli_path, fixtures_dir):
    msgs = _json_messages(cli_path, "--mode", "dump",
                          "--file", str(fixtures_dir / "role-mix.jsonl"),
                          "--role", "user")
    assert msgs, "expected the human's prompts"
    assert {m["role"] for m in msgs} == {"user"}


def test_role_assistant_returns_only_assistant(cli_path, fixtures_dir):
    msgs = _json_messages(cli_path, "--mode", "dump",
                          "--file", str(fixtures_dir / "role-mix.jsonl"),
                          "--role", "assistant")
    assert msgs
    assert {m["role"] for m in msgs} == {"assistant"}


def test_role_default_is_both(cli_path, fixtures_dir):
    msgs = _json_messages(cli_path, "--mode", "dump",
                          "--file", str(fixtures_dir / "role-mix.jsonl"))
    assert {m["role"] for m in msgs} == {"user", "assistant"}


def test_role_filter_excludes_hook_injections(cli_path, fixtures_dir):
    """A role filter must not resurrect the isMeta noise get_messages drops."""
    msgs = _json_messages(cli_path, "--mode", "dump",
                          "--file", str(fixtures_dir / "role-mix.jsonl"),
                          "--role", "user")
    texts = " ".join(m.get("text") or "" for m in msgs)
    assert "Injected hook context" not in texts


def test_time_window_narrows_the_result(cli_path, fixtures_dir):
    """A one-day window must not return the other two days."""
    f = str(fixtures_dir / "time-spread.jsonl")
    windowed = _json_messages(cli_path, "--mode", "dump", "--file", f, "--tz", "+00",
                              "--since", "2026-05-01T00:00:00",
                              "--until", "2026-05-02T00:00:00")
    everything = _json_messages(cli_path, "--mode", "dump", "--file", f, "--tz", "+00")

    assert len(windowed) < len(everything), "window was ignored"
    texts = " ".join(m.get("text") or "" for m in windowed)
    assert "May 1" in texts
    assert "Apr 15" not in texts
    assert "May 15" not in texts


def test_window_and_role_compose(cli_path, fixtures_dir):
    msgs = _json_messages(cli_path, "--mode", "dump",
                          "--file", str(fixtures_dir / "time-spread.jsonl"),
                          "--tz", "+00", "--role", "user",
                          "--since", "2026-05-01T00:00:00",
                          "--until", "2026-05-02T00:00:00")
    assert len(msgs) == 1
    assert msgs[0]["role"] == "user"
    assert "May 1 noon" in (msgs[0].get("text") or "")


def test_empty_window_returns_nothing(cli_path, fixtures_dir):
    msgs = _json_messages(cli_path, "--mode", "dump",
                          "--file", str(fixtures_dir / "time-spread.jsonl"),
                          "--tz", "+00",
                          "--since", "2026-07-01T00:00:00",
                          "--until", "2026-07-02T00:00:00")
    assert msgs == []


def test_truncation_is_announced_on_stderr(cli_path, fixtures_dir):
    """A silent tail reads as a complete answer — it has to say so."""
    p = _run(cli_path, "--mode", "dump",
             "--file", str(fixtures_dir / "time-spread.jsonl"), "-n", "2")
    assert p.returncode == 0, p.stderr
    assert "showing the last 2 of" in p.stderr


def test_no_truncation_note_when_everything_fits(cli_path, fixtures_dir):
    p = _run(cli_path, "--mode", "dump",
             "--file", str(fixtures_dir / "time-spread.jsonl"), "-n", "0")
    assert p.returncode == 0, p.stderr
    assert "showing the last" not in p.stderr


def test_n_zero_means_unlimited(cli_path, fixtures_dir):
    msgs = _json_messages(cli_path, "--mode", "dump",
                          "--file", str(fixtures_dir / "time-spread.jsonl"), "-n", "0")
    assert len(msgs) == 6


def test_header_reports_the_scope_it_applied(cli_path, fixtures_dir):
    p = _run(cli_path, "--mode", "dump",
             "--file", str(fixtures_dir / "time-spread.jsonl"), "--tz", "+00",
             "--role", "user", "--since", "2026-05-01T00:00:00",
             "--until", "2026-05-02T00:00:00")
    assert p.returncode == 0, p.stderr
    assert "in window" in p.stdout
    assert "user only" in p.stdout
