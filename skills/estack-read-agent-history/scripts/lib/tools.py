"""Tool-call extraction, per-tool formatting, and tool-result lookup."""

from __future__ import annotations

import json
import re
from pathlib import Path, PurePath, PureWindowsPath
from typing import Optional

_WINDOWS_PATH_RE = re.compile(r"^[A-Za-z]:\\|^\\\\")


def _to_path(raw: str) -> PurePath:
    """Parse a file path recorded in a transcript, independent of the host OS.

    Claude and Codex sessions log the path style of the machine they ran on
    (backslashes from Windows, forward slashes from POSIX), which may not
    match the OS running this script. A bare `Path(raw)` uses the host OS's
    separator rules, so a Windows-recorded path silently fails to split on a
    POSIX host (and vice versa) and `.name` returns the whole raw string.
    """
    if _WINDOWS_PATH_RE.match(raw) or ("\\" in raw and "/" not in raw):
        return PureWindowsPath(raw)
    return Path(raw)


def extract_tool_calls(
    lines: list[dict], tool_filter: Optional[set[str]] = None
) -> list[dict]:
    """Every tool_use block with timestamp and parent line index.

    Returns list of dicts: {name, input, id, timestamp, line_index}.
    """
    out = []
    for i, obj in enumerate(lines):
        msg = obj.get("message", {})
        if not isinstance(msg, dict):
            continue
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        ts = obj.get("timestamp")
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") != "tool_use":
                continue
            name = block.get("name", "")
            if tool_filter and name not in tool_filter:
                continue
            out.append({
                "name": name,
                "input": block.get("input", {}) or {},
                "id": block.get("id", ""),
                "timestamp": ts,
                "line_index": i,
            })
    return out


def _first_line(s: str, n: int = 200) -> str:
    if not s:
        return ""
    line = s.splitlines()[0] if s.splitlines() else s
    return line if len(line) <= n else line[: n - 1] + "…"


def format_tool_call(call: dict) -> str:
    """Per-tool human-readable one-liner."""
    name = call.get("name", "?")
    inp = call.get("input", {}) or {}

    if name in ("Bash", "PowerShell"):
        cmd = inp.get("command", "")
        return f"{name}: {_first_line(cmd, 200)}"
    if name == "Read":
        fp = inp.get("file_path", "")
        offset = inp.get("offset")
        limit = inp.get("limit")
        if offset is not None or limit is not None:
            o = offset or 1
            l = limit or 0
            return f"Read {fp} (lines {o}-{o + l if l else '?'})"
        return f"Read {fp}"
    if name == "Edit":
        fp = inp.get("file_path", "")
        edits = inp.get("edits")
        if isinstance(edits, list):
            return f"Edit {fp} ({len(edits)} edits)"
        return f"Edit {fp}"
    if name == "Write":
        fp = inp.get("file_path", "")
        content = inp.get("content", "")
        return f"Write {fp} ({len(content)} chars)"
    if name in ("Agent", "Task"):
        sub = inp.get("subagent_type") or inp.get("agentType") or "?"
        desc = inp.get("description", "")
        return f"{name}[{sub}]: {_first_line(desc, 200)}"
    if name == "Skill":
        sk = inp.get("skill", "")
        args = inp.get("args", "")
        if args:
            return f"Skill: {sk} {_first_line(str(args), 100)}"
        return f"Skill: {sk}"
    if name == "Glob":
        pat = inp.get("pattern", "")
        return f"Glob: {pat}"
    if name == "Grep":
        pat = inp.get("pattern", "")
        return f"Grep: {pat}"
    try:
        preview = json.dumps(inp)[:200]
    except (TypeError, ValueError):
        preview = str(inp)[:200]
    return f"{name}: {preview}"


def extract_tool_results(
    lines: list[dict], tool_use_id: str
) -> Optional[str]:
    """Find the tool_result block whose tool_use_id matches the given id."""
    if not tool_use_id:
        return None
    for obj in lines:
        msg = obj.get("message", {})
        if not isinstance(msg, dict):
            continue
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") != "tool_result":
                continue
            if block.get("tool_use_id") != tool_use_id:
                continue
            inner = block.get("content", "")
            if isinstance(inner, str):
                return inner
            if isinstance(inner, list):
                parts = []
                for sub in inner:
                    if isinstance(sub, dict) and sub.get("type") == "text":
                        parts.append(sub.get("text", ""))
                return "\n".join(parts)
    return None


def files_touched(lines: list[dict]) -> dict[PurePath, list[str]]:
    """Map of file paths to the list of operations performed on them."""
    out: dict[str, list[str]] = {}
    for call in extract_tool_calls(lines):
        name = call["name"]
        inp = call.get("input", {}) or {}
        if name in ("Edit", "Write", "Read", "NotebookEdit"):
            fp = inp.get("file_path") or inp.get("notebook_path", "")
            if fp:
                out.setdefault(fp, []).append(name)
    # Convert to Path keys
    return {_to_path(k): v for k, v in out.items()}
