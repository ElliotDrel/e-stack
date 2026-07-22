"""Tests for lib.paths."""

import os
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from lib import paths as P


def test_encode_cwd_basic():
    assert P.encode_cwd("C:\\Users\\foo\\bar") == "C--Users-foo-bar"


def test_encode_cwd_spaces():
    assert P.encode_cwd("C:\\Users\\2supe\\Other Claude Code") == "C--Users-2supe-Other-Claude-Code"


def test_decode_project_name_strips_prefix():
    enc = "C--Users-elliot-Other-Claude-Code-Personal-Brand-Project"
    decoded = P.decode_project_name(enc)
    assert "Other" in decoded
    assert "Personal" in decoded
    assert "C--Users" not in decoded


def test_resolve_root_unknown_relative_raises():
    with pytest.raises(ValueError):
        P.resolve_root("not-a-known-root")


def test_current_session_id_fallback_var(monkeypatch):
    # CLAUDE_SESSION_ID is checked only as a compatibility fallback when the
    # real var isn't set — it is NOT what Claude Code actually exports (that's
    # a separate SKILL.md text-substitution mechanism, not an env var at all).
    monkeypatch.delenv("CLAUDE_CODE_SESSION_ID", raising=False)
    monkeypatch.setenv("CLAUDE_SESSION_ID", "abc-123")
    assert P.current_session_id() == "abc-123"


def test_current_session_id_real_var_takes_priority(monkeypatch):
    monkeypatch.setenv("CLAUDE_CODE_SESSION_ID", "real-id")
    monkeypatch.setenv("CLAUDE_SESSION_ID", "fallback-id")
    assert P.current_session_id() == "real-id"


def test_parse_timespec_relative():
    now = datetime.now()
    delta = now - P.parse_timespec("1h")
    assert timedelta(seconds=3590) <= delta <= timedelta(seconds=3610)


def test_parse_timespec_iso_date():
    assert P.parse_timespec("2026-05-01") == datetime(2026, 5, 1)


def test_parse_timespec_yesterday():
    y = P.parse_timespec("yesterday")
    assert y.hour == 0
    assert y.minute == 0


def test_parse_timespec_invalid():
    with pytest.raises(ValueError):
        P.parse_timespec("not-a-time")


def test_list_transcripts_excludes_agent_prefix(tmp_path: Path):
    (tmp_path / "real.jsonl").write_text("{}\n")
    (tmp_path / "agent-foo.jsonl").write_text("{}\n")
    files = P.list_transcripts(tmp_path)
    names = [f.name for f in files]
    assert "real.jsonl" in names
    assert "agent-foo.jsonl" not in names


def test_list_transcripts_time_filter(tmp_path: Path):
    old = tmp_path / "old.jsonl"
    new = tmp_path / "new.jsonl"
    old.write_text("{}\n")
    new.write_text("{}\n")
    # Backdate old
    past = datetime.now() - timedelta(days=10)
    os.utime(old, (past.timestamp(), past.timestamp()))

    since = datetime.now() - timedelta(days=5)
    files = P.list_transcripts(tmp_path, since=since)
    assert [f.name for f in files] == ["new.jsonl"]


def test_list_subagents_finds_agent_files(tmp_path: Path):
    f = tmp_path / "session.jsonl"
    f.write_text("{}\n")
    sub_dir = tmp_path / "session" / "subagents"
    sub_dir.mkdir(parents=True)
    (sub_dir / "agent-x.jsonl").write_text("{}\n")
    (sub_dir / "agent-y.jsonl").write_text("{}\n")
    subs = P.list_subagents(f)
    assert len(subs) == 2
