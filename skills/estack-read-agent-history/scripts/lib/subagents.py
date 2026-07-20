"""Subagent transcript discovery and metadata loading."""

from __future__ import annotations

import json
from pathlib import Path, PurePath
from typing import Optional

from . import parser as _parser
from . import paths as _paths
from . import tools as _tools


def load_meta(agent_path: Path) -> dict:
    """Read the sibling agent-<id>.meta.json sidecar.

    Returns {"agentType": "unknown", "description": ""} on miss.
    """
    meta_path = agent_path.with_suffix(".meta.json")
    if not meta_path.exists():
        # Some sidecars use .meta.json appended to full name
        alt = agent_path.parent / f"{agent_path.stem}.meta.json"
        if alt.exists():
            meta_path = alt
        else:
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


def agent_tools(agent_path: Path, tool_filter: Optional[set[str]] = None) -> list[dict]:
    return _tools.extract_tool_calls(_parser.parse_lines(agent_path), tool_filter)


def agent_files(agent_path: Path) -> dict[PurePath, list[str]]:
    return _tools.files_touched(_parser.parse_lines(agent_path))


def group_by_parent(
    root: Path, agent_type_filter: Optional[str] = None
) -> dict[Path, list[tuple[Path, dict]]]:
    """For every parent session under root, list its subagents + meta.

    Optionally filter by agentType.
    """
    out: dict[Path, list[tuple[Path, dict]]] = {}
    for project_dir in _paths.list_projects(root):
        for parent in _paths.list_transcripts(project_dir):
            subs = _paths.list_subagents(parent)
            if not subs:
                continue
            entries = []
            for sa in subs:
                meta = load_meta(sa)
                if agent_type_filter and meta["agentType"] != agent_type_filter:
                    continue
                entries.append((sa, meta))
            if entries:
                out[parent] = entries
    return out
