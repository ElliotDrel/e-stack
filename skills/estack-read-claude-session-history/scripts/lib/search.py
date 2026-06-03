"""Unified search engine across sessions, projects, and roots."""

from __future__ import annotations

import json
import sys
from collections import namedtuple
from datetime import datetime
from pathlib import Path
from typing import Iterator, Literal, Optional

from . import parser as _parser
from . import paths as _paths


Match = namedtuple(
    "Match",
    ["session_path", "mtime", "role", "where", "timestamp", "window_text"],
)


def _block_text(block: dict, where: str) -> str:
    """Extract searchable text for a given 'where' channel from one block."""
    bt = block.get("type")
    if where == "text" and bt == "text":
        return block.get("text", "")
    if where == "thinking" and bt == "thinking":
        return block.get("thinking", "") or block.get("text", "")
    if where == "tool_use" and bt == "tool_use":
        name = block.get("name", "")
        try:
            inp = json.dumps(block.get("input", {}))
        except (TypeError, ValueError):
            inp = str(block.get("input", ""))
        return f"[tool:{name}] {inp}"
    if where == "tool_result" and bt == "tool_result":
        inner = block.get("content", "")
        if isinstance(inner, str):
            return inner
        if isinstance(inner, list):
            parts = []
            for item in inner:
                if isinstance(item, dict) and item.get("type") == "text":
                    parts.append(item.get("text", ""))
            return "\n".join(parts)
    return ""


def _entry_search_text(obj: dict, in_channel: str) -> list[tuple[str, str]]:
    """Return list of (where, text) for an entry filtered to in_channel."""
    msg = obj.get("message", {})
    if not isinstance(msg, dict):
        return []
    content = msg.get("content")
    out: list[tuple[str, str]] = []
    if isinstance(content, str):
        if in_channel in ("text", "all"):
            out.append(("text", content))
        return out
    if not isinstance(content, list):
        return out
    channels = ["text", "tool_use", "thinking", "tool_result"] if in_channel == "all" else [in_channel]
    for block in content:
        if not isinstance(block, dict):
            continue
        for ch in channels:
            t = _block_text(block, ch)
            if t:
                out.append((ch, t))
    return out


def _window(text: str, q: str, n: int = 200) -> str:
    """Return up to n chars of context around the first match of q."""
    if not text or not q:
        return ""
    lower = text.lower()
    idx = lower.find(q.lower())
    if idx == -1:
        return text[:n]
    start = max(0, idx - n // 2)
    end = min(len(text), idx + len(q) + n // 2)
    window = text[start:end]
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return prefix + window + suffix


def search_session(
    path: Path,
    query: str,
    role: Literal["user", "assistant", "both"] = "both",
    in_channel: Literal["text", "tool_use", "thinking", "all"] = "text",
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[Match]:
    """Search one transcript file. Returns ordered matches."""
    lines = _parser.parse_lines(path)
    try:
        mtime = path.stat().st_mtime
    except OSError:
        mtime = 0
    matches: list[Match] = []
    q = query.lower()
    for obj in lines:
        cls = _parser.classify_entry(obj)
        if cls == "noise" or cls == "title":
            continue
        msg_role = "user" if cls in ("user", "compact") else "assistant"
        if role != "both" and msg_role != role:
            continue
        ts = obj.get("timestamp")
        ts_dt = None
        if since is not None or until is not None:
            ts_dt = _parser._parse_timestamp(ts)
            if ts_dt is None:
                continue
            if ts_dt.tzinfo is not None:
                ts_dt = ts_dt.replace(tzinfo=None)
            if since is not None and ts_dt < since:
                continue
            if until is not None and ts_dt > until:
                continue
        for where, text in _entry_search_text(obj, in_channel):
            if q in text.lower():
                matches.append(Match(
                    session_path=path,
                    mtime=mtime,
                    role=msg_role,
                    where=where,
                    timestamp=ts,
                    window_text=_window(text, query),
                ))
    return matches


def search_project(
    project_dir: Path,
    query: str,
    role: Literal["user", "assistant", "both"] = "both",
    in_channel: Literal["text", "tool_use", "thinking", "all"] = "text",
    since: datetime | None = None,
    until: datetime | None = None,
    progress: bool = True,
) -> Iterator[Match]:
    """Search every transcript in a project directory, newest first."""
    files = _paths.list_transcripts(project_dir, since=since, until=until)
    for i, f in enumerate(files, 1):
        if progress:
            print(
                f"Searching {i}/{len(files)}: {f.name}...",
                file=sys.stderr,
                end="\r",
            )
        try:
            for m in search_session(f, query, role, in_channel, since, until):
                yield m
        except Exception as e:
            print(f"\nError reading {f.name}: {e}", file=sys.stderr)
    if progress:
        print(file=sys.stderr)


def search_all_projects(
    root: Path,
    query: str,
    role: Literal["user", "assistant", "both"] = "both",
    in_channel: Literal["text", "tool_use", "thinking", "all"] = "text",
    since: datetime | None = None,
    until: datetime | None = None,
    progress: bool = True,
) -> Iterator[Match]:
    """Walk every project directory under root."""
    for project_dir in _paths.list_projects(root):
        if progress:
            print(f"--- {project_dir.name} ---", file=sys.stderr)
        yield from search_project(
            project_dir, query, role, in_channel, since, until, progress
        )
