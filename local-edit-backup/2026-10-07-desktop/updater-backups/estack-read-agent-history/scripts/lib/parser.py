"""JSONL parsing primitives, message classification, and session summaries."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator, Literal


NOISE_TYPES: set[str] = {
    "permission-mode", "ai-title", "custom-title", "attachment",
    "last-prompt", "queue-operation", "file-history-snapshot",
    "system", "agent-name", "pr-link",
}

COMPACT_MARKER = "This session is being continued from a previous conversation"

# 5 MB — beyond this, dump mode auto-degrades unless --force-dump.
LARGE_FILE_THRESHOLD = 5 * 1024 * 1024

EntryType = Literal["user", "assistant", "title", "noise", "compact"]

_PARSE_CACHE: dict[Path, tuple[float, list[dict]]] = {}


def iter_lines(path: Path) -> Iterator[dict]:
    """Yield parsed JSON objects from a .jsonl file, streaming.

    A truncated (un-newline-terminated) trailing line is dropped silently with
    a stderr note. Malformed JSON lines are also dropped silently.
    """
    truncated = False
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if not stripped:
                    continue
                if not line.endswith("\n"):
                    # Last line, no terminator — could be partial. Try to parse,
                    # but if it fails, treat as truncation.
                    try:
                        yield json.loads(stripped)
                    except json.JSONDecodeError:
                        truncated = True
                    continue
                try:
                    yield json.loads(stripped)
                except json.JSONDecodeError:
                    continue
    finally:
        if truncated:
            print(
                f"[note: dropped truncated trailing line in {path.name}]",
                file=sys.stderr,
            )


def parse_lines(path: Path) -> list[dict]:
    """Read all JSONL records from a file, with mtime-based caching.

    A Codex rollout (``rollout-*.jsonl``) is transparently normalized into the
    same entry shape Claude Code emits, so every downstream primitive works on
    it unchanged. See ``lib/codex.py``.
    """
    from . import codex as _codex
    is_codex = _codex.is_codex_rollout(path)
    _load = _codex.normalize_rollout if is_codex else lambda p: list(iter_lines(p))
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return _load(path)
    cached = _PARSE_CACHE.get(path)
    if cached is not None and cached[0] == mtime:
        return cached[1]
    records = _load(path)
    _PARSE_CACHE[path] = (mtime, records)
    return records


def extract_text_blocks(
    content,
    include_thinking: bool = False,
    include_tool_use: bool = False,
) -> list[str]:
    """Pull human-readable text from a content field (string or block list)."""
    if isinstance(content, str):
        return [content] if content.strip() else []
    if not isinstance(content, list):
        return []
    texts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        t = block.get("type")
        if t == "text" and block.get("text", "").strip():
            texts.append(block["text"])
        elif t == "advisor_tool_result":
            inner = block.get("content", {})
            if isinstance(inner, dict) and inner.get("text"):
                texts.append(f"[ADVISOR]\n{inner['text']}")
        elif t == "thinking" and include_thinking:
            think = block.get("thinking", "") or block.get("text", "")
            if think.strip():
                texts.append(f"[THINKING]\n{think}")
        elif t == "tool_use" and include_tool_use:
            name = block.get("name", "?")
            tool_input = block.get("input", {})
            try:
                preview = json.dumps(tool_input)[:200]
            except (TypeError, ValueError):
                preview = str(tool_input)[:200]
            texts.append(f"[TOOL_USE {name}] {preview}")
    return texts


def is_compact_marker(text: str) -> bool:
    return bool(text) and COMPACT_MARKER in text


def classify_entry(obj: dict) -> EntryType:
    """Single source of truth for entry-type classification."""
    t = obj.get("type", "")
    if t == "ai-title" or t == "custom-title":
        return "title"
    if t in NOISE_TYPES:
        return "noise"
    msg = obj.get("message", {})
    if not msg:
        return "noise"
    role = msg.get("role")
    if role == "user":
        content = msg.get("content", "")
        text = (
            content if isinstance(content, str)
            else " ".join(
                b.get("text", "") for b in content
                if isinstance(b, dict) and b.get("type") == "text"
            )
        )
        if is_compact_marker(text):
            return "compact"
        return "user"
    if role == "assistant":
        return "assistant"
    return "noise"


def get_messages(lines: list[dict]) -> list[dict]:
    """Filter to signal messages, returning {role, texts, line_index, is_compact, timestamp}."""
    messages: list[dict] = []
    for i, obj in enumerate(lines):
        cls = classify_entry(obj)
        if cls in ("noise", "title"):
            continue
        msg = obj.get("message", {})
        if not msg:
            continue
        content = msg.get("content", "")
        texts = extract_text_blocks(content)
        timestamp = obj.get("timestamp")
        messages.append({
            "role": "user" if cls in ("user", "compact") else "assistant",
            "texts": texts,
            "line_index": i,
            "is_compact": cls == "compact",
            "timestamp": timestamp,
        })
    return messages


def filter_by_role(
    messages: list[dict], role: Literal["user", "assistant", "both"]
) -> list[dict]:
    if role == "both":
        return messages
    return [m for m in messages if m["role"] == role]


# Display timezone. None → system local time. Set via set_timezone() (--tz flag).
# JSONL timestamps are UTC; every parsed timestamp is converted to this zone so
# all displayed times match the user's wall clock and compare cleanly against
# parse_timespec() values (which are local).
_TARGET_TZ: timezone | None = None

_TZ_OFFSET_RE = re.compile(r"^([+-])(\d{1,2})(?::?(\d{2}))?$")


def set_timezone(spec: str | None) -> None:
    """Set the display timezone from a --tz spec.

    Accepts:
      - None / "local"  → system local time (default)
      - "UTC"           → UTC
      - fixed offsets   → "+5", "-4", "+05:30", "UTC-4"
      - IANA names      → "America/New_York" (via zoneinfo)
    """
    global _TARGET_TZ
    if not spec or spec.strip().lower() == "local":
        _TARGET_TZ = None
        return
    s = spec.strip()
    if s.upper().startswith("UTC"):
        rest = s[3:].strip()
        if not rest:
            _TARGET_TZ = timezone.utc
            return
        s = rest  # "UTC-4" → "-4"
    m = _TZ_OFFSET_RE.match(s)
    if m:
        sign = 1 if m.group(1) == "+" else -1
        hours = int(m.group(2))
        mins = int(m.group(3) or 0)
        _TARGET_TZ = timezone(sign * timedelta(hours=hours, minutes=mins))
        return
    try:
        from zoneinfo import ZoneInfo
        _TARGET_TZ = ZoneInfo(spec.strip())
    except Exception as e:
        raise ValueError(
            f"Unrecognized timezone: {spec!r}. "
            "Use an IANA name (America/New_York), 'UTC', or an offset (+5, -4, +05:30)."
        ) from e


def to_display(dt: datetime) -> datetime:
    """Convert an aware datetime to the display timezone, returned naive."""
    return dt.astimezone(_TARGET_TZ).replace(tzinfo=None)


def epoch_to_display(epoch: float) -> datetime:
    """Convert an epoch (e.g. st_mtime) to the display timezone, returned naive."""
    return to_display(datetime.fromtimestamp(epoch, tz=timezone.utc))


def display_to_epoch(dt: datetime) -> float:
    """Interpret a naive display-timezone datetime as an epoch.

    Inverse of epoch_to_display. Needed because naive_dt.timestamp() assumes
    *local* time, which is wrong under a --tz override.
    """
    if dt.tzinfo is None and _TARGET_TZ is not None:
        dt = dt.replace(tzinfo=_TARGET_TZ)
    return dt.timestamp()


def now_display() -> datetime:
    """Current time as a naive datetime in the display timezone."""
    import time as _time
    return epoch_to_display(_time.time())


def _parse_timestamp(ts) -> datetime | None:
    """Parse a JSONL timestamp → naive datetime in the display timezone."""
    if not ts:
        return None
    if isinstance(ts, (int, float)):
        try:
            return epoch_to_display(float(ts))
        except (ValueError, OSError, OverflowError):
            return None
    if isinstance(ts, str):
        # ISO 8601 with possible Z
        s = ts.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
        if dt.tzinfo is not None:
            return to_display(dt)
        return dt  # naive — assume already local
    return None


def filter_by_time(
    messages: list[dict],
    since: datetime | None,
    until: datetime | None,
) -> list[dict]:
    if since is None and until is None:
        return messages
    out = []
    for m in messages:
        ts = _parse_timestamp(m.get("timestamp"))
        if ts is None:
            continue
        # Strip tzinfo for naive comparison
        if ts.tzinfo is not None:
            ts = ts.replace(tzinfo=None)
        # Half-open window [since, until): since inclusive, until exclusive.
        if since is not None and ts < since:
            continue
        if until is not None and ts >= until:
            continue
        out.append(m)
    return out


def _truncate(s: str, n: int) -> str:
    if not s:
        return ""
    s = s.replace("\n", " ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def infer_status(
    lines: list[dict],
    mtime: float,
    current_session_id: str | None,
    session_uuid: str | None,
) -> Literal["clean", "interrupted", "pending-user", "active"]:
    """Heuristic session status from the shape of the final entry."""
    now = datetime.now().timestamp()
    if (
        current_session_id
        and session_uuid
        and current_session_id == session_uuid
        and now - mtime < 300
    ):
        return "active"

    if not lines:
        return "clean"

    # Walk backwards through non-noise entries
    last_assistant = None
    has_dangling_tool_use = False
    pending_tool_use_ids: set[str] = set()
    tool_result_ids: set[str] = set()
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
            bt = block.get("type")
            if bt == "tool_use":
                tid = block.get("id")
                if tid:
                    pending_tool_use_ids.add(tid)
            elif bt == "tool_result":
                tid = block.get("tool_use_id")
                if tid:
                    tool_result_ids.add(tid)

    dangling = pending_tool_use_ids - tool_result_ids
    if dangling:
        has_dangling_tool_use = True

    # Find the last assistant message
    for obj in reversed(lines):
        msg = obj.get("message", {})
        if msg.get("role") == "assistant":
            last_assistant = msg
            break

    if has_dangling_tool_use:
        return "interrupted"

    if last_assistant is not None:
        content = last_assistant.get("content", "")
        text = (
            content if isinstance(content, str)
            else " ".join(
                b.get("text", "") for b in content
                if isinstance(b, dict) and b.get("type") == "text"
            )
        )
        if text.strip().endswith("?"):
            return "pending-user"

    return "clean"


def session_summary(path: Path, current_session_id: str | None = None) -> dict:
    """Compact per-session metrics for brief / list / journal / count modes."""
    from .tools import extract_tool_calls, files_touched  # local import to avoid cycle
    from .paths import decode_project_name, list_subagents, encode_cwd
    from .subagents import load_meta
    from . import codex as _codex

    is_codex = _codex.is_codex_rollout(path)

    try:
        stat = path.stat()
    except OSError:
        return {
            "path": path,
            "uuid": _codex.rollout_uuid(path) if is_codex else path.stem,
            "source": "codex" if is_codex else "claude",
            "mtime": 0,
            "size": 0,
            "exists": False,
        }

    lines = parse_lines(path)
    messages = get_messages(lines)
    user_msgs = [m for m in messages if m["role"] == "user" and not m["is_compact"]]
    assistant_msgs = [m for m in messages if m["role"] == "assistant"]

    # Title
    title = ""
    for obj in lines:
        if obj.get("type") in ("ai-title", "custom-title"):
            title = obj.get("aiTitle") or obj.get("customTitle") or ""
            if title:
                break

    first_prompt = ""
    if user_msgs and user_msgs[0]["texts"]:
        first_prompt = _truncate(user_msgs[0]["texts"][0], 200)

    last_assistant = ""
    if assistant_msgs and assistant_msgs[-1]["texts"]:
        last_assistant = _truncate(assistant_msgs[-1]["texts"][-1], 200)

    last_activity = epoch_to_display(stat.st_mtime).strftime("%Y-%m-%d %H:%M")

    tool_calls = extract_tool_calls(lines)
    tool_counts: dict[str, int] = {}
    for tc in tool_calls:
        tool_counts[tc["name"]] = tool_counts.get(tc["name"], 0) + 1

    files = files_touched(lines)
    edit_count = len(files)

    subagents = list_subagents(path)
    subagent_types: dict[str, int] = {}
    for sa in subagents:
        meta = load_meta(sa)
        atype = meta.get("agentType", "unknown")
        subagent_types[atype] = subagent_types.get(atype, 0) + 1

    has_compact = any(m["is_compact"] for m in messages)
    if is_codex:
        session_uuid = _codex.rollout_uuid(path)
        cwd_name = encode_cwd(_codex.codex_cwd(path))
        decoded = decode_project_name(cwd_name) if cwd_name else "codex"
    else:
        session_uuid = path.stem
        cwd_name = path.parent.name
        decoded = decode_project_name(cwd_name)

    status = infer_status(
        lines, stat.st_mtime, current_session_id, session_uuid
    )

    return {
        "path": path,
        "uuid": session_uuid,
        "source": "codex" if is_codex else "claude",
        "mtime": stat.st_mtime,
        "size": stat.st_size,
        "exists": True,
        "title": title,
        "first_prompt": first_prompt,
        "last_assistant": last_assistant,
        "last_activity": last_activity,
        "msg_count": len(messages),
        "edit_count": edit_count,
        "tool_counts": tool_counts,
        "files_touched": list(files.keys()),
        "subagent_count": len(subagents),
        "subagent_types": subagent_types,
        "has_compact": has_compact,
        "has_subagents": bool(subagents),
        "cwd": cwd_name,
        "decoded_project": decoded,
        "status": status,
        "is_current": bool(
            current_session_id and current_session_id == session_uuid
        ),
    }
