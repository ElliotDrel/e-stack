"""Tests for lib.search."""

from datetime import datetime, timedelta
from pathlib import Path

from lib import parser as PR
from lib import search as S


def test_search_session_text(fixtures_dir):
    matches = S.search_session(
        fixtures_dir / "basic-session.jsonl", "Hello", role="both", in_channel="text"
    )
    assert len(matches) >= 1


def test_search_session_assistant_only(fixtures_dir):
    matches = S.search_session(
        fixtures_dir / "basic-session.jsonl", "Hello",
        role="assistant", in_channel="text",
    )
    # "Hello" is in the user message only
    assert len(matches) == 0


def test_search_session_user_only(fixtures_dir):
    matches = S.search_session(
        fixtures_dir / "basic-session.jsonl", "Hello",
        role="user", in_channel="text",
    )
    assert len(matches) >= 1


def test_search_in_tool_use(fixtures_dir):
    matches = S.search_session(
        fixtures_dir / "tool-zoo.jsonl", "ls -la",
        role="both", in_channel="tool_use",
    )
    assert len(matches) >= 1
    assert matches[0].where == "tool_use"


def test_search_in_thinking(fixtures_dir):
    matches = S.search_session(
        fixtures_dir / "with-thinking.jsonl", "step by step",
        role="both", in_channel="thinking",
    )
    assert len(matches) >= 1
    assert matches[0].where == "thinking"


def test_search_no_match(fixtures_dir):
    matches = S.search_session(
        fixtures_dir / "basic-session.jsonl", "this-string-not-present",
        role="both", in_channel="text",
    )
    assert matches == []


def test_search_with_time_filter(fixtures_dir):
    # "Hello" appears in basic-session.jsonl at 2026-05-01T10:00:00Z
    # Excluding that date should yield no matches
    matches = S.search_session(
        fixtures_dir / "basic-session.jsonl", "Hello",
        role="both", in_channel="text",
        since=datetime(2026, 6, 1),
    )
    assert matches == []


def test_search_until_is_exclusive(fixtures_dir):
    # The "Hello" user message is stamped 2026-05-01T10:00:00Z. Derive the bound
    # from the parser (it converts to local naive time) so this is tz-independent.
    # Half-open [since, until): until at that instant excludes it; one second later includes it.
    at = PR._parse_timestamp("2026-05-01T10:00:00Z")
    assert S.search_session(
        fixtures_dir / "basic-session.jsonl", "Hello", role="both", until=at
    ) == []
    # "Hello" matches only the user message at the boundary instant, so +1s yields exactly 1.
    assert len(S.search_session(
        fixtures_dir / "basic-session.jsonl", "Hello", role="both",
        until=at + timedelta(seconds=1)
    )) == 1


def test_search_project(fixtures_dir, tmp_path):
    # Copy 2 fixtures into a fake project dir and search
    import shutil
    pd = tmp_path / "fake-proj"
    pd.mkdir()
    shutil.copy(fixtures_dir / "basic-session.jsonl", pd / "session-a.jsonl")
    shutil.copy(fixtures_dir / "tool-zoo.jsonl", pd / "session-b.jsonl")
    matches = list(S.search_project(pd, "Hello", progress=False))
    assert len(matches) >= 1
