#!/usr/bin/env python3
"""Extract signal from local agent session transcripts (Claude Code + Codex).

See references/modes.md for the full mode reference.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Force UTF-8 output on Windows for emoji and non-ASCII content.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Make `from lib.* import …` work when run as a script.
_THIS_DIR = Path(__file__).resolve().parent
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

import os  # noqa: E402

from lib import paths as P  # noqa: E402
from lib import parser as PR  # noqa: E402
from lib import tools as T  # noqa: E402
from lib import search as S  # noqa: E402
from lib import subagents as SA  # noqa: E402
from lib import codex as CX  # noqa: E402


# ─────────────────────────────────────────────────────────────────────────────
# Codex (OpenAI codex-cli) integration
#
# Codex sessions live at ~/.codex/sessions (a FIXED path, not under --root), so
# --agent selects which agents' histories a cross-session mode merges, and Codex
# discovery is enabled only against the live root (or the test env override) —
# backups/custom roots have no Codex tree, and enabling it there would let the
# real ~/.codex leak into fixture-scoped runs.
# ─────────────────────────────────────────────────────────────────────────────

def _wants_claude(agent: str) -> bool:
    return agent in ("claude", "both")


def _wants_codex(agent: str) -> bool:
    return agent in ("codex", "both")


def _codex_enabled(root: Path) -> bool:
    return bool(os.environ.get("ESTACK_CODEX_SESSIONS_DIR")) or root == P.DEFAULT_LIVE_PROJECTS


def _codex_sessions(
    root: Path,
    agent: str,
    since: datetime | None,
    until: datetime | None,
    cwd: str | None,
    all_projects: bool,
    project: str | None,
    default_all: bool = False,
) -> list[Path]:
    """Codex rollout files matching a scope, honoring --agent and the root gate.

    --project / --cwd both narrow by the session's working directory (substring);
    --all-projects (or default_all) returns every Codex session in the window.
    """
    if not _wants_codex(agent) or not _codex_enabled(root):
        return []
    if project:
        return CX.list_codex_sessions(since, until, project=project)
    if cwd:
        return CX.list_codex_sessions(since, until, project=cwd)
    if all_projects or default_all:
        return CX.list_codex_sessions(since, until)
    return []


# Wide-scope search output budget. Full match windows across many sessions can
# balloon past the harness's ~25k-token Read cap, forcing a write-then-can't-read
# round trip. We summarize by default and degrade --full back to a summary once
# the rendered text would exceed this many characters (~10k tokens at ~4 ch/tok).
SEARCH_CHAR_BUDGET = 40_000
# Cap session lines in the summary view so the summary itself stays bounded.
# Overflow is counted and noted, never silently dropped.
SEARCH_SUMMARY_SESSION_CAP = 200


# ─────────────────────────────────────────────────────────────────────────────
# Single-file mode implementations
# ─────────────────────────────────────────────────────────────────────────────

def _last_messages(lines, n, role):
    """Last n messages with text for a role ('assistant' default, 'user', 'both').

    User-side messages exclude compact continuations and hook/skill isMeta
    injections — "last user message" means the human's actual typed prompt.
    """
    messages = PR.get_messages(lines)
    out = []
    for m in messages:
        if not m["texts"]:
            continue
        if role != "both" and m["role"] != role:
            continue
        if m["role"] == "user":
            if m["is_compact"] or lines[m["line_index"]].get("isMeta"):
                continue
        out.append(m)
    return out[-n:]


def mode_last(lines, n=5, role="assistant"):
    recent = _last_messages(lines, n, role)
    output = []
    for i, m in enumerate(recent, 1):
        label = "User" if m["role"] == "user" else "Assistant"
        output.append(f"=== {label} message -{len(recent) - i + 1} from end ===")
        output.append("\n".join(m["texts"]))
    if output:
        return "\n\n".join(output)
    return "No messages found." if role == "both" else f"No {role} messages found."


def mode_advisor(lines):
    results = []
    for obj in lines:
        if obj.get("type") in PR.NOISE_TYPES:
            continue
        msg = obj.get("message", {})
        if not isinstance(msg.get("content"), list):
            continue
        for block in msg["content"]:
            if block.get("type") == "advisor_tool_result":
                inner = block.get("content", {})
                if isinstance(inner, dict) and inner.get("text"):
                    results.append(inner["text"])
    if not results:
        return "No advisor calls found in this transcript."
    output = []
    for i, r in enumerate(results, 1):
        output.append(f"=== Advisor response #{i} ===\n{r}")
    return "\n\n".join(output)


def mode_pre_compact(lines, window=40):
    messages = PR.get_messages(lines)
    compact_idx = None
    for i, m in enumerate(messages):
        if m["is_compact"]:
            compact_idx = i
    if compact_idx is None:
        return (
            "No /compact found in this transcript. Showing last messages instead.\n\n"
            + mode_last(lines, 10)
        )
    start = max(0, compact_idx - window)
    pre = messages[start:compact_idx]
    output = [f"--- Pre-compact content ({len(pre)} exchanges before /compact) ---\n"]
    for m in pre:
        if m["texts"]:
            role_label = "USER" if m["role"] == "user" else "ASSISTANT"
            output.append(f"[{role_label}]\n" + "\n".join(m["texts"]))
    return "\n\n".join(output) if output else "No content found before compact."


def _dump_messages(lines, limit, role, since, until):
    """Messages for a dump: role- and time-filtered, then tail-limited.

    ``limit=0`` means no limit. Returns ``(messages, total_before_limit)`` so
    callers can tell the user when they were handed a tail.
    """
    messages = [m for m in PR.get_messages(lines) if m["texts"] or m["is_compact"]]
    # "User" entries include hook/skill isMeta injections and compact
    # continuations. Neither is something the human typed, and a dump exists to
    # show what was actually asked for — so drop them, matching `--mode last`.
    messages = [
        m for m in messages
        if m["role"] != "user"
        or m["is_compact"]
        or not lines[m["line_index"]].get("isMeta")
    ]
    messages = PR.filter_by_time(messages, since, until)
    if role and role != "both":
        # A role filter filters strictly: the /COMPACT boundary marker is a
        # user-side entry, so it goes too rather than breaking the promise.
        messages = [m for m in messages if m["role"] == role and not m["is_compact"]]
    total = len(messages)
    if limit and total > limit:
        return messages[-limit:], total
    return messages, total


def _note_truncated(shown, total, scope):
    """Truncation must be loud — a silent tail reads as a complete answer."""
    if total > shown:
        print(
            f"[note: showing the last {shown} of {total} messages in {scope} "
            f"— pass --n 0 for all of them]",
            file=sys.stderr,
        )


def mode_dump(lines, limit=80, role="both", since=None, until=None):
    recent, total = _dump_messages(lines, limit, role, since, until)
    _note_truncated(len(recent), total, "this window" if (since or until) else "the session")
    who = "" if role in (None, "both") else f", {role} only"
    where = " in window" if (since or until) else ""
    output = [f"--- Conversation dump ({len(recent)} of {total} messages"
              f"{where}{who}) ---\n"]
    for m in recent:
        if m["is_compact"]:
            output.append("\n--- /COMPACT ---\n")
            continue
        role_label = "USER" if m["role"] == "user" else "ASSISTANT"
        text = "\n".join(m["texts"])
        if len(text) > 1500:
            text = text[:1500] + "\n[...truncated...]"
        output.append(f"[{role_label}]\n{text}")
    return "\n\n".join(output)


def mode_debug(lines):
    output = []
    type_counts: dict[str, int] = {}
    for obj in lines:
        t = obj.get("type", "<missing>")
        type_counts[t] = type_counts.get(t, 0) + 1
    output.append("=== Entry type distribution ===")
    for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        marker = (
            " [NOISE - skipped]" if t in PR.NOISE_TYPES
            else " [SIGNAL]" if t in ("user", "assistant") else ""
        )
        output.append(f"  {count:4d}  {t}{marker}")

    block_type_counts: dict[str, int] = {}
    signal_entries = [o for o in lines if o.get("type") not in PR.NOISE_TYPES]
    for obj in signal_entries:
        content = obj.get("message", {}).get("content", [])
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    bt = block.get("type", "<missing>")
                    block_type_counts[bt] = block_type_counts.get(bt, 0) + 1

    output.append("\n=== Content block types (across all signal messages) ===")
    if block_type_counts:
        for bt, count in sorted(block_type_counts.items(), key=lambda x: -x[1]):
            note = ""
            if bt == "advisor_tool_result":
                note = "  ← advisor responses live here"
            elif bt == "text":
                note = "  ← assistant/user text"
            elif bt == "tool_use":
                note = "  ← regular tool calls"
            elif bt == "server_tool_use":
                note = "  ← server-side tools (advisor calls)"
            output.append(f"  {count:4d}  {bt}{note}")
    else:
        output.append("  (no block-structured content found — content may be plain strings)")

    output.append("\n=== Advisor result probe ===")
    advisor_found = []
    for obj in lines:
        msg = obj.get("message", {})
        content = msg.get("content", [])
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "advisor_tool_result":
                inner = block.get("content", {})
                has_text = isinstance(inner, dict) and bool(inner.get("text"))
                advisor_found.append({
                    "outer_keys": list(block.keys()),
                    "inner_type": type(inner).__name__,
                    "inner_keys": list(inner.keys()) if isinstance(inner, dict) else "N/A",
                    "has_text": has_text,
                })
    if advisor_found:
        output.append(f"  Found {len(advisor_found)} advisor_tool_result block(s)")
        for i, a in enumerate(advisor_found[:3], 1):
            output.append(
                f"  Block #{i}: outer_keys={a['outer_keys']}, "
                f"inner={a['inner_type']}({a['inner_keys']}), has_text={a['has_text']}"
            )
    else:
        output.append("  No advisor_tool_result blocks found.")
        output.append("  → If you expected advisor output, the block type name may have changed.")

    output.append("\n=== Compact marker probe ===")
    compact_hits = []
    for obj in lines:
        msg = obj.get("message", {})
        if msg.get("role") != "user":
            continue
        content = msg.get("content", "")
        text = content if isinstance(content, str) else " ".join(
            b.get("text", "") for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
        if PR.COMPACT_MARKER in text:
            compact_hits.append(obj.get("type", "?"))
    if compact_hits:
        output.append(f"  Found {len(compact_hits)} compact marker(s) in entry type(s): {compact_hits}")
    else:
        output.append("  No compact markers found in this transcript.")

    output.append("\n=== Sample assistant messages (first 3 with text) ===")
    messages = PR.get_messages(lines)
    samples = [m for m in messages if m["role"] == "assistant" and m["texts"]][:3]
    if samples:
        for i, m in enumerate(samples, 1):
            preview = m["texts"][0][:200].replace("\n", " ")
            output.append(
                f"  [{i}] \"{preview}{'...' if len(m['texts'][0]) > 200 else ''}\""
            )
    else:
        output.append("  No assistant messages with text found.")
        output.append("  → Check that get_messages() is correctly identifying signal entries.")

    return "\n".join(output)


# ─────────────────────────────────────────────────────────────────────────────
# New v2 modes
# ─────────────────────────────────────────────────────────────────────────────

def _fmt_mtime(mtime: float) -> str:
    return PR.epoch_to_display(mtime).strftime("%Y-%m-%d %H:%M")


def _print_json(data) -> None:
    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))


def _emit(result) -> None:
    """Print a mode result: strings as-is, anything else as JSON."""
    if isinstance(result, str):
        print(result)
    else:
        _print_json(result)


def _summary_json(s: dict) -> dict:
    """JSON-safe copy of a session_summary dict."""
    out = dict(s)
    out["path"] = str(s.get("path", ""))
    out["files_touched"] = [str(p) for p in s.get("files_touched", [])]
    if s.get("mtime"):
        out["mtime_iso"] = _fmt_mtime(s["mtime"])
    return out


def _ts_iso(raw) -> str | None:
    """Raw JSONL timestamp (UTC) → display-timezone ISO string."""
    ts = PR._parse_timestamp(raw)
    if ts is not None:
        return ts.isoformat()
    return raw if isinstance(raw, str) else None


def _messages_json(messages: list[dict]) -> list[dict]:
    return [
        {
            "role": m["role"],
            "timestamp": _ts_iso(m.get("timestamp")),
            "is_compact": m["is_compact"],
            "text": "\n".join(m["texts"]),
        }
        for m in messages
        if m["texts"] or m["is_compact"]
    ]


_STATUS_GLYPH = {
    "clean": "✓", "interrupted": "!", "pending-user": "?", "active": "●",
}


def list_session_row(
    summary: dict, show_project: bool = False, current_uuid: str | None = None
) -> str:
    mtime = _fmt_mtime(summary["mtime"])
    size_kb = summary["size"] / 1024
    uuid_short = summary["uuid"][:8]
    msg_n = summary.get("msg_count", 0)
    flags = ""
    if summary.get("has_compact"):
        flags += "[C]"
    if summary.get("has_subagents"):
        flags += "[S]"
    flags = flags or "   "
    status = _STATUS_GLYPH.get(summary.get("status", "clean"), "?")
    marker = "[*]" if summary.get("is_current") else "   "
    proj = ""
    if show_project:
        src = "codex▹ " if summary.get("source") == "codex" else ""
        proj = f"  {src}{summary.get('decoded_project', summary.get('cwd', ''))}"
    title = summary.get("title") or summary.get("first_prompt", "")
    title = title[:80]
    return (
        f"{marker} {mtime}  {size_kb:6.0f}KB  {uuid_short}  msgs={msg_n:<4}  "
        f"{flags}  {status}{proj}  {title}"
    )


def _scoped_project_dirs(
    root: Path,
    cwd: str | None,
    all_projects: bool,
    project: str | None,
    default_all: bool = False,
) -> list[Path] | None:
    """Resolve --cwd / --all-projects / --project into project directories.

    --project wins (name filter across all projects under root); then --cwd;
    then --all-projects (or default_all). Returns None when no scope was given.
    """
    if project:
        dirs = P.filter_projects(root, project)
        if not dirs:
            raise FileNotFoundError(f"No project directory matches --project {project!r}")
        return dirs
    if cwd:
        return [P.find_project_dir(cwd, root)]
    if all_projects or default_all:
        return P.list_projects(root)
    return None


def mode_list(
    root: Path,
    cwd: str | None,
    all_projects: bool,
    since: datetime | None,
    until: datetime | None,
    exclude_current: bool,
    current_uuid: str | None,
    project: str | None = None,
    fmt: str = "text",
    agent: str = "both",
):
    """Enriched v2 list — columns: marker, mtime, size, uuid-short, msgs, flags, status, project, title."""
    if not (all_projects or project or cwd):
        return "--cwd, --project, or --all-projects required"
    project_dirs = (
        _scoped_project_dirs(root, cwd, all_projects, project) or []
    ) if _wants_claude(agent) else []
    codex_sessions = _codex_sessions(root, agent, since, until, cwd, all_projects, project)
    files: list[Path] = []
    for pd in project_dirs:
        files.extend(P.list_transcripts(pd, since=since, until=until))
    files.extend(codex_sessions)
    rows = []
    for f in files:
        summary = PR.session_summary(f, current_session_id=current_uuid)
        if exclude_current and summary.get("is_current"):
            continue
        rows.append(summary)
    rows.sort(key=lambda s: s["mtime"], reverse=True)
    if fmt == "json":
        return [_summary_json(r) for r in rows]
    if not rows:
        return "No transcript files found."
    show_proj = all_projects or bool(project) or len(project_dirs) > 1 or bool(codex_sessions)
    return "\n".join(list_session_row(r, show_proj, current_uuid) for r in rows)


def mode_lookup(
    uuid_prefix: str, root: Path, fmt: str = "text", agent: str = "both"
) -> tuple[int, object]:
    """Resolve a UUID prefix to an absolute path. Returns (exit_code, output)."""
    if not uuid_prefix:
        return 1, ({"error": "--uuid required"} if fmt == "json" else "--uuid required")
    matches: list[Path] = []
    if _wants_claude(agent):
        for pd in P.list_projects(root):
            for f in P.list_transcripts(pd):
                if f.stem.startswith(uuid_prefix):
                    matches.append(f)
    if _wants_codex(agent) and _codex_enabled(root):
        for f in CX.list_codex_sessions():
            if CX.rollout_uuid(f).startswith(uuid_prefix):
                matches.append(f)
    if fmt == "json":
        code = 0 if len(matches) == 1 else (1 if not matches else 2)
        return code, {
            "prefix": uuid_prefix,
            "path": str(matches[0]) if len(matches) == 1 else None,
            "matches": [str(m) for m in matches],
        }
    if not matches:
        return 1, f"No session found with UUID prefix: {uuid_prefix}"
    if len(matches) > 1:
        return 2, (
            f"Ambiguous prefix {uuid_prefix!r} matches {len(matches)} sessions:\n"
            + "\n".join(str(m) for m in matches)
        )
    return 0, str(matches[0])


def mode_whoami(root: Path, cwd: str | None, fmt: str = "text") -> tuple[int, object]:
    """Resolve the CURRENT live session (via CLAUDE_CODE_SESSION_ID) to its .jsonl path.

    The system prompt's scratchpad path and the CLAUDE_CODE_SESSION_ID env var
    both carry the running session's UUID — this turns that into a path
    directly, without listing every session in the project and guessing by
    recency. See lib.paths.current_session_id for why that's the env var
    (not the similarly-named ${CLAUDE_SESSION_ID} SKILL.md substitution).
    """
    uuid = P.current_session_id()
    if not uuid:
        msg = (
            "CLAUDE_CODE_SESSION_ID is not set — there's no live session to resolve. "
            "Use --mode list or --mode find to locate a session by recency or content."
        )
        return 1, ({"error": msg, "uuid": None} if fmt == "json" else msg)

    path = None
    if cwd:
        try:
            pd = P.find_project_dir(cwd, root)
            candidate = pd / f"{uuid}.jsonl"
            if candidate.exists():
                path = candidate
        except FileNotFoundError:
            pass
    if path is None:
        for pd in P.list_projects(root):
            candidate = pd / f"{uuid}.jsonl"
            if candidate.exists():
                path = candidate
                break

    if path is None:
        msg = (
            f"Current session ID {uuid} but no matching .jsonl was found under {root}. "
            "The transcript may not be written yet, or --root points elsewhere."
        )
        return 1, ({"error": msg, "uuid": uuid} if fmt == "json" else msg)

    project = P.decode_project_name(path.parent.name)
    if fmt == "json":
        return 0, {"uuid": uuid, "path": str(path), "project": project}
    return 0, f"{uuid}\n{path}\nproject: {project}"


def mode_find(
    root: Path,
    title_q: str | None,
    first_prompt_q: str | None,
    current_uuid: str | None,
    project: str | None = None,
    fmt: str = "text",
    agent: str = "both",
):
    """Search session metadata by title or first prompt."""
    if not (title_q or first_prompt_q):
        return "--title or --first-prompt required"
    project_dirs = _scoped_project_dirs(
        root, None, False, project, default_all=True
    ) if _wants_claude(agent) else []
    files: list[Path] = []
    for pd in project_dirs:
        files.extend(P.list_transcripts(pd))
    files.extend(_codex_sessions(root, agent, None, None, None, False, project, default_all=True))
    rows = []
    for f in files:
        summary = PR.session_summary(f, current_session_id=current_uuid)
        hit = False
        if title_q and title_q.lower() in (summary.get("title", "") or "").lower():
            hit = True
        if first_prompt_q and first_prompt_q.lower() in (summary.get("first_prompt", "") or "").lower():
            hit = True
        if hit:
            rows.append(summary)
    rows.sort(key=lambda s: s["mtime"], reverse=True)
    if fmt == "json":
        return [_summary_json(r) for r in rows]
    if not rows:
        return "No sessions matched."
    return "\n".join(list_session_row(r, show_project=True) for r in rows)


def mode_resume_cmd(uuid_prefix: str, root: Path, fmt: str = "text") -> tuple[int, object]:
    """Generate `cd <cwd>; claude --resume <uuid>` for a UUID prefix."""
    code, out = mode_lookup(uuid_prefix, root, agent="claude")
    if code != 0:
        if fmt == "json":
            return code, {"error": out}
        return code, out
    path = Path(out)
    encoded = path.parent.name
    # Best-effort decode for cwd guess: we have the encoded form, the raw cwd
    # cannot be unambiguously recovered, so emit a comment with the encoded name.
    decoded = P.decode_project_name(encoded)
    if fmt == "json":
        return 0, {
            "uuid": path.stem,
            "path": str(path),
            "project": decoded,
            "encoded": encoded,
            "command": f'cd "<original cwd>"; claude --resume {path.stem}',
        }
    return 0, (
        f'# project: {decoded}\n'
        f'# encoded: {encoded}\n'
        f'cd "<original cwd>"; claude --resume {path.stem}'
    )


def mode_brief(
    path: Path, include_subagents: bool, current_uuid: str | None, fmt: str = "text"
):
    """6-line single-session summary for fan-out triage."""
    summary = PR.session_summary(path, current_session_id=current_uuid)
    if fmt == "json":
        data = _summary_json(summary)
        if include_subagents and summary.get("subagent_count"):
            data["subagent_finals"] = [
                {"id": agent_id, "agentType": meta.get("agentType", "unknown"), "text": text}
                for agent_id, meta, text in SA.agent_finals(path)
            ]
        return data
    if not summary.get("exists"):
        return f"File not found: {path}"
    star = " [*]" if summary["is_current"] else ""
    status = summary["status"]
    line1 = f"{summary['uuid']} · {summary['decoded_project']} · {_fmt_mtime(summary['mtime'])} · {status}{star}"
    line2 = f"intent: {summary['first_prompt'] or '(no user prompts)'}"
    line3 = f"last:   {summary['last_assistant'] or '(no assistant messages)'}"
    files = summary["files_touched"][:3]
    files_str = ", ".join(str(f) for f in files) or "(none)"
    line4 = f"edits:  {summary['edit_count']} files — {files_str}"
    tools = summary["tool_counts"]
    tools_str = " ".join(f"{k}={v}" for k, v in sorted(tools.items(), key=lambda x: -x[1])) or "(none)"
    line5 = f"tools:  {tools_str}"
    sa_types = summary["subagent_types"]
    sa_types_str = ""
    if sa_types:
        sa_types_str = " [" + " ".join(f"{k}={v}" for k, v in sorted(sa_types.items(), key=lambda x: -x[1])) + "]"
    line6 = f"subagents: {summary['subagent_count']} spawned{sa_types_str}"
    out = "\n".join([line1, line2, line3, line4, line5, line6])

    if include_subagents and summary["subagent_count"]:
        out += "\n"
        for agent_id, meta, text in SA.agent_finals(path):
            atype = meta.get("agentType", "unknown")
            short = agent_id.replace("agent-", "")[:8]
            tail = (text[:1500] + "…") if len(text) > 1500 else text
            out += f"\n[subagent {short} · {atype}]\n{tail}\n"
    return out


def _tool_calls_json(path: Path, tool_filter: set[str] | None, include_input: bool) -> list[dict]:
    lines = PR.parse_lines(path)
    calls = T.extract_tool_calls(lines, tool_filter)
    out = []
    for c in calls:
        ts = PR._parse_timestamp(c.get("timestamp"))
        row = {
            "timestamp": ts.isoformat() if ts else None,
            "tool": c["name"],
            "summary": T.format_tool_call(c),
        }
        if include_input:
            row["input"] = c.get("input", {})
        out.append(row)
    return out


def mode_changelog(path: Path, fmt: str = "text"):
    """`HH:MM:SS  TOOL  one-line-summary`, day-grouped."""
    if fmt == "json":
        return _tool_calls_json(path, None, include_input=False)
    lines = PR.parse_lines(path)
    calls = T.extract_tool_calls(lines)
    if not calls:
        return "No tool calls found in this session."
    out: list[str] = []
    last_day = None
    for c in calls:
        ts = PR._parse_timestamp(c.get("timestamp"))
        day = ts.strftime("%Y-%m-%d") if ts else "unknown-date"
        time = ts.strftime("%H:%M:%S") if ts else "??:??:??"
        if day != last_day:
            out.append(f"\n=== {day} ===")
            last_day = day
        out.append(f"  {time}  {T.format_tool_call(c)}")
    return "\n".join(out).lstrip("\n")


def mode_file_edits(path: Path, fmt: str = "text"):
    lines = PR.parse_lines(path)
    files = T.files_touched(lines)
    if fmt == "json":
        return [
            {"path": str(fp), "ops": ops}
            for fp, ops in sorted(files.items(), key=lambda x: str(x[0]))
        ]
    if not files:
        return "No file operations found."
    out = []
    for fp, ops in sorted(files.items(), key=lambda x: str(x[0])):
        # Count repeats — ops is a list of operation names
        n = len(ops)
        suffix = f" ({n}x)" if n > 1 else ""
        out.append(f"{fp}{suffix}  [{', '.join(ops)}]")
    return "\n".join(out)


def mode_tool_calls(path: Path, tool_filter: set[str] | None, fmt: str = "text"):
    if fmt == "json":
        return _tool_calls_json(path, tool_filter, include_input=True)
    lines = PR.parse_lines(path)
    calls = T.extract_tool_calls(lines, tool_filter)
    if not calls:
        return "No tool calls found."
    out = []
    for c in calls:
        ts = PR._parse_timestamp(c.get("timestamp"))
        time = ts.strftime("%Y-%m-%d %H:%M:%S") if ts else "?"
        out.append(f"\n[{time}]\n  {T.format_tool_call(c)}")
    return "\n".join(out).lstrip("\n")


def _one_line(text: str, n: int) -> str:
    """Collapse whitespace to a single line and truncate to n chars."""
    s = " ".join((text or "").split())
    return s[:n] + ("…" if len(s) > n else "")


def _search_project_label(path: Path) -> str:
    """Project label for a search hit — Codex-aware (parent dir is a date for Codex)."""
    if CX.is_codex_rollout(path):
        cwd = CX.codex_cwd(path)
        base = P.decode_project_name(P.encode_cwd(cwd)) if cwd else "codex"
        return f"codex ▹ {base}"
    return P.decode_project_name(path.parent.name)


def _sessions_by_mtime(matches) -> list:
    """Group matches by session, return (session_path, matches) sorted newest first."""
    by_session: dict[Path, list] = {}
    for m in matches:
        by_session.setdefault(m.session_path, []).append(m)
    return sorted(by_session.items(), key=lambda kv: kv[1][0].mtime, reverse=True)


def _render_search_full(matches) -> str:
    """Full per-match windows grouped by session, newest first (the detailed view)."""
    out = []
    for sp, ms in _sessions_by_mtime(matches):
        out.append(f"{'=' * 60}\nSession: {sp.name}  ({_fmt_mtime(ms[0].mtime)})\n{'=' * 60}")
        for i, m in enumerate(ms, 1):
            label = f"--- Match #{i} [{m.role}/{m.where}] ---"
            out.append(f"{label}\n{m.window_text[:1500]}")
    return "\n\n".join(out)


def _render_search_summary(query: str, matches, already_full: bool = False) -> str:
    """One line per session: mtime · uuid8 · project · hits · first snippet.

    Every hit is counted in the header; sessions past the cap are counted in a
    footer note, never silently dropped. When ``already_full`` is set (the
    summary is a degraded ``--full`` result), the footer drops the "use --full"
    suggestion the caller already tried.
    """
    sessions = _sessions_by_mtime(matches)
    total_hits = len(matches)
    total_sessions = len(sessions)
    shown = sessions[:SEARCH_SUMMARY_SESSION_CAP]
    hit_w = "match" if total_hits == 1 else "matches"
    sess_w = "session" if total_sessions == 1 else "sessions"
    lines = [f'=== "{query}": {total_hits} {hit_w} across {total_sessions} {sess_w} ===']
    for sp, ms in shown:
        uuid8 = (CX.rollout_uuid(sp) if CX.is_codex_rollout(sp) else sp.stem)[:8]
        project = _search_project_label(sp)
        snippet = _one_line(ms[0].window_text, 120)
        n = len(ms)
        # Pad the unit so singular ("hit ") and plural ("hits") align the snippet column.
        hits = f'{n:>4} hit' + ('s' if n != 1 else ' ')
        lines.append(f'{_fmt_mtime(ms[0].mtime)}  {uuid8}  {project[:28]:<28}  {hits}  · "{snippet}"')
    if total_sessions > len(shown):
        lines.append(
            f"… and {total_sessions - len(shown)} more session(s) not shown — "
            f"narrow with --project or a tighter --query."
        )
    # On a degrade (already_full) the [note] prefix already carries the actionable
    # hint, so don't append a second — possibly conflicting — guidance line.
    if not already_full:
        lines.append("Use --full for match windows, or narrow with --project / a tighter --query.")
    return "\n".join(lines)


def _search_summary_json(matches) -> list:
    """Compact per-session metadata (no windows) for structured consumers."""
    return [
        {
            "session": str(sp),
            "uuid": CX.rollout_uuid(sp) if CX.is_codex_rollout(sp) else sp.stem,
            "source": "codex" if CX.is_codex_rollout(sp) else "claude",
            "project": _search_project_label(sp),
            "mtime_iso": _fmt_mtime(ms[0].mtime),
            "hits": len(ms),
            "first_snippet": _one_line(ms[0].window_text, 120),
        }
        for sp, ms in _sessions_by_mtime(matches)
    ]


def mode_search_v2(
    root: Path,
    cwd: str | None,
    all_projects: bool,
    file_path: Path | None,
    query: str,
    role: str,
    in_channel: str,
    since: datetime | None,
    until: datetime | None,
    project: str | None = None,
    fmt: str = "text",
    exclude_current: bool = False,
    current_uuid: str | None = None,
    full: bool = False,
    agent: str = "both",
):
    """Cross-scope search with role/in-channel filters (Claude Code + Codex)."""
    matches: list = []
    if file_path:
        matches = S.search_session(file_path, query, role, in_channel, since, until)
    elif project:
        if _wants_claude(agent):
            for pd in _scoped_project_dirs(root, None, False, project):
                matches.extend(S.search_project(pd, query, role, in_channel, since, until))
    elif all_projects:
        if _wants_claude(agent):
            matches = list(S.search_all_projects(root, query, role, in_channel, since, until))
    elif cwd:
        if _wants_claude(agent):
            pd = P.find_project_dir(cwd, root)
            matches = list(S.search_project(pd, query, role, in_channel, since, until))
    else:
        # Unreachable from the CLI (the dispatch guarantees a scope flag), but keep
        # the direct-call contract honest: JSON callers get a JSON object.
        msg = "Provide --file, --cwd, --project, or --all-projects"
        return {"error": msg} if fmt == "json" else msg

    # Fold Codex rollouts into wide-scope searches (single-file --file is handled above).
    if not file_path:
        # until=None: search_session applies the message-timestamp window itself.
        for f in _codex_sessions(
            root, agent, since, None, cwd, all_projects, project, default_all=all_projects
        ):
            matches.extend(S.search_session(f, query, role, in_channel, since, until))

    if exclude_current and current_uuid:
        matches = [m for m in matches if m.session_path.stem != current_uuid]

    # Single-file scope is narrow and won't overflow — render full by default.
    # Wide scope (cwd / project / all-projects) summarizes unless --full is set.
    wide = file_path is None

    if fmt == "json":
        if wide and not full:
            return _search_summary_json(matches)
        return [
            {
                "session": str(m.session_path),
                "mtime_iso": _fmt_mtime(m.mtime),
                "role": m.role,
                "where": m.where,
                "timestamp": _ts_iso(m.timestamp),
                "window": m.window_text,
            }
            for m in matches
        ]

    if not matches:
        return f"No matches for '{query}'."

    if wide and not full:
        return _render_search_summary(query, matches)

    # Full render (single-file, or wide + --full), bounded by the char budget so
    # the output never exceeds what the reader accepts. Degrade to summary if it would.
    full_text = _render_search_full(matches)
    if len(full_text) > SEARCH_CHAR_BUDGET:
        # Ceiling-round the size so it always reads as strictly over the budget.
        size_k = (len(full_text) + 999) // 1000
        if wide:
            hint = "Use a tighter --query / --role / --in, or --file <session> to read one session in full."
        else:
            hint = "This one session has many matches; use a tighter --query / --role / --in to narrow."
        note = (
            f"[note: full output is ~{size_k}K chars (> "
            f"{SEARCH_CHAR_BUDGET // 1000}K budget) — showing a summary instead. {hint}]"
        )
        return note + "\n" + _render_search_summary(query, matches, already_full=True)
    return full_text


def mode_subagent_list(path: Path, fmt: str = "text"):
    subs = P.list_subagents(path)
    if fmt == "json":
        out = []
        for sa in subs:
            meta = SA.load_meta(sa)
            out.append({
                "id": sa.stem,
                "agentType": meta.get("agentType", "unknown"),
                "description": meta.get("description", ""),
                "path": str(sa),
                "size_kb": round(sa.stat().st_size / 1024, 1),
                "mtime_iso": _fmt_mtime(sa.stat().st_mtime),
            })
        return out
    if not subs:
        return "No subagent transcripts found."
    out = [f"Subagents for {path.name}:"]
    for sa in subs:
        meta = SA.load_meta(sa)
        size_kb = sa.stat().st_size / 1024
        mtime = _fmt_mtime(sa.stat().st_mtime)
        out.append(
            f"  {mtime}  {size_kb:5.0f}KB  {sa.stem}  "
            f"type={meta['agentType']}  \"{meta['description'][:60]}\""
        )
    return "\n".join(out)


def mode_subagent_finals(path: Path, fmt: str = "text"):
    finals = SA.agent_finals(path)
    if fmt == "json":
        return [
            {"id": agent_id, "agentType": meta.get("agentType", "unknown"), "text": text}
            for agent_id, meta, text in finals
        ]
    if not finals:
        return "No subagent transcripts found."
    blocks = []
    for agent_id, meta, text in finals:
        atype = meta.get("agentType", "unknown")
        header = f"=== {agent_id} ({atype}) ==="
        blocks.append(f"{header}\n\n{text or '(no assistant output)'}")
    return "\n\n".join(blocks)


def mode_resume_prev(cwd: str, root: Path, n: int = 10, fmt: str = "text"):
    pd = P.find_project_dir(cwd, root)
    files = P.list_transcripts(pd)
    if not files:
        return {"error": "No prior sessions."} if fmt == "json" else "No prior sessions."
    f = files[0]
    lines = PR.parse_lines(f)
    if fmt == "json":
        messages = [m for m in PR.get_messages(lines) if m["texts"]][-n:]
        return {
            "session": f.stem,
            "path": str(f),
            "mtime_iso": _fmt_mtime(f.stat().st_mtime),
            "messages": _messages_json(messages),
        }
    banner = f"--- Resuming from {f.stem} ({_fmt_mtime(f.stat().st_mtime)}) ---\n"
    return banner + mode_dump(lines, n)


def mode_count(
    root: Path,
    cwd: str | None,
    all_projects: bool,
    query: str,
    role: str,
    in_channel: str,
    since: datetime | None,
    until: datetime | None,
    project: str | None = None,
    exclude_current: bool = False,
    current_uuid: str | None = None,
    agent: str = "both",
) -> dict:
    sessions = 0
    matches = 0
    total_msgs = 0
    sources: list[Path] = []
    project_dirs = _scoped_project_dirs(root, cwd, all_projects, project) if _wants_claude(agent) else None
    for pd in (project_dirs or []):
        # since-only mtime prefilter, same as search: a session modified after
        # `until` can still hold in-window matches (the per-message window is
        # applied inside search_session).
        sources.extend(P.list_transcripts(pd, since=since))
    sources.extend(_codex_sessions(root, agent, since, None, cwd, all_projects, project))
    if exclude_current and current_uuid:
        sources = [f for f in sources if f.stem != current_uuid]
    for f in sources:
        ms = S.search_session(f, query, role, in_channel, since, until)
        total_msgs += len(PR.get_messages(PR.parse_lines(f)))
        if ms:
            sessions += 1
            matches += len(ms)
    return {"sessions": sessions, "messages": total_msgs, "matches": matches}


def _tally_tool_usage(
    groups: list[list[Path]],
    tool_filter: set[str] | None,
    since: datetime | None,
    until: datetime | None,
) -> tuple[dict[str, int], dict[str, int], int, int]:
    """Tally tool_use blocks by name (Skill sub-tallied by skill) over session groups.

    Each group is the files of ONE logical session — the parent transcript plus,
    when subagents are folded in, its `agent-*.jsonl` siblings. A group counts as
    one session-with-calls if any of its files contributed a call.

    Returns (tool_counts, skill_counts, total_calls, sessions_with_calls).
    Keys on invocation STRUCTURE (a tool_use block's name / input.skill), so it
    is immune to the substring false-positives that plague text search — the
    word "ast-grep" in a CLAUDE.md or a bash command never counts as a call.
    """
    tool_counts: dict[str, int] = {}
    skill_counts: dict[str, int] = {}
    total = 0
    sessions_with = 0
    window = since is not None or until is not None
    for group in groups:
        hit = False
        for f in group:
            try:
                lines = PR.parse_lines(f)
            except Exception as e:  # noqa: BLE001 — one bad file shouldn't abort the tally
                print(f"Error reading {f.name}: {e}", file=sys.stderr)
                continue
            for c in T.extract_tool_calls(lines, tool_filter):
                if window:
                    ts = PR._parse_timestamp(c.get("timestamp"))
                    if ts is None:
                        continue
                    if ts.tzinfo is not None:
                        ts = ts.replace(tzinfo=None)
                    # Half-open window [since, until): since inclusive, until exclusive.
                    if since is not None and ts < since:
                        continue
                    if until is not None and ts >= until:
                        continue
                name = c["name"] or "(unknown)"
                tool_counts[name] = tool_counts.get(name, 0) + 1
                total += 1
                hit = True
                if name == "Skill":
                    sk = (c.get("input") or {}).get("skill") or "(unnamed)"
                    skill_counts[sk] = skill_counts.get(sk, 0) + 1
        if hit:
            sessions_with += 1
    return tool_counts, skill_counts, total, sessions_with


def mode_tool_usage(
    root: Path,
    cwd: str | None,
    all_projects: bool,
    file_path: Path | None,
    since: datetime | None,
    until: datetime | None,
    tool_filter: set[str] | None = None,
    project: str | None = None,
    exclude_current: bool = False,
    include_subagents: bool = False,
    current_uuid: str | None = None,
    fmt: str = "text",
    agent: str = "both",
):
    """Tally tool_use blocks by tool name; Skill calls sub-tallied by skill name.

    Answers "which tools/skills do I actually use" by counting real invocations,
    not text occurrences. Scope is --file (one session) or the usual
    --cwd/--project/--all-projects. --tool narrows to a subset (e.g. --tool Skill).
    --include-subagents folds each session's agent-*.jsonl tool calls into its tally.
    Codex tool calls (exec, wait, applied edits) fold in under --agent both/codex.
    """
    if file_path:
        parents = [file_path]
    else:
        if not (all_projects or project or cwd):
            return "--file, --cwd, --project, or --all-projects required"
        project_dirs = _scoped_project_dirs(root, cwd, all_projects, project) if _wants_claude(agent) else []
        parents = []
        for pd in (project_dirs or []):
            # `since` is a safe lower-bound mtime pre-filter (a session whose last
            # event predates `since` holds no in-window calls). `until` is NOT a
            # safe mtime filter — a session modified after `until` can still hold
            # calls inside the window — so the upper bound is applied per-call in
            # _tally_tool_usage, mirroring timeline/engagement.
            parents.extend(P.list_transcripts(pd, since=since))
        # until=None: per-call window filter runs in _tally_tool_usage.
        parents.extend(_codex_sessions(root, agent, since, None, cwd, all_projects, project))
        if exclude_current and current_uuid:
            parents = [f for f in parents if f.stem != current_uuid]

    groups = []
    for p in parents:
        group = [p]
        if include_subagents:
            group.extend(P.list_subagents(p))
        groups.append(group)

    tool_counts, skill_counts, total, sessions_with = _tally_tool_usage(
        groups, tool_filter, since, until
    )
    tools_sorted = sorted(tool_counts.items(), key=lambda x: (-x[1], x[0]))
    skills_sorted = sorted(skill_counts.items(), key=lambda x: (-x[1], x[0]))

    if fmt == "json":
        return {
            "total": total,
            "sessions": sessions_with,
            "tools": [{"tool": k, "count": v} for k, v in tools_sorted],
            "skills": [{"skill": k, "count": v} for k, v in skills_sorted],
        }

    if total == 0:
        return "No tool calls found."
    out = [f"Tool calls ({total} total across {sessions_with} session(s)):"]
    for name, count in tools_sorted:
        out.append(f"  {count:5d}  {name}")
        if name == "Skill" and skills_sorted:
            for i, (sk, n) in enumerate(skills_sorted):
                glyph = "└" if i == len(skills_sorted) - 1 else "├"
                out.append(f"         {glyph} {n} {sk}")
    return "\n".join(out)


def mode_journal(
    root: Path,
    cwd: str | None,
    all_projects: bool,
    since: datetime | None,
    until: datetime | None,
    current_uuid: str | None,
    project: str | None = None,
    fmt: str = "text",
    exclude_current: bool = False,
    agent: str = "both",
):
    if not (all_projects or project or cwd):
        return "--cwd, --project, or --all-projects required"
    pds = _scoped_project_dirs(root, cwd, all_projects, project) if _wants_claude(agent) else []
    blocks = []
    rows = []
    files: list[Path] = []
    for pd in (pds or []):
        files.extend(P.list_transcripts(pd, since=since, until=until))
    files.extend(_codex_sessions(root, agent, since, until, cwd, all_projects, project))
    for f in files:
        summary = PR.session_summary(f, current_session_id=current_uuid)
        if exclude_current and summary.get("is_current"):
            continue
        rows.append(summary)
    rows.sort(key=lambda s: s["mtime"], reverse=True)
    if fmt == "json":
        return [_summary_json(s) for s in rows]
    for s in rows:
        day = PR.epoch_to_display(s["mtime"]).strftime("%Y-%m-%d")
        src = "codex ▹ " if s.get("source") == "codex" else ""
        blocks.append(
            f"=== {day} · {s['uuid'][:8]} · {src}{s['decoded_project']} ===\n"
            f"  prompt: {s['first_prompt'] or '(none)'}\n"
            f"  ended:  {s['last_assistant'] or '(none)'}\n"
            f"  edits:  {s['edit_count']} files\n"
            f"  tools:  {sum(s['tool_counts'].values())} calls "
            f"({', '.join(f'{k}={v}' for k, v in sorted(s['tool_counts'].items(), key=lambda x: -x[1])[:5])})"
        )
    return "\n\n".join(blocks) if blocks else "No sessions in range."


def mode_diff(file_a: Path, file_b: Path, fmt: str = "text"):
    """Timestamp-interleaved diff of two sessions."""
    msgs_a = [(m, "A") for m in PR.get_messages(PR.parse_lines(file_a))]
    msgs_b = [(m, "B") for m in PR.get_messages(PR.parse_lines(file_b))]
    combined = msgs_a + msgs_b

    def sort_key(item):
        m, _ = item
        ts = PR._parse_timestamp(m.get("timestamp"))
        if ts and ts.tzinfo is not None:
            ts = ts.replace(tzinfo=None)
        return ts or datetime.min

    combined.sort(key=sort_key)
    if fmt == "json":
        return {
            "a": str(file_a),
            "b": str(file_b),
            "messages": [
                {
                    "source": tag,
                    "role": m["role"],
                    "timestamp": _ts_iso(m.get("timestamp")),
                    "text": " | ".join(m["texts"]),
                }
                for m, tag in combined
                if m["texts"]
            ],
        }
    out = [f"--- A: {file_a.name}\n--- B: {file_b.name}\n"]
    for m, tag in combined:
        if not m["texts"]:
            continue
        text = " | ".join(m["texts"])[:300]
        role = m["role"][0].upper()
        out.append(f"{tag}> [{role}] {text}")
    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────────────
# Timeline mode
# ─────────────────────────────────────────────────────────────────────────────

def _fmt_dur(td: timedelta) -> str:
    mins = int(td.total_seconds() // 60)
    if mins < 1:
        return "<1m"
    h, m = divmod(mins, 60)
    return f"{h}h{m:02d}m" if h else f"{m}m"


def _fmt_tod(dt: datetime) -> str:
    """Time-of-day as 12-hour with 24-hour in parens: '7:00pm (19:00)'.

    Computed by hand (not strftime %-I/%#I) so it's identical on every platform.
    """
    h12 = dt.hour % 12 or 12
    ampm = "am" if dt.hour < 12 else "pm"
    return f"{h12}:{dt.minute:02d}{ampm} ({dt.hour:02d}:{dt.minute:02d})"


def _fmt_clock(dt: datetime, with_date: bool) -> str:
    """A report clock value — `_fmt_tod`, date-prefixed when the window spans days."""
    return f"{dt:%Y-%m-%d} {_fmt_tod(dt)}" if with_date else _fmt_tod(dt)


_GAP_RE = re.compile(r"^(\d+)\s*(m|h)?$", re.IGNORECASE)


def _parse_gap(spec: str | None, default: int = 15) -> int:
    """Parse a gap/break spec ('15m', '1h', '20') into minutes."""
    if not spec:
        return default
    m = _GAP_RE.match(spec.strip())
    if not m:
        raise ValueError(f"Unrecognized gap spec: {spec!r}. Use forms like 15m or 1h.")
    n = int(m.group(1))
    return n * 60 if (m.group(2) or "m").lower() == "h" else n


# Codex records its internal review/approval gate as a session of its own, with
# a title that always starts this way. They are machine turns, never the user
# working, and on a busy day they can outnumber the real sessions in a timeline.
# Filtered by default from timeline/session-report; --keep-review-gates keeps them.
_REVIEW_GATE_PREFIXES = ("The following is the Codex agent history",)


def is_review_gate(summary_or_title) -> bool:
    """True for a Codex internal review-gate pseudo-session (dict or title str)."""
    if isinstance(summary_or_title, dict):
        title = summary_or_title.get("title") or summary_or_title.get("first_prompt") or ""
    else:
        title = summary_or_title or ""
    return any(title.strip().startswith(p) for p in _REVIEW_GATE_PREFIXES)


def build_timeline(
    project_dirs: list[Path],
    since: datetime,
    until: datetime,
    gap_minutes: int,
    current_uuid: str | None,
    exclude_current: bool = False,
    codex_sessions: list[Path] | None = None,
    keep_review_gates: bool = False,
) -> dict:
    """Cross-session activity blocks for a time window.

    Every signal-message timestamp in [since, until) is an activity event.
    Events across all sessions (Claude Code + Codex) are merged chronologically
    and grouped into blocks separated by gaps > gap_minutes.
    """
    sessions: dict[Path, dict] = {}
    events: list[tuple[datetime, Path]] = []
    gates_hidden = 0

    def _add_file(f: Path) -> None:
        nonlocal gates_hidden
        if exclude_current and current_uuid and f.stem == current_uuid:
            return
        stamps = []
        for m in PR.get_messages(PR.parse_lines(f)):
            ts = PR._parse_timestamp(m.get("timestamp"))
            if ts is None or ts < since or ts >= until:
                continue
            stamps.append(ts)
        if not stamps:
            return
        summary = PR.session_summary(f, current_session_id=current_uuid)
        if not keep_review_gates and is_review_gate(summary):
            gates_hidden += 1
            return
        sessions[f] = summary
        events.extend((ts, f) for ts in stamps)

    for pd in project_dirs:
        # Filter by mtime >= since only; a session still active after `until`
        # may contain events inside the window, so no upper mtime bound.
        for f in P.list_transcripts(pd, since=since):
            _add_file(f)
    for f in codex_sessions or []:
        _add_file(f)
    events.sort(key=lambda e: e[0])

    blocks: list[dict] = []
    cur: dict | None = None
    gap = timedelta(minutes=gap_minutes)
    for ts, f in events:
        if cur is None or ts - cur["end"] > gap:
            cur = {"start": ts, "end": ts, "counts": {}}
            blocks.append(cur)
        if ts > cur["end"]:
            cur["end"] = ts
        cur["counts"][f] = cur["counts"].get(f, 0) + 1
    return {
        "since": since,
        "until": until,
        "gap_minutes": gap_minutes,
        "blocks": blocks,
        "sessions": sessions,
        "review_gates_hidden": gates_hidden,
    }


def _session_label(s: dict) -> str:
    title = s.get("title") or s.get("first_prompt") or "(untitled)"
    src = "codex ▹ " if s.get("source") == "codex" else ""
    return f"{src}{s['decoded_project']} · {title[:60]} [{s['uuid'][:8]}]"


def render_timeline(data: dict, tz_label: str, max_per_block: int = 0) -> str:
    since, until = data["since"], data["until"]
    blocks, sessions = data["blocks"], data["sessions"]
    multi_day = (until - since) > timedelta(days=1)
    head = (
        f"=== Timeline {_fmt_clock(since, True)} → {_fmt_clock(until, True)} "
        f"(times: {tz_label} 12h (24h), gap={data['gap_minutes']}m) ==="
    )
    if not blocks:
        return head + "\n\n(no activity in range)"
    out = [head, ""]
    prev_end: datetime | None = None
    for b in blocks:
        if prev_end is not None:
            out.append(f"     ── idle {_fmt_dur(b['start'] - prev_end)} ──")
        dur = b["end"] - b["start"]
        out.append(f"{_fmt_clock(b['start'], multi_day)}–{_fmt_tod(b['end'])}  ({_fmt_dur(dur)})")
        ranked = sorted(b["counts"].items(), key=lambda x: -x[1])
        shown = ranked[:max_per_block] if max_per_block else ranked
        for f, n in shown:
            out.append(f"   · {_session_label(sessions[f])} — {n} msgs")
        if len(ranked) > len(shown):
            rest = sum(n for _, n in ranked[len(shown):])
            out.append(f"   · … {len(ranked) - len(shown)} quieter session(s) "
                       f"in this block — {rest} msgs")
        prev_end = b["end"]
    span = blocks[-1]["end"] - blocks[0]["start"]
    out.append("")
    # Timeline is a map of WHEN sessions were active (Claude included) — it makes
    # no claim about user attention time. For that, use --mode engagement.
    out.append(
        f"Total: {len(blocks)} block(s) across a {_fmt_dur(span)} span "
        f"({_fmt_clock(blocks[0]['start'], multi_day)}–{_fmt_tod(blocks[-1]['end'])}), "
        f"{len(sessions)} session(s)"
    )
    if data.get("review_gates_hidden"):
        out.append(f"({data['review_gates_hidden']} Codex review gate(s) hidden "
                   f"— pass --keep-review-gates to show them)")
    return "\n".join(out)


def timeline_json(data: dict) -> dict:
    sessions = data["sessions"]
    blocks_out = []
    for b in data["blocks"]:
        dur_min = int((b["end"] - b["start"]).total_seconds() // 60)
        blocks_out.append({
            "start": b["start"].isoformat(),
            "end": b["end"].isoformat(),
            "duration_minutes": dur_min,
            "sessions": [
                {
                    "uuid": sessions[f]["uuid"],
                    "source": sessions[f].get("source", "claude"),
                    "project": sessions[f]["decoded_project"],
                    "title": sessions[f].get("title") or sessions[f].get("first_prompt") or "",
                    "path": str(f),
                    "events": n,
                }
                for f, n in sorted(b["counts"].items(), key=lambda x: -x[1])
            ],
        })
    span_min = 0
    if data["blocks"]:
        span_min = int(
            (data["blocks"][-1]["end"] - data["blocks"][0]["start"]).total_seconds() // 60
        )
    return {
        "since": data["since"].isoformat(),
        "until": data["until"].isoformat(),
        "gap_minutes": data["gap_minutes"],
        "blocks": blocks_out,
        "totals": {
            "blocks": len(blocks_out),
            "span_minutes": span_min,
            "sessions": len(sessions),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Engagement mode — user attention time, not session activity
# ─────────────────────────────────────────────────────────────────────────────

def _is_real_user_prompt(obj: dict) -> bool:
    """True only for an actual human action: typed prompt or slash command.

    Excludes tool results (user-role, no text blocks), hook/skill injections
    (isMeta), and compact continuations (classified upstream).
    """
    if obj.get("isMeta"):
        return False
    content = obj.get("message", {}).get("content", "")
    if isinstance(content, str):
        return bool(content.strip())
    if isinstance(content, list):
        return any(
            isinstance(b, dict) and b.get("type") == "text" and b.get("text", "").strip()
            for b in content
        )
    return False


def _assistant_has_text(obj: dict) -> bool:
    """True if an assistant entry carries human-visible text, not just tool_use.

    A turn that only fires tools (no text block) is plumbing, not a reply the
    user reads, so it does not count as an assistant message.
    """
    content = obj.get("message", {}).get("content", "")
    if isinstance(content, str):
        return bool(content.strip())
    if isinstance(content, list):
        return any(
            isinstance(b, dict) and b.get("type") == "text" and b.get("text", "").strip()
            for b in content
        )
    return False


def _engagement_event_streams(
    path: Path, since: datetime | None, until: datetime | None
) -> tuple[list[datetime], list[datetime], list[datetime]]:
    """One session's (user_events, claude_events, assistant_events) in [since, until).

    user_events — real user prompts only (see _is_real_user_prompt).
    claude_events — assistant messages and tool results: evidence Claude was
    working. Used only to grant waiting-on-Claude credit for long gaps.
    assistant_events — assistant turns bearing visible text (see
    _assistant_has_text): the replies the user actually reads, counted clean of
    tool-only turns and tool-result envelopes.
    """
    user_ev: list[datetime] = []
    claude_ev: list[datetime] = []
    assistant_ev: list[datetime] = []
    for obj in PR.parse_lines(path):
        cls = PR.classify_entry(obj)
        if cls in ("noise", "title", "compact"):
            continue
        ts = PR._parse_timestamp(obj.get("timestamp"))
        if ts is None or (since and ts < since) or (until and ts >= until):
            continue
        if cls == "user":
            if obj.get("isMeta"):
                continue
            if _is_real_user_prompt(obj):
                user_ev.append(ts)
            else:
                claude_ev.append(ts)  # tool_result entries
        else:  # assistant
            claude_ev.append(ts)
            if _assistant_has_text(obj):
                assistant_ev.append(ts)
    user_ev.sort()
    claude_ev.sort()
    assistant_ev.sort()
    return user_ev, claude_ev, assistant_ev


def build_engagement(
    root: Path,
    report_dirs: list[Path] | None,
    report_file: Path | None,
    since: datetime,
    until: datetime,
    break_minutes: int,
    current_uuid: str | None,
    exclude_current: bool = False,
    include_claude: bool = True,
    codex_stream: list[Path] | None = None,
    codex_report: list[Path] | None = None,
) -> dict:
    """Attention-time accounting over ONE merged user-prompt stream.

    Real user prompts from EVERY project are merged into a single global
    stream, so a moment of wall-clock time is never counted twice across
    parallel chats. Three rules:

    1. A gap between consecutive prompts ≤ break_minutes counts fully as
       active time, attributed to the session of the LATER prompt (that's
       the chat being read/typed in).
    2. A longer gap still counts in full if Claude was working in the later
       prompt's session during the gap AND the user replied within
       break_minutes of Claude's last event (sitting-there-waiting credit).
    3. Anything else is a break: contributes nothing.

    report_dirs/report_file only filter which sessions are REPORTED — the
    stream itself always spans all projects under root for correctness.
    """
    import bisect

    user_events: dict[Path, list[datetime]] = {}
    claude_events: dict[Path, list[datetime]] = {}
    assistant_events: dict[Path, list[datetime]] = {}
    files: list[Path] = []
    if include_claude:
        for pd in P.list_projects(root):
            # mtime >= since only; a session still active after `until` may hold
            # events inside the window (same reasoning as timeline).
            files.extend(P.list_transcripts(pd, since=since))
    # Codex sessions join the SAME global stream so parallel Claude/Codex chats
    # split the clock instead of double-counting a moment of wall time.
    files.extend(codex_stream or [])
    if report_file:
        report_file = report_file.resolve()
        files = [f.resolve() for f in files]
        if report_file not in files:
            files.append(report_file)  # e.g. --file under a different root
    for f in files:
        if exclude_current and current_uuid and f.stem == current_uuid:
            continue
        u, c, a = _engagement_event_streams(f, since, until)
        if u or c:
            user_events[f] = u
            claude_events[f] = c
            assistant_events[f] = a

    stream = sorted(
        (ts, f) for f, evs in user_events.items() for ts in evs
    )

    brk = timedelta(minutes=break_minutes)
    active: dict[Path, timedelta] = {}
    breaks: list[tuple[datetime, datetime]] = []
    for (t0, _f0), (t1, f1) in zip(stream, stream[1:]):
        gap = t1 - t0
        if gap <= brk:
            active[f1] = active.get(f1, timedelta()) + gap
            continue
        # Waiting-on-Claude credit: last Claude event in f1 inside the gap.
        cl = claude_events.get(f1, [])
        i = bisect.bisect_left(cl, t1)
        t_done = cl[i - 1] if i > 0 and cl[i - 1] > t0 else None
        if t_done is not None and (t1 - t_done) <= brk:
            active[f1] = active.get(f1, timedelta()) + gap
        else:
            breaks.append((t0, t1))

    # Reporting scope
    report_dir_set = {d.resolve() for d in report_dirs} if report_dirs else None
    codex_report_set = {p.resolve() for p in (codex_report or [])}
    sessions: dict[Path, dict] = {}
    for f, evs in user_events.items():
        if not evs:
            continue
        fr = f.resolve()
        if report_file:
            if fr != report_file:
                continue
        elif CX.is_codex_rollout(f):
            if fr not in codex_report_set:
                continue
        else:
            if report_dir_set is not None and f.parent.resolve() not in report_dir_set:
                continue
        sessions[f] = {
            "summary": PR.session_summary(f, current_session_id=current_uuid),
            "first": evs[0],
            "last": evs[-1],
            "user_messages": len(evs),
            "assistant_messages": len(assistant_events.get(f, [])),
            "active": active.get(f, timedelta()),
        }

    return {
        "since": since,
        "until": until,
        "break_minutes": break_minutes,
        "sessions": sessions,
        "breaks": breaks,
    }


def _gap_percentiles(evs: list[datetime]) -> tuple[int, int] | None:
    """(median, p90) of intra-session user-prompt gaps, in whole minutes."""
    if len(evs) < 2:
        return None
    gaps = sorted(
        (b - a).total_seconds() / 60 for a, b in zip(evs, evs[1:])
    )
    median = gaps[len(gaps) // 2]
    p90 = gaps[min(len(gaps) - 1, int(len(gaps) * 0.9))]
    return int(median), int(p90)


def render_engagement(data: dict, tz_label: str) -> str:
    since, until = data["since"], data["until"]
    sessions = data["sessions"]
    multi_day = (until - since) > timedelta(days=1)
    head = (
        f"=== Engagement {_fmt_clock(since, True)} → {_fmt_clock(until, True)} "
        f"(times: {tz_label} 12h (24h), break={data['break_minutes']}m) ==="
    )
    if not sessions:
        return head + "\n\n(no user messages in range)"
    out = [head, ""]
    rows = sorted(sessions.items(), key=lambda kv: -kv[1]["active"].total_seconds())
    for f, s in rows:
        elapsed = s["last"] - s["first"]
        # Composing time leading into a chat's first prompt is credited to it,
        # so active can slightly exceed first–last; cap the ratio at 1.0.
        ratio = (
            f"{min(1.0, s['active'].total_seconds() / elapsed.total_seconds()):.2f}"
            if elapsed.total_seconds() > 0 else "  — "
        )
        out.append(
            f"{_fmt_dur(s['active']):>7}  ratio {ratio}  "
            f"you {s['user_messages']:<3} ai {s['assistant_messages']:<4} "
            f"{_fmt_clock(s['first'], multi_day)}–{_fmt_tod(s['last'])}  "
            f"{_session_label(s['summary'])}"
        )
    total_active = sum((s["active"] for s in sessions.values()), timedelta())
    first = min(s["first"] for s in sessions.values())
    last = max(s["last"] for s in sessions.values())
    out.append("")
    out.append(
        f"Total: {_fmt_dur(total_active)} active across {len(sessions)} session(s), "
        f"{_fmt_clock(first, multi_day)}–{_fmt_tod(last)} span ({_fmt_dur(last - first)})"
    )
    breaks = data["breaks"]
    if breaks:
        shown = breaks[:6]
        items = ", ".join(
            f"{_fmt_clock(a, multi_day)}→{_fmt_tod(b)} ({_fmt_dur(b - a)})"
            for a, b in shown
        )
        more = f" (+{len(breaks) - len(shown)} more)" if len(breaks) > len(shown) else ""
        out.append(f"Breaks >{data['break_minutes']}m in the merged stream: "
                   f"{len(breaks)} — {items}{more}")
    # Single-session detail: prompt-gap percentiles
    if len(sessions) == 1:
        (f, s), = sessions.items()
        # recompute the session's own user events from the stored bounds is not
        # enough — pull them again (cached parse, cheap)
        evs, _, _ = _engagement_event_streams(f, data["since"], data["until"])
        pct = _gap_percentiles(evs)
        if pct:
            out.append(f"Prompt gaps: median {pct[0]}m, p90 {pct[1]}m")
    out.append(
        "(active time = your message cadence merged across ALL projects; "
        "parallel chats split the clock, never double-count. "
        "Long gaps count only when you replied right after Claude finished.)"
    )
    return "\n".join(out)


def engagement_json(data: dict) -> dict:
    sessions_out = []
    rows = sorted(
        data["sessions"].items(), key=lambda kv: -kv[1]["active"].total_seconds()
    )
    total_active = timedelta()
    for f, s in rows:
        elapsed = s["last"] - s["first"]
        active = s["active"]
        total_active += active
        summary = s["summary"]
        sessions_out.append({
            "uuid": summary["uuid"],
            "source": summary.get("source", "claude"),
            "project": summary["decoded_project"],
            "title": summary.get("title") or summary.get("first_prompt") or "",
            "path": str(f),
            "first": s["first"].isoformat(),
            "last": s["last"].isoformat(),
            "elapsed_minutes": int(elapsed.total_seconds() // 60),
            "active_minutes": int(active.total_seconds() // 60),
            "active_seconds": int(active.total_seconds()),
            "ratio": (
                min(1.0, round(active.total_seconds() / elapsed.total_seconds(), 2))
                if elapsed.total_seconds() > 0 else None
            ),
            "user_messages": s["user_messages"],
            "assistant_messages": s["assistant_messages"],
        })
    span_min = 0
    if data["sessions"]:
        first = min(s["first"] for s in data["sessions"].values())
        last = max(s["last"] for s in data["sessions"].values())
        span_min = int((last - first).total_seconds() // 60)
    return {
        "since": data["since"].isoformat(),
        "until": data["until"].isoformat(),
        "break_minutes": data["break_minutes"],
        "sessions": sessions_out,
        "totals": {
            "sessions": len(sessions_out),
            "active_minutes": int(total_active.total_seconds() // 60),
            "active_seconds": int(total_active.total_seconds()),
            "span_minutes": span_min,
        },
        "stream_breaks": [
            {
                "start": a.isoformat(),
                "end": b.isoformat(),
                "minutes": int((b - a).total_seconds() // 60),
            }
            for a, b in data["breaks"]
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Session-report mode — the per-session "what did I do" view
# ─────────────────────────────────────────────────────────────────────────────
# Reuses the engagement engine (windowed, overlap-safe attention time) but
# renders one numbered block per session, chronological, with both clocks
# (ran = own first→last span, which overlaps others; active = deduped
# attention), per-role message counts, and the intent/last-message inputs a
# human day-review is written from.

def render_session_report(data: dict, tz_label: str) -> str:
    since, until = data["since"], data["until"]
    sessions = data["sessions"]
    multi_day = (until - since) > timedelta(days=1)
    head = (
        f"=== Session report {_fmt_clock(since, True)} → {_fmt_clock(until, True)} "
        f"(times: {tz_label} 12h (24h), break={data['break_minutes']}m) ==="
    )
    if not sessions:
        return head + "\n\n(no user activity in range)"
    out = [head, ""]
    rows = sorted(sessions.items(), key=lambda kv: kv[1]["first"])  # chronological
    for i, (f, s) in enumerate(rows, 1):
        summary = s["summary"]
        elapsed = s["last"] - s["first"]
        title = summary.get("title") or summary.get("first_prompt") or "(untitled)"
        src = "codex ▹ " if summary.get("source") == "codex" else ""
        out.append(f"{i}. {title}")
        out.append(
            f"   {src}{summary['decoded_project']}  ·  "
            f"{_fmt_clock(s['first'], multi_day)}–{_fmt_tod(s['last'])}  "
            f"(ran {_fmt_dur(elapsed)} · active {_fmt_dur(s['active'])})"
        )
        out.append(
            f"   you {s['user_messages']} msgs · "
            f"assistant {s['assistant_messages']} msgs · "
            f"{summary['edit_count']} files edited"
        )
        out.append(f"   intent: {summary.get('first_prompt') or '(no user prompt)'}")
        out.append(f"   last:   {summary.get('last_assistant') or '(no assistant message)'}")
        out.append("")
    total_active = sum((s["active"] for s in sessions.values()), timedelta())
    first = min(s["first"] for s in sessions.values())
    last = max(s["last"] for s in sessions.values())
    out.append(
        f"Total: {len(sessions)} session(s) · {_fmt_dur(total_active)} active "
        f"(overlap removed) across a {_fmt_dur(last - first)} span "
        f"({_fmt_clock(first, multi_day)}–{_fmt_tod(last)})."
    )
    out.append(
        "(active = your attention, parallel chats never double-counted; "
        "ran = each session's own first→last span, which can overlap others.)"
    )
    return "\n".join(out)


def session_report_json(data: dict) -> dict:
    rows = sorted(data["sessions"].items(), key=lambda kv: kv[1]["first"])
    sessions_out = []
    total_active = timedelta()
    for f, s in rows:
        summary = s["summary"]
        elapsed = s["last"] - s["first"]
        total_active += s["active"]
        sessions_out.append({
            "uuid": summary["uuid"],
            "source": summary.get("source", "claude"),
            "project": summary["decoded_project"],
            "title": summary.get("title") or summary.get("first_prompt") or "",
            "path": str(f),
            "first": s["first"].isoformat(),
            "last": s["last"].isoformat(),
            "elapsed_minutes": int(elapsed.total_seconds() // 60),
            "active_minutes": int(s["active"].total_seconds() // 60),
            "user_messages": s["user_messages"],
            "assistant_messages": s["assistant_messages"],
            "edits": summary["edit_count"],
            "intent": summary.get("first_prompt") or "",
            "last_message": summary.get("last_assistant") or "",
        })
    span_min = 0
    if data["sessions"]:
        first = min(s["first"] for s in data["sessions"].values())
        last = max(s["last"] for s in data["sessions"].values())
        span_min = int((last - first).total_seconds() // 60)
    return {
        "since": data["since"].isoformat(),
        "until": data["until"].isoformat(),
        "break_minutes": data["break_minutes"],
        "sessions": sessions_out,
        "totals": {
            "sessions": len(sessions_out),
            "active_minutes": int(total_active.total_seconds() // 60),
            "span_minutes": span_min,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# JSON builders for the single-file modes
# ─────────────────────────────────────────────────────────────────────────────

def json_last(lines: list[dict], n: int, role: str = "assistant") -> list[dict]:
    recent = _last_messages(lines, n, role)
    return [
        {
            "n_from_end": len(recent) - i,
            "role": m["role"],
            "timestamp": _ts_iso(m.get("timestamp")),
            "text": "\n".join(m["texts"]),
        }
        for i, m in enumerate(recent)
    ]


def json_advisor(lines: list[dict]) -> list[str]:
    results = []
    for obj in lines:
        if obj.get("type") in PR.NOISE_TYPES:
            continue
        msg = obj.get("message", {})
        if not isinstance(msg.get("content"), list):
            continue
        for block in msg["content"]:
            if block.get("type") == "advisor_tool_result":
                inner = block.get("content", {})
                if isinstance(inner, dict) and inner.get("text"):
                    results.append(inner["text"])
    return results


def json_pre_compact(lines: list[dict], window: int = 40) -> dict:
    messages = PR.get_messages(lines)
    compact_idx = None
    for i, m in enumerate(messages):
        if m["is_compact"]:
            compact_idx = i
    if compact_idx is None:
        return {"found_compact": False, "messages": _messages_json(messages[-10:])}
    start = max(0, compact_idx - window)
    return {
        "found_compact": True,
        "messages": _messages_json(messages[start:compact_idx]),
    }


def json_dump(lines: list[dict], limit: int = 80, role: str = "both",
              since=None, until=None) -> list[dict]:
    messages, total = _dump_messages(lines, limit, role, since, until)
    _note_truncated(len(messages), total, "this window" if (since or until) else "the session")
    return _messages_json(messages)


def json_debug(lines: list[dict]) -> dict:
    type_counts: dict[str, int] = {}
    for obj in lines:
        t = obj.get("type", "<missing>")
        type_counts[t] = type_counts.get(t, 0) + 1
    block_type_counts: dict[str, int] = {}
    advisor_blocks = 0
    for obj in lines:
        if obj.get("type") in PR.NOISE_TYPES:
            continue
        content = obj.get("message", {}).get("content", [])
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    bt = block.get("type", "<missing>")
                    block_type_counts[bt] = block_type_counts.get(bt, 0) + 1
                    if bt == "advisor_tool_result":
                        advisor_blocks += 1
    compact_markers = sum(1 for m in PR.get_messages(lines) if m["is_compact"])
    return {
        "entry_types": type_counts,
        "block_types": block_type_counts,
        "advisor_blocks": advisor_blocks,
        "compact_markers": compact_markers,
    }


# ─────────────────────────────────────────────────────────────────────────────
# CLI dispatch
# ─────────────────────────────────────────────────────────────────────────────

ALL_MODES = {
    "last", "advisor", "pre-compact", "dump", "search", "debug",
    "list", "lookup", "find", "resume-cmd", "whoami", "brief",
    "changelog", "file-edits", "tool-calls", "tool-usage",
    "subagent-list", "subagent-finals", "subagent-tools", "subagent-files",
    "resume-prev", "count", "journal", "diff", "timeline", "engagement",
    "session-report",
}


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Extract content from Claude Code transcript files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # Targeting flags
    p.add_argument("--file", help="Path to .jsonl transcript file")
    p.add_argument("--cwd", help="Project working directory (to auto-find transcripts)")
    p.add_argument("--all-projects", action="store_true", help="Walk every project under --root")
    p.add_argument("--project", help="Filter projects by name substring (e.g. 'keel')")

    # Root selector
    p.add_argument(
        "--root", default="live",
        help="One of {live, mirror, snapshot-24h, snapshot-1w, snapshot-1mo} or an absolute path",
    )

    # Time bounds
    p.add_argument("--since", help="Lower time bound (ISO date / 7d / yesterday / now)")
    p.add_argument("--until", help="Upper time bound (same forms as --since)")
    p.add_argument("--date", help="Single-day window for timeline mode (ISO date / yesterday / today)")
    p.add_argument("--gap", help="Idle-gap threshold for timeline blocks (e.g. 15m, 1h; default 15m)")
    p.add_argument("--break", dest="break_spec",
                   help="Break threshold for engagement mode (e.g. 5m, 20m; default 10m)")
    p.add_argument(
        "--tz", default=None,
        help="Display timezone override: IANA name (America/New_York), UTC, or offset (+5, -4). "
             "Default: system local time.",
    )

    # Mode
    p.add_argument(
        "--mode", choices=sorted(ALL_MODES), default="last",
        help="Operation mode (see SKILL.md or references/modes.md)",
    )

    # Mode-specific flags
    p.add_argument("--query", help="Search query (for search/count modes)")
    p.add_argument("--full", action="store_true",
                   help="Wide-scope search: expand to full match windows instead of "
                        "the per-session summary (bounded; degrades back to summary if oversized)")
    p.add_argument("--uuid", help="UUID prefix (for lookup/resume-cmd modes)")
    p.add_argument("--title", help="Title substring (for find mode)")
    p.add_argument("--first-prompt", dest="first_prompt", help="First-prompt substring (for find mode)")
    # No hardcoded default: search treats unset as "both", last as "assistant".
    p.add_argument(
        "--agent", default="both", choices=["claude", "codex", "both"],
        help="Which agent's history to include for cross-session modes "
             "(list/journal/timeline/engagement/session-report/count/tool-usage/"
             "lookup/find/search). Default: both.",
    )
    p.add_argument("--role", default=None, choices=["user", "assistant", "both"])
    p.add_argument("--in", dest="in_channel", default="text",
                   choices=["text", "tool_use", "tool_result", "thinking", "all"])
    p.add_argument("--tool", help="Comma-separated tool names (for tool-calls / tool-usage)")
    p.add_argument("--subagent", help="Subagent file path (for subagent-tools/files)")
    p.add_argument("--file-a", dest="file_a", help="First file for diff mode")
    p.add_argument("--file-b", dest="file_b", help="Second file for diff mode")
    p.add_argument("--subagents-of", dest="subagents_of", help="Parent session for sibling diff")

    # Behavior flags
    p.add_argument("--exclude-current", action="store_true",
                   help="Drop the current session (via CLAUDE_CODE_SESSION_ID) from output")
    p.add_argument("--include-subagents", action="store_true",
                   help="Fold subagent finals into brief/last/dump output; "
                        "fold subagent tool calls into tool-usage tallies")
    p.add_argument("--force-dump", action="store_true",
                   help="Bypass the 5MB dump-size guard")
    p.add_argument("--format", default="text", choices=["text", "json"],
                   help="Output format (json works on every mode)")
    p.add_argument("-n", type=int, default=5, help="Count modifier (last/dump/resume-prev); -n 0 = no limit")
    p.add_argument("--max-per-block", type=int, default=0, metavar="N",
                   help="timeline: list only the N busiest sessions per block (0 = all)")
    p.add_argument("--keep-review-gates", action="store_true",
                   help="timeline/session-report: keep Codex internal review-gate "
                        "pseudo-sessions (hidden by default)")
    return p


def _resolve_time(spec: str | None) -> datetime | None:
    if not spec:
        return None
    return P.parse_timespec(spec)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    # Display timezone: default is system local time; --tz overrides.
    # Must run before anything formats a timestamp.
    try:
        PR.set_timezone(args.tz)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1

    fmt = "json" if args.format == "json" else "text"

    root = P.resolve_root(args.root)
    current_uuid = P.current_session_id()
    since = _resolve_time(args.since)
    until = _resolve_time(args.until)

    mode = args.mode

    # Discovery modes — don't need --file
    if mode == "list":
        _emit(mode_list(root, args.cwd, args.all_projects, since, until,
                        args.exclude_current, current_uuid,
                        project=args.project, fmt=fmt, agent=args.agent))
        return 0
    if mode == "lookup":
        code, out = mode_lookup(args.uuid or "", root, fmt=fmt, agent=args.agent)
        _emit(out)
        return code
    if mode == "whoami":
        code, out = mode_whoami(root, args.cwd, fmt=fmt)
        _emit(out)
        return code
    if mode == "find":
        _emit(mode_find(root, args.title, args.first_prompt, current_uuid,
                        project=args.project, fmt=fmt, agent=args.agent))
        return 0
    if mode == "resume-cmd":
        code, out = mode_resume_cmd(args.uuid or "", root, fmt=fmt)
        _emit(out)
        return code
    if mode == "resume-prev":
        if not args.cwd:
            print("--cwd required for resume-prev", file=sys.stderr)
            return 1
        _emit(mode_resume_prev(args.cwd, root, args.n, fmt=fmt))
        return 0
    if mode == "count":
        if not args.query:
            print("--query required for count", file=sys.stderr)
            return 1
        counts = mode_count(root, args.cwd, args.all_projects, args.query,
                            args.role or "both", args.in_channel, since, until,
                            project=args.project,
                            exclude_current=args.exclude_current,
                            current_uuid=current_uuid, agent=args.agent)
        if fmt == "json":
            _print_json(counts)
        else:
            print(
                f"{counts['sessions']} sessions, {counts['messages']} total messages, "
                f"{counts['matches']} matches",
                file=sys.stderr,
            )
            print(counts["sessions"])
        return 0
    if mode == "tool-usage":
        fp = Path(args.file) if args.file else None
        if fp and not fp.exists():
            print(f"File not found: {fp}", file=sys.stderr)
            return 1
        _emit(mode_tool_usage(
            root, args.cwd, args.all_projects, fp, since, until,
            tool_filter=_split_tools(args.tool), project=args.project,
            exclude_current=args.exclude_current,
            include_subagents=args.include_subagents,
            current_uuid=current_uuid, fmt=fmt, agent=args.agent,
        ))
        return 0
    if mode == "journal":
        _emit(mode_journal(root, args.cwd, args.all_projects, since, until,
                           current_uuid, project=args.project, fmt=fmt,
                           exclude_current=args.exclude_current, agent=args.agent))
        return 0
    if mode == "timeline":
        try:
            if args.date:
                day = P.parse_timespec(args.date).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                t_since, t_until = day, day + timedelta(days=1)
            else:
                t_since = since or P.parse_timespec("today")
                t_until = until or P.parse_timespec("now")
            gap_minutes = _parse_gap(args.gap)
        except ValueError as e:
            print(str(e), file=sys.stderr)
            return 1
        # Timeline is inherently cross-project — default to all projects.
        project_dirs = _scoped_project_dirs(
            root, args.cwd, args.all_projects, args.project, default_all=True
        ) if _wants_claude(args.agent) else []
        # until=None: a session active past t_until can still hold in-window
        # events; the per-event timestamp filter in build_timeline bounds it.
        codex_sessions = _codex_sessions(
            root, args.agent, t_since, None, args.cwd, args.all_projects,
            args.project, default_all=True,
        )
        data = build_timeline(project_dirs, t_since, t_until, gap_minutes, current_uuid,
                              exclude_current=args.exclude_current,
                              codex_sessions=codex_sessions,
                              keep_review_gates=args.keep_review_gates)
        if fmt == "json":
            _print_json(timeline_json(data))
        else:
            print(render_timeline(data, tz_label=args.tz or "local",
                                  max_per_block=args.max_per_block))
        return 0
    if mode in ("engagement", "session-report"):
        try:
            break_minutes = _parse_gap(args.break_spec, default=10)
            if args.date:
                day = P.parse_timespec(args.date).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                e_since, e_until = day, day + timedelta(days=1)
            else:
                e_since, e_until = since, until
        except ValueError as e:
            print(str(e), file=sys.stderr)
            return 1
        report_file = Path(args.file) if args.file else None
        if report_file and not report_file.exists():
            print(f"File not found: {report_file}", file=sys.stderr)
            return 1
        if report_file and e_since is None:
            # Window defaults to the file's own first→last user prompt.
            evs, _, _ = _engagement_event_streams(report_file, None, None)
            if not evs:
                print("(no user messages in this session)")
                return 0
            e_since = evs[0]
            e_until = e_until or evs[-1] + timedelta(seconds=1)
        else:
            e_since = e_since or P.parse_timespec("today")
            e_until = e_until or P.parse_timespec("now")
        # Scope filters reporting only; the attention stream is always global.
        report_dirs = None
        if not report_file and _wants_claude(args.agent):
            report_dirs = _scoped_project_dirs(
                root, args.cwd, args.all_projects, args.project, default_all=True
            )
        # Codex: the whole in-window tree joins the global stream (dedup
        # correctness); the scoped subset is what gets reported.
        codex_stream: list[Path] = []
        codex_report: list[Path] = []
        if _wants_codex(args.agent) and _codex_enabled(root):
            codex_stream = CX.list_codex_sessions(since=e_since)
            if report_file and CX.is_codex_rollout(report_file):
                codex_report = [report_file]
            elif not report_file:
                # until=None (same reasoning as timeline); the reporting set is
                # further narrowed to sessions with in-window prompts downstream.
                codex_report = _codex_sessions(
                    root, args.agent, e_since, None, args.cwd,
                    args.all_projects, args.project, default_all=True,
                )
        # include_claude stays purely --agent-driven: even for a Codex --file,
        # Claude prompts must remain in the global stream (the reporting loop
        # already restricts output to report_file) or the dedup math breaks the
        # documented always-global invariant.
        data = build_engagement(
            root, report_dirs, report_file, e_since, e_until, break_minutes,
            current_uuid, exclude_current=args.exclude_current,
            include_claude=_wants_claude(args.agent),
            codex_stream=codex_stream, codex_report=codex_report,
        )
        if mode == "session-report":
            if not args.keep_review_gates:
                kept = {f: s for f, s in data["sessions"].items()
                        if not is_review_gate(s.get("summary") or {})}
                hidden = len(data["sessions"]) - len(kept)
                if hidden:
                    data = {**data, "sessions": kept, "review_gates_hidden": hidden}
                    print(f"[note: {hidden} Codex review-gate session(s) hidden "
                          f"— pass --keep-review-gates to include them]",
                          file=sys.stderr)
            if fmt == "json":
                _print_json(session_report_json(data))
            else:
                print(render_session_report(data, tz_label=args.tz or "local"))
        elif fmt == "json":
            _print_json(engagement_json(data))
        else:
            print(render_engagement(data, tz_label=args.tz or "local"))
        return 0
    if mode == "diff":
        if args.subagents_of:
            parent = Path(args.subagents_of)
            subs = P.list_subagents(parent)
            if len(subs) < 2:
                print("Need ≥2 subagents to diff.")
                return 1
            _emit(mode_diff(subs[0], subs[1], fmt=fmt))
            return 0
        if not (args.file_a and args.file_b):
            print("--file-a and --file-b required for diff (or --subagents-of)", file=sys.stderr)
            return 1
        _emit(mode_diff(Path(args.file_a), Path(args.file_b), fmt=fmt))
        return 0
    # All scoped searches (--file / --cwd / --project / --all-projects) route here.
    # Wide scope summarizes by default; --full expands to bounded match windows.
    if mode == "search" and (args.file or args.all_projects or args.project or args.cwd):
        if not args.query:
            print("--query required", file=sys.stderr)
            return 1
        fp = Path(args.file) if args.file else None
        _emit(mode_search_v2(root, args.cwd, args.all_projects, fp, args.query,
                             args.role or "both", args.in_channel, since, until,
                             project=args.project, fmt=fmt,
                             exclude_current=args.exclude_current,
                             current_uuid=current_uuid, full=args.full,
                             agent=args.agent))
        return 0
    if mode == "search":
        # Reached only when no scope flag was given — search needs one of these.
        print("search requires --file, --cwd, --project, or --all-projects", file=sys.stderr)
        return 1

    # File-required modes
    if mode == "subagent-tools":
        if not args.subagent:
            print("--subagent required", file=sys.stderr)
            return 1
        sp = Path(args.subagent)
        _emit(mode_tool_calls(sp, _split_tools(args.tool), fmt=fmt))
        return 0
    if mode == "subagent-files":
        if not args.subagent:
            print("--subagent required", file=sys.stderr)
            return 1
        sp = Path(args.subagent)
        _emit(mode_file_edits(sp, fmt=fmt))
        return 0

    if not args.file:
        print("--file required (or use a discovery mode)", file=sys.stderr)
        return 1

    path = Path(args.file)
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        return 1

    if mode == "brief":
        _emit(mode_brief(path, args.include_subagents, current_uuid, fmt=fmt))
        return 0
    if mode == "subagent-list":
        _emit(mode_subagent_list(path, fmt=fmt))
        return 0
    if mode == "subagent-finals":
        _emit(mode_subagent_finals(path, fmt=fmt))
        return 0
    if mode == "changelog":
        _emit(mode_changelog(path, fmt=fmt))
        return 0
    if mode == "file-edits":
        _emit(mode_file_edits(path, fmt=fmt))
        return 0
    if mode == "tool-calls":
        _emit(mode_tool_calls(path, _split_tools(args.tool), fmt=fmt))
        return 0

    # Single-file text/JSON modes
    lines = PR.parse_lines(path)

    if fmt == "json":
        if mode == "last":
            _print_json(json_last(lines, args.n, args.role or "assistant"))
        elif mode == "advisor":
            _print_json(json_advisor(lines))
        elif mode == "pre-compact":
            _print_json(json_pre_compact(lines))
        elif mode == "dump":
            _print_json(json_dump(lines, args.n if args.n != 5 else 80,
                                  args.role or "both", since, until))
        elif mode == "debug":
            _print_json(json_debug(lines))
        return 0

    print(f"[{path.name} — {len(lines)} entries]\n")

    if mode == "last":
        body = mode_last(lines, args.n, args.role or "assistant")
        if args.include_subagents:
            body += _append_subagents(path)
        print(body)
    elif mode == "advisor":
        print(mode_advisor(lines))
    elif mode == "pre-compact":
        print(mode_pre_compact(lines))
    elif mode == "dump":
        size = path.stat().st_size
        # A --since/--until window already bounds the output, so a big file on
        # disk is not a reason to degrade — the window is the whole point.
        bounded = since is not None or until is not None
        if size > PR.LARGE_FILE_THRESHOLD and not args.force_dump and not bounded:
            has_compact = any(m["is_compact"] for m in PR.get_messages(lines))
            fallback = "pre-compact" if has_compact else "last"
            mb = size / (1024 * 1024)
            print(
                f"[note: transcript is {mb:.1f}MB — degraded to {fallback}. "
                f"Override with --force-dump.]",
                file=sys.stderr,
            )
            if fallback == "pre-compact":
                print(mode_pre_compact(lines))
            else:
                print(mode_last(lines, 10))
        else:
            body = mode_dump(lines, args.n if args.n != 5 else 80,
                             args.role or "both", since, until)
            if args.include_subagents:
                body += _append_subagents(path)
            print(body)
    elif mode == "debug":
        print(mode_debug(lines))

    return 0


def _split_tools(s: str | None) -> set[str] | None:
    if not s:
        return None
    return {t.strip() for t in s.split(",") if t.strip()}


def _append_subagents(parent_path: Path) -> str:
    finals = SA.agent_finals(parent_path)
    if not finals:
        return ""
    parts = ["\n"]
    for agent_id, meta, text in finals:
        atype = meta.get("agentType", "unknown")
        short = agent_id.replace("agent-", "")[:8]
        tail = (text[:1500] + "…") if len(text) > 1500 else text
        parts.append(f"\n[subagent {short} · {atype}]\n{tail}")
    return "\n".join(parts)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except FileNotFoundError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
