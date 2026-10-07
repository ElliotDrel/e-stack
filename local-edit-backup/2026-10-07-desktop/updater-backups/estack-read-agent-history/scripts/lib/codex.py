"""Codex (OpenAI codex-cli) session-history adapter.

Codex stores one *rollout* file per session, date-partitioned:

    ~/.codex/sessions/YYYY/MM/DD/rollout-<ISO-ts>-<uuid>.jsonl

Every line is ``{"timestamp": <UTC-ISO>, "type": <...>, "payload": {...}}``.
Top-level ``type`` is one of ``session_meta | event_msg | response_item |
turn_context | world_state | compacted``. Two layers carry the conversation:

* ``event_msg`` — the clean UI event stream. ``user_message`` / ``agent_message``
  hold the real typed prompt / assistant-visible text; ``patch_apply_end`` holds
  applied file edits; ``task_started`` / ``token_count`` are turn/usage bookkeeping.
* ``response_item`` — the raw model item stream (Responses API). ``message`` here
  *mirrors* the event_msg messages (would double-count), so we take messages from
  the event layer and use ``response_item`` only for ``reasoning`` (thinking),
  ``function_call`` and ``custom_tool_call`` (tool calls).

This module normalizes a rollout into the SAME entry shape Claude Code emits
(``{type, message:{role, content:[...]}, timestamp}``), so the rest of the
library — ``classify_entry``, ``get_messages``, ``extract_tool_calls``,
``files_touched``, ``_is_real_user_prompt``, ``session_summary`` — works on Codex
data unchanged. The only Codex-aware code lives here and at the discovery seams.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path


CODEX_DIR = Path.home() / ".codex"
CODEX_SESSIONS_DIR = CODEX_DIR / "sessions"


def sessions_dir() -> Path:
    """Root of the Codex rollout tree.

    Honors ``ESTACK_CODEX_SESSIONS_DIR`` so tests can point discovery at a
    fixture tree instead of the real ~/.codex.
    """
    override = os.environ.get("ESTACK_CODEX_SESSIONS_DIR")
    return Path(override) if override else CODEX_SESSIONS_DIR

# rollout-2026-07-15T13-32-50-019f66d6-a381-7db3-ac70-b4ac2e90e183.jsonl
#          └── ISO date+time (hyphenated) ──┘ └──────── session uuid ────────┘
_ROLLOUT_RE = re.compile(
    r"^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(?P<uuid>.+)$"
)


def is_codex_rollout(path: Path) -> bool:
    """True if a path is a Codex rollout .jsonl (by filename, no read needed).

    Claude transcripts are ``<uuid>.jsonl``; Codex rollouts are
    ``rollout-<ts>-<uuid>.jsonl`` — the prefix is unambiguous, so a rollout
    passed via ``--file`` is detected without touching the disk.
    """
    return path.suffix == ".jsonl" and path.name.startswith("rollout-")


def rollout_uuid(path: Path) -> str:
    """Session UUID from a rollout filename (falls back to the whole stem)."""
    m = _ROLLOUT_RE.match(path.stem)
    return m.group("uuid") if m else path.stem


def session_meta(path: Path) -> dict:
    """Parse the leading ``session_meta`` line → its payload dict.

    Reads only the first line. Returns {} if absent or unreadable.
    """
    try:
        with open(path, encoding="utf-8") as f:
            first = f.readline().strip()
    except OSError:
        return {}
    if not first:
        return {}
    try:
        obj = json.loads(first)
    except json.JSONDecodeError:
        return {}
    if obj.get("type") == "session_meta":
        return obj.get("payload", {}) or {}
    return {}


def codex_cwd(path: Path) -> str:
    """Working directory the Codex session ran in (from session_meta)."""
    return session_meta(path).get("cwd", "") or ""


def _text_block(text: str) -> dict:
    return {"type": "text", "text": text}


def _tool_use(name: str, tool_input: dict) -> dict:
    # No ``id`` on purpose: infer_status() treats a tool_use id with no matching
    # tool_result as a dangling call ("interrupted"). Codex outputs aren't mapped
    # back to tool_result blocks, so omitting the id keeps status inference honest.
    return {"type": "tool_use", "name": name, "input": tool_input}


# patch_apply_end change type → the Claude tool name that files_touched() keys on.
_PATCH_OP = {"add": "Write", "update": "Edit", "delete": "Edit"}


def _normalize_line(obj: dict) -> dict | None:
    """One raw Codex line → one Claude-shaped entry, or None to drop it."""
    ts = obj.get("timestamp")
    typ = obj.get("type")
    payload = obj.get("payload") or {}
    ptype = payload.get("type")

    if typ == "event_msg":
        if ptype == "user_message":
            msg = payload.get("message", "")
            if not isinstance(msg, str) or not msg.strip():
                return None
            return {
                "type": "user",
                "timestamp": ts,
                "message": {"role": "user", "content": [_text_block(msg)]},
            }
        if ptype == "agent_message":
            msg = payload.get("message", "")
            if not isinstance(msg, str) or not msg.strip():
                return None
            return {
                "type": "assistant",
                "timestamp": ts,
                "message": {"role": "assistant", "content": [_text_block(msg)]},
            }
        if ptype == "patch_apply_end":
            changes = payload.get("changes") or {}
            blocks = []
            for fpath, meta in changes.items():
                op = _PATCH_OP.get((meta or {}).get("type"), "Edit")
                blocks.append(_tool_use(op, {"file_path": fpath}))
            if not blocks:
                return None
            return {
                "type": "assistant",
                "timestamp": ts,
                "message": {"role": "assistant", "content": blocks},
            }
        return None

    if typ == "response_item":
        if ptype == "reasoning":
            # Codex reasoning: payload.summary is a list of {type, text} parts.
            parts = payload.get("summary") or payload.get("content") or []
            texts = [
                p.get("text", "") for p in parts
                if isinstance(p, dict) and p.get("text")
            ]
            think = "\n".join(t for t in texts if t.strip())
            if not think.strip():
                return None
            return {
                "type": "assistant",
                "timestamp": ts,
                "message": {
                    "role": "assistant",
                    "content": [{"type": "thinking", "thinking": think}],
                },
            }
        if ptype == "function_call":
            args = payload.get("arguments")
            try:
                parsed = json.loads(args) if isinstance(args, str) else (args or {})
            except json.JSONDecodeError:
                parsed = {"arguments": args}
            if not isinstance(parsed, dict):
                parsed = {"arguments": parsed}
            return {
                "type": "assistant",
                "timestamp": ts,
                "message": {
                    "role": "assistant",
                    "content": [_tool_use(payload.get("name", "?"), parsed)],
                },
            }
        if ptype == "custom_tool_call":
            return {
                "type": "assistant",
                "timestamp": ts,
                "message": {
                    "role": "assistant",
                    "content": [_tool_use(
                        payload.get("name", "?"),
                        {"input": payload.get("input", "")},
                    )],
                },
            }
        return None

    # session_meta, turn_context, world_state, compacted, response_item *_output,
    # task_started/complete, token_count, thread_settings_applied → not
    # conversation signal; drop.
    return None


def normalize_rollout(path: Path) -> list[dict]:
    """Read a rollout and return Claude-shaped entries in chronological order."""
    from . import parser as _parser  # reuse the truncation-safe line iterator
    out: list[dict] = []
    for obj in _parser.iter_lines(path):
        entry = _normalize_line(obj)
        if entry is not None:
            out.append(entry)
    return out


def list_codex_sessions(
    since: datetime | None = None,
    until: datetime | None = None,
    project: str | None = None,
) -> list[Path]:
    """Codex rollout files under ~/.codex/sessions, newest first.

    Filtered by file mtime against [since, until] (same semantics as
    paths.list_transcripts) and, when ``project`` is given, by a case-insensitive
    substring match against the session's cwd (encoded or raw form).
    """
    root = sessions_dir()
    if not root.exists():
        return []
    files = [f for f in root.rglob("rollout-*.jsonl") if f.is_file()]
    from . import parser as _parser
    if since is not None:
        since_ts = _parser.display_to_epoch(since)
        files = [f for f in files if f.stat().st_mtime >= since_ts]
    if until is not None:
        until_ts = _parser.display_to_epoch(until)
        files = [f for f in files if f.stat().st_mtime <= until_ts]
    if project:
        q = project.strip().lower()
        q_alt = q.replace("-", " ")
        kept = []
        for f in files:
            cwd = codex_cwd(f).lower()
            if q in cwd or q_alt in cwd:
                kept.append(f)
        files = kept
    files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    return files
