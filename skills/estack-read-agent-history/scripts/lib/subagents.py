"""Subagent transcript discovery and metadata loading."""

from __future__ import annotations

import json
from pathlib import Path

from . import parser as _parser
from . import paths as _paths


def load_meta(agent_path: Path) -> dict:
    """Read the sibling agent-<id>.meta.json sidecar.

    Returns {"agentType": "unknown", "description": ""} on miss.
    """
    meta_path = agent_path.with_suffix(".meta.json")
    if not meta_path.exists():
        return {"agentType": "unknown", "description": ""}
    try:
        with open(meta_path, encoding="utf-8") as f:
            data = json.load(f)
        return {
            "agentType": data.get("agentType", data.get("subagent_type", "unknown")),
            "description": data.get("description", ""),
        }
    except (OSError, json.JSONDecodeError):
        return {"agentType": "unknown", "description": ""}


def _last_assistant_text(path: Path) -> str:
    """Pull the last assistant text from a subagent transcript."""
    lines = _parser.parse_lines(path)
    messages = _parser.get_messages(lines)
    for m in reversed(messages):
        if m["role"] == "assistant" and m["texts"]:
            return "\n".join(m["texts"])
    return ""


def agent_finals(parent_session: Path) -> list[tuple[str, dict, str]]:
    """For each subagent of a session: (agent_id, meta, last_assistant_text)."""
    out: list[tuple[str, dict, str]] = []
    for sa in _paths.list_subagents(parent_session):
        agent_id = sa.stem  # e.g., "agent-xxxx"
        meta = load_meta(sa)
        text = _last_assistant_text(sa)
        out.append((agent_id, meta, text))
    return out
