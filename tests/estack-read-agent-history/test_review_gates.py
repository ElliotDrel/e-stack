"""Codex review-gate filtering and per-block collapsing in the timeline.

Codex logs its internal review/approval step as a session of its own. On a busy
day those pseudo-sessions outnumber the real ones and bury the shape of the day,
so timeline/session-report hide them unless --keep-review-gates is passed.
"""

from datetime import datetime, timedelta

import read_transcript as RT


GATE_TITLE = ("The following is the Codex agent history whose request actions "
              "require approval")


def test_is_review_gate_matches_title_string():
    assert RT.is_review_gate(GATE_TITLE)


def test_is_review_gate_matches_codex_summary_dict():
    assert RT.is_review_gate({"source": "codex", "title": GATE_TITLE})
    assert RT.is_review_gate({"source": "codex", "title": None, "first_prompt": GATE_TITLE})


def test_is_review_gate_requires_codex_source():
    """A Claude session that merely talks about review gates is real work."""
    assert not RT.is_review_gate({"source": "claude", "title": GATE_TITLE})
    assert not RT.is_review_gate({"title": GATE_TITLE})          # source absent


def test_is_review_gate_leaves_real_sessions_alone():
    assert not RT.is_review_gate({"source": "codex", "title": "Fix the spell checker"})
    assert not RT.is_review_gate({"source": "codex", "title": ""})
    assert not RT.is_review_gate({})
    assert not RT.is_review_gate(None)


def _block_data(counts, sessions):
    start = datetime(2026, 8, 16, 9, 0)
    return {
        "since": start,
        "until": start + timedelta(hours=2),
        "gap_minutes": 15,
        "blocks": [{"start": start, "end": start + timedelta(minutes=30), "counts": counts}],
        "sessions": sessions,
        "review_gates_hidden": 0,
    }


def _fake_session(uuid, title):
    return {"uuid": uuid, "title": title, "decoded_project": "Proj", "source": "claude"}


def test_max_per_block_collapses_the_quiet_tail():
    counts = {"a": 100, "b": 50, "c": 10, "d": 5, "e": 2}
    sessions = {k: _fake_session(k * 8, f"Session {k}") for k in counts}
    out = RT.render_timeline(_block_data(counts, sessions), "local", max_per_block=2)

    assert "Session a" in out
    assert "Session b" in out
    assert "Session c" not in out
    assert "3 quieter session(s)" in out
    assert "17 msgs" in out          # 10 + 5 + 2 rolled up


def test_max_per_block_zero_shows_everything():
    counts = {"a": 100, "b": 50, "c": 10}
    sessions = {k: _fake_session(k * 8, f"Session {k}") for k in counts}
    out = RT.render_timeline(_block_data(counts, sessions), "local", max_per_block=0)

    assert "Session c" in out
    assert "quieter session" not in out


def test_hidden_gate_count_is_reported_to_the_reader():
    counts = {"a": 10}
    sessions = {"a": _fake_session("aaaaaaaa", "Real work")}
    data = _block_data(counts, sessions)
    data["review_gates_hidden"] = 4
    out = RT.render_timeline(data, "local")

    assert "4 Codex review gate(s) hidden" in out
    assert "--keep-review-gates" in out


def test_no_note_when_nothing_was_hidden():
    counts = {"a": 10}
    sessions = {"a": _fake_session("aaaaaaaa", "Real work")}
    out = RT.render_timeline(_block_data(counts, sessions), "local")

    assert "review gate" not in out
