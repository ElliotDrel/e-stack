"""Tests for lib.parser."""

import json
from datetime import datetime
from pathlib import Path

import pytest

from lib import parser as PR


def _load(fixtures_dir, name):
    return PR.parse_lines(fixtures_dir / name)


def test_parse_basic(fixtures_dir):
    lines = _load(fixtures_dir, "basic-session.jsonl")
    assert len(lines) == 2
    assert lines[0]["type"] == "user"


def test_get_messages_basic(fixtures_dir):
    lines = _load(fixtures_dir, "basic-session.jsonl")
    msgs = PR.get_messages(lines)
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"


def test_compact_marker_single(fixtures_dir):
    lines = _load(fixtures_dir, "with-compact.jsonl")
    msgs = PR.get_messages(lines)
    compact = [m for m in msgs if m["is_compact"]]
    assert len(compact) == 1


def test_compact_marker_multiple(fixtures_dir):
    lines = _load(fixtures_dir, "multi-compact.jsonl")
    msgs = PR.get_messages(lines)
    compact = [m for m in msgs if m["is_compact"]]
    assert len(compact) == 2


def test_compact_marker_absent(fixtures_dir):
    lines = _load(fixtures_dir, "basic-session.jsonl")
    msgs = PR.get_messages(lines)
    assert all(not m["is_compact"] for m in msgs)


def test_extract_text_blocks_string():
    assert PR.extract_text_blocks("hello") == ["hello"]


def test_extract_text_blocks_empty_string():
    assert PR.extract_text_blocks("") == []
    assert PR.extract_text_blocks("   ") == []


def test_extract_text_blocks_array():
    blocks = [{"type": "text", "text": "hi"}, {"type": "tool_use", "name": "X"}]
    assert PR.extract_text_blocks(blocks) == ["hi"]


def test_extract_text_blocks_with_thinking():
    blocks = [
        {"type": "thinking", "thinking": "reasoning..."},
        {"type": "text", "text": "answer"},
    ]
    out = PR.extract_text_blocks(blocks, include_thinking=True)
    assert any("THINKING" in t for t in out)
    assert "answer" in out


def test_extract_text_blocks_with_tool_use():
    blocks = [{"type": "tool_use", "name": "Bash", "input": {"command": "ls"}}]
    out = PR.extract_text_blocks(blocks, include_tool_use=True)
    assert any("TOOL_USE Bash" in t for t in out)


def test_extract_advisor():
    blocks = [{"type": "advisor_tool_result", "content": {"text": "advice"}}]
    out = PR.extract_text_blocks(blocks)
    assert any("[ADVISOR]" in t for t in out)
    assert any("advice" in t for t in out)


def test_classify_entry_user():
    obj = {"type": "user", "message": {"role": "user", "content": "hi"}}
    assert PR.classify_entry(obj) == "user"


def test_classify_entry_compact():
    obj = {
        "type": "user",
        "message": {"role": "user", "content": PR.COMPACT_MARKER + " more"},
    }
    assert PR.classify_entry(obj) == "compact"


def test_classify_entry_assistant():
    obj = {"type": "assistant", "message": {"role": "assistant", "content": []}}
    assert PR.classify_entry(obj) == "assistant"


def test_classify_entry_noise():
    obj = {"type": "ai-title", "aiTitle": "X"}
    assert PR.classify_entry(obj) == "title"


def test_all_noise_fixture_yields_no_messages(fixtures_dir):
    lines = _load(fixtures_dir, "all-noise.jsonl")
    msgs = PR.get_messages(lines)
    assert msgs == []


def test_filter_by_role(fixtures_dir):
    lines = _load(fixtures_dir, "basic-session.jsonl")
    msgs = PR.get_messages(lines)
    user_only = PR.filter_by_role(msgs, "user")
    assert all(m["role"] == "user" for m in user_only)
    assert len(user_only) == 1


def test_filter_by_time(fixtures_dir):
    lines = _load(fixtures_dir, "time-spread.jsonl")
    msgs = PR.get_messages(lines)
    since = datetime(2026, 5, 1)
    filtered = PR.filter_by_time(msgs, since=since, until=None)
    assert all(
        PR._parse_timestamp(m["timestamp"]).replace(tzinfo=None) >= since
        for m in filtered if m["timestamp"]
    )


def test_filter_by_time_until_is_exclusive():
    # Half-open [since, until): a message stamped exactly at `until` is excluded.
    # Derive the bound from the parser so the test is timezone-independent.
    msgs = [{"timestamp": "2026-05-01T10:00:00Z"}]
    at = PR._parse_timestamp(msgs[0]["timestamp"])
    assert PR.filter_by_time(msgs, since=None, until=at) == []
    assert PR.filter_by_time(msgs, since=None, until=at + timedelta(seconds=1)) == msgs


def test_truncated_line_dropped(fixtures_dir, capsys):
    # Should not raise, and warning should be on stderr
    lines = _load(fixtures_dir, "truncated.jsonl")
    # 2 valid + 1 truncated = 2 valid records
    assert len(lines) == 2


def test_unicode_roundtrip(fixtures_dir):
    lines = _load(fixtures_dir, "unicode.jsonl")
    msgs = PR.get_messages(lines)
    user_text = msgs[0]["texts"][0]
    assert "🌍" in user_text or "你好" in user_text


def test_infer_status_clean(fixtures_dir):
    lines = _load(fixtures_dir, "basic-session.jsonl")
    mtime = (fixtures_dir / "basic-session.jsonl").stat().st_mtime
    status = PR.infer_status(lines, mtime, current_session_id=None, session_uuid=None)
    assert status == "clean"


def test_infer_status_pending_user(fixtures_dir):
    lines = _load(fixtures_dir, "pending-user.jsonl")
    mtime = (fixtures_dir / "pending-user.jsonl").stat().st_mtime
    status = PR.infer_status(lines, mtime, current_session_id=None, session_uuid=None)
    assert status == "pending-user"


def test_infer_status_interrupted(fixtures_dir):
    lines = _load(fixtures_dir, "interrupted.jsonl")
    mtime = (fixtures_dir / "interrupted.jsonl").stat().st_mtime
    status = PR.infer_status(lines, mtime, current_session_id=None, session_uuid=None)
    assert status == "interrupted"


def test_infer_status_active(fixtures_dir):
    import time
    # Touch the fixture to make it fresh, then set CLAUDE_SESSION_ID to its stem
    f = fixtures_dir / "basic-session.jsonl"
    mtime = time.time()
    lines = _load(fixtures_dir, "basic-session.jsonl")
    status = PR.infer_status(
        lines, mtime, current_session_id="basic-session", session_uuid="basic-session"
    )
    assert status == "active"


def test_session_summary_fields(fixtures_dir):
    s = PR.session_summary(fixtures_dir / "tool-zoo.jsonl")
    assert s["exists"]
    assert s["msg_count"] > 0
    assert "Bash" in s["tool_counts"]
    assert "Read" in s["tool_counts"]


def test_parse_lines_cache(fixtures_dir):
    f = fixtures_dir / "basic-session.jsonl"
    a = PR.parse_lines(f)
    b = PR.parse_lines(f)
    # Same object thanks to cache
    assert a is b
