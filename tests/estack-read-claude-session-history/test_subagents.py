"""Tests for lib.subagents."""

from pathlib import Path

from lib import subagents as SA
from lib import paths as P


def test_load_meta_hit(fixtures_dir):
    agent_file = fixtures_dir / "subagent-parent" / "subagents" / "agent-xyz123.jsonl"
    meta = SA.load_meta(agent_file)
    assert meta["agentType"] == "Explore"
    assert "bug" in meta["description"].lower()


def test_load_meta_miss(fixtures_dir):
    agent_file = fixtures_dir / "subagent-no-meta" / "subagents" / "agent-aaa.jsonl"
    meta = SA.load_meta(agent_file)
    assert meta["agentType"] == "unknown"
    assert meta["description"] == ""


def test_agent_finals(fixtures_dir):
    parent = fixtures_dir / "subagent-parent.jsonl"
    finals = SA.agent_finals(parent)
    assert len(finals) == 1
    agent_id, meta, text = finals[0]
    assert agent_id == "agent-xyz123"
    assert meta["agentType"] == "Explore"
    assert "Found it" in text


def test_agent_finals_no_subagents(fixtures_dir):
    parent = fixtures_dir / "basic-session.jsonl"
    finals = SA.agent_finals(parent)
    assert finals == []


def test_list_subagents(fixtures_dir):
    parent = fixtures_dir / "subagent-parent.jsonl"
    subs = P.list_subagents(parent)
    assert len(subs) == 1
    assert subs[0].stem == "agent-xyz123"
