#!/usr/bin/env python3
"""Extract signal from Claude Code session transcripts.

See SKILL.md for the full mode reference. Legacy flags from the v1 script
(``--list``, ``--list-subagents``, ``--mode {last,advisor,pre-compact,dump,search,debug}``)
remain byte-compatible.
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

from lib import paths as P  # noqa: E402
from lib import parser as PR  # noqa: E402
from lib import tools as T  # noqa: E402
from lib import search as S  # noqa: E402
from lib import subagents as SA  # noqa: E402


# ─────────────────────────────────────────────────────────────────────────────
# Legacy mode implementations (kept byte-identical to v1 for backwards-compat)
# ─────────────────────────────────────────────────────────────────────────────

def mode_last(lines, n=5):
    messages = PR.get_messages(lines)
    assistant_msgs = [m for m in messages if m["role"] == "assistant" and m["texts"]]
    recent = assistant_msgs[-n:]
    output = []
    for i, m in enumerate(recent, 1):
        output.append(f"=== Assistant message -{len(recent) - i + 1} from end ===")
        output.append("\n".join(m["texts"]))
    return "\n\n".join(output) if output else "No assistant messages found."


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


def mode_dump(lines, limit=80):
    messages = PR.get_messages(lines)
    with_text = [m for m in messages if m["texts"]]
    recent = with_text[-limit:]
    output = [f"--- Conversation dump (last {len(recent)} messages with text) ---\n"]
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


def mode_search_legacy(lines, query: str):
    """Legacy single-file search: assistant text only, case-insensitive."""
    messages = PR.get_messages(lines)
    results = []
    q = query.lower()
    for m in messages:
        if m["role"] == "assistant":
            combined = " ".join(m["texts"])
            if q in combined.lower():
                results.append(combined)
    if not results:
        return None
    output = [f"=== {len(results)} match(es) for '{query}' ===\n"]
    for i, r in enumerate(results, 1):
        output.append(f"--- Match #{i} ---\n{r[:1500]}")
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


def _messages_json(messages: list[dict]) -> list[dict]:
    return [
        {
            "role": m["role"],
            "timestamp": m.get("timestamp"),
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
        proj = f"  {summary.get('decoded_project', summary.get('cwd', ''))}"
    title = summary.get("title") or summary.get("first_prompt", "")
    title = title[:80]
    return (
        f"{marker} {mtime}  {size_kb:6.0f}KB  {uuid_short}  msgs={msg_n:<4}  "
        f"{flags}  {status}{proj}  {title}"
    )


def mode_list_legacy(cwd: str, root: Path) -> str:
    """Original v1 list output — preserved byte-identically."""
    project_dir = P.find_project_dir(cwd, root)
    files = P.list_transcripts(project_dir)
    if not files:
        return "No transcript files found."
    out = [f"Transcripts for {cwd}:"]
    for f in files:
        size_kb = f.stat().st_size / 1024
        mtime = _fmt_mtime(f.stat().st_mtime)
        out.append(f"  {mtime}  {size_kb:6.0f}KB  {f.name}")
    return "\n".join(out)


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
):
    """Enriched v2 list — columns: marker, mtime, size, uuid-short, msgs, flags, status, project, title."""
    project_dirs = _scoped_project_dirs(root, cwd, all_projects, project)
    if project_dirs is None:
        return "--cwd, --project, or --all-projects required"
    rows = []
    for pd in project_dirs:
        for f in P.list_transcripts(pd, since=since, until=until):
            summary = PR.session_summary(f, current_session_id=current_uuid)
            if exclude_current and summary.get("is_current"):
                continue
            rows.append(summary)
    rows.sort(key=lambda s: s["mtime"], reverse=True)
    if fmt == "json":
        return [_summary_json(r) for r in rows]
    if not rows:
        return "No transcript files found."
    show_proj = all_projects or bool(project) or len(project_dirs) > 1
    return "\n".join(list_session_row(r, show_proj, current_uuid) for r in rows)


def mode_lookup(uuid_prefix: str, root: Path, fmt: str = "text") -> tuple[int, object]:
    """Resolve a UUID prefix to an absolute path. Returns (exit_code, output)."""
    if not uuid_prefix:
        return 1, ({"error": "--uuid required"} if fmt == "json" else "--uuid required")
    matches: list[Path] = []
    for pd in P.list_projects(root):
        for f in P.list_transcripts(pd):
            if f.stem.startswith(uuid_prefix):
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


def mode_find(
    root: Path,
    title_q: str | None,
    first_prompt_q: str | None,
    current_uuid: str | None,
    project: str | None = None,
    fmt: str = "text",
):
    """Search session metadata by title or first prompt."""
    if not (title_q or first_prompt_q):
        return "--title or --first-prompt required"
    project_dirs = _scoped_project_dirs(root, None, False, project, default_all=True)
    rows = []
    for pd in project_dirs:
        for f in P.list_transcripts(pd):
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
    code, out = mode_lookup(uuid_prefix, root)
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
):
    """Cross-scope search with role/in-channel filters."""
    matches: list = []
    if file_path:
        matches = S.search_session(file_path, query, role, in_channel, since, until)
    elif project:
        for pd in _scoped_project_dirs(root, None, False, project):
            matches.extend(S.search_project(pd, query, role, in_channel, since, until))
    elif all_projects:
        matches = list(S.search_all_projects(root, query, role, in_channel, since, until))
    elif cwd:
        pd = P.find_project_dir(cwd, root)
        matches = list(S.search_project(pd, query, role, in_channel, since, until))
    else:
        return "Provide --file, --cwd, --project, or --all-projects"

    if fmt == "json":
        return [
            {
                "session": str(m.session_path),
                "mtime_iso": _fmt_mtime(m.mtime),
                "role": m.role,
                "where": m.where,
                "timestamp": m.timestamp,
                "window": m.window_text,
            }
            for m in matches
        ]

    if not matches:
        return f"No matches for '{query}'."

    # Group by session for readable output
    by_session: dict[Path, list] = {}
    for m in matches:
        by_session.setdefault(m.session_path, []).append(m)
    out = []
    for sp, ms in by_session.items():
        out.append(f"\n{'=' * 60}\nSession: {sp.name}  ({_fmt_mtime(ms[0].mtime)})\n{'=' * 60}")
        for i, m in enumerate(ms, 1):
            label = f"--- Match #{i} [{m.role}/{m.where}] ---"
            out.append(f"{label}\n{m.window_text[:1500]}")
    return "\n\n".join(out)


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
) -> dict:
    sessions = 0
    matches = 0
    total_msgs = 0
    sources: list[Path] = []
    project_dirs = _scoped_project_dirs(root, cwd, all_projects, project)
    for pd in (project_dirs or []):
        sources.extend(P.list_transcripts(pd, since=since, until=until))
    for f in sources:
        ms = S.search_session(f, query, role, in_channel, since, until)
        total_msgs += len(PR.get_messages(PR.parse_lines(f)))
        if ms:
            sessions += 1
            matches += len(ms)
    return {"sessions": sessions, "messages": total_msgs, "matches": matches}


def mode_journal(
    root: Path,
    cwd: str | None,
    all_projects: bool,
    since: datetime | None,
    until: datetime | None,
    current_uuid: str | None,
    project: str | None = None,
    fmt: str = "text",
):
    pds = _scoped_project_dirs(root, cwd, all_projects, project)
    if pds is None:
        return "--cwd, --project, or --all-projects required"
    blocks = []
    rows = []
    for pd in pds:
        for f in P.list_transcripts(pd, since=since, until=until):
            rows.append(PR.session_summary(f, current_session_id=current_uuid))
    rows.sort(key=lambda s: s["mtime"], reverse=True)
    if fmt == "json":
        return [_summary_json(s) for s in rows]
    for s in rows:
        day = PR.epoch_to_display(s["mtime"]).strftime("%Y-%m-%d")
        blocks.append(
            f"=== {day} · {s['uuid'][:8]} · {s['decoded_project']} ===\n"
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
                    "timestamp": m.get("timestamp"),
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
# CLI dispatch
# ─────────────────────────────────────────────────────────────────────────────

LEGACY_MODES = {"last", "advisor", "pre-compact", "dump", "search", "debug"}

NEW_MODES = {
    "list", "lookup", "find", "resume-cmd", "brief",
    "changelog", "file-edits", "tool-calls",
    "subagent-list", "subagent-finals", "subagent-tools", "subagent-files",
    "resume-prev", "count", "journal", "diff",
}

ALL_MODES = LEGACY_MODES | NEW_MODES


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Extract content from Claude Code transcript files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # Targeting flags
    p.add_argument("--file", help="Path to .jsonl transcript file")
    p.add_argument("--cwd", help="Project working directory (to auto-find transcripts)")
    p.add_argument("--all-projects", action="store_true", help="Walk every project under --root")

    # Root selector
    p.add_argument(
        "--root", default="live",
        help="One of {live, mirror, snapshot-24h, snapshot-1w, snapshot-1mo} or an absolute path",
    )

    # Time bounds
    p.add_argument("--since", help="Lower time bound (ISO date / 7d / yesterday / now)")
    p.add_argument("--until", help="Upper time bound (same forms as --since)")

    # Mode
    p.add_argument(
        "--mode", choices=sorted(ALL_MODES), default="last",
        help="Operation mode (see SKILL.md or references/modes.md)",
    )

    # Mode-specific flags
    p.add_argument("--query", help="Search query (for search/count modes)")
    p.add_argument("--uuid", help="UUID prefix (for lookup/resume-cmd modes)")
    p.add_argument("--title", help="Title substring (for find mode)")
    p.add_argument("--first-prompt", dest="first_prompt", help="First-prompt substring (for find mode)")
    p.add_argument("--role", default="both", choices=["user", "assistant", "both"])
    p.add_argument("--in", dest="in_channel", default="text",
                   choices=["text", "tool_use", "tool_result", "thinking", "all"])
    p.add_argument("--tool", help="Comma-separated tool names (for tool-calls)")
    p.add_argument("--subagent", help="Subagent file path (for subagent-tools/files)")
    p.add_argument("--file-a", dest="file_a", help="First file for diff mode")
    p.add_argument("--file-b", dest="file_b", help="Second file for diff mode")
    p.add_argument("--subagents-of", dest="subagents_of", help="Parent session for sibling diff")

    # Behavior flags
    p.add_argument("--exclude-current", action="store_true",
                   help="Drop the current session (via CLAUDE_SESSION_ID) from output")
    p.add_argument("--include-subagents", action="store_true",
                   help="Fold subagent finals into brief/last/dump output")
    p.add_argument("--force-dump", action="store_true",
                   help="Bypass the 5MB dump-size guard")
    p.add_argument("--json", action="store_true", help="(reserved)")
    p.add_argument("-n", type=int, default=5, help="Count modifier (last/dump/resume-prev)")

    # Legacy alias flags
    p.add_argument("--list", action="store_true", help="List transcripts (legacy alias for --mode list)")
    p.add_argument("--list-subagents", action="store_true",
                   help="List subagent files (legacy alias for --mode subagent-list)")
    return p


def _resolve_time(spec: str | None) -> datetime | None:
    if not spec:
        return None
    return P.parse_timespec(spec)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    # Legacy alias translation — do NOT modify output for these paths.
    if args.list:
        if not args.cwd:
            print("--cwd required with --list", file=sys.stderr)
            return 1
        root = P.resolve_root(args.root)
        print(mode_list_legacy(args.cwd, root))
        return 0

    if args.list_subagents:
        if not args.file:
            print("--file required with --list-subagents", file=sys.stderr)
            return 1
        path = Path(args.file)
        subs = P.list_subagents(path)
        if not subs:
            print("No subagent transcripts found.")
            return 0
        print(f"Subagents for {path.name}:")
        for f in subs:
            size_kb = f.stat().st_size / 1024
            print(f"  {size_kb:5.0f}KB  {f.name}")
        return 0

    root = P.resolve_root(args.root)
    current_uuid = P.current_session_id()
    since = _resolve_time(args.since)
    until = _resolve_time(args.until)

    # Legacy --mode search with --cwd (no --file) preserved byte-for-byte.
    if args.mode == "search" and args.cwd and not args.file and not args.all_projects \
            and args.role == "both" and args.in_channel == "text":
        if not args.query:
            print("--query required with --mode search", file=sys.stderr)
            return 1
        files = P.list_transcripts(P.find_project_dir(args.cwd, root))
        if not files:
            print("No transcript files found.")
            return 0
        total_matches = 0
        for i, f in enumerate(files, 1):
            print(f"Searching {i}/{len(files)}: {f.name}...", file=sys.stderr, end="\r")
            try:
                lines = PR.parse_lines(f)
                result = mode_search_legacy(lines, args.query)
            except Exception as e:
                print(f"\nError reading {f.name}: {e}", file=sys.stderr)
                continue
            if result is not None:
                mtime = _fmt_mtime(f.stat().st_mtime)
                print(f"\n{'=' * 60}")
                print(f"Session: {f.name}  ({mtime})")
                print("=" * 60)
                print(result)
                total_matches += 1
        print(file=sys.stderr)
        if total_matches == 0:
            print(f"No matches for '{args.query}' found across {len(files)} session(s).")
        else:
            print(f"\n--- Found matches in {total_matches}/{len(files)} session(s) ---")
        return 0

    mode = args.mode

    # Discovery modes — don't need --file
    if mode == "list":
        print(mode_list(root, args.cwd, args.all_projects, since, until,
                        args.exclude_current, current_uuid))
        return 0
    if mode == "lookup":
        code, out = mode_lookup(args.uuid or "", root)
        print(out)
        return code
    if mode == "find":
        print(mode_find(root, args.title, args.first_prompt, current_uuid))
        return 0
    if mode == "resume-cmd":
        code, out = mode_resume_cmd(args.uuid or "", root)
        print(out)
        return code
    if mode == "resume-prev":
        if not args.cwd:
            print("--cwd required for resume-prev", file=sys.stderr)
            return 1
        print(mode_resume_prev(args.cwd, root, args.n))
        return 0
    if mode == "count":
        if not args.query:
            print("--query required for count", file=sys.stderr)
            return 1
        code, out = mode_count(root, args.cwd, args.all_projects, args.query,
                               args.role, args.in_channel, since, until)
        print(out)
        return code
    if mode == "journal":
        print(mode_journal(root, args.cwd, args.all_projects, since, until, current_uuid))
        return 0
    if mode == "diff":
        if mode == "diff" and args.subagents_of:
            parent = Path(args.subagents_of)
            subs = P.list_subagents(parent)
            if len(subs) < 2:
                print("Need ≥2 subagents to diff.")
                return 1
            print(mode_diff(subs[0], subs[1]))
            return 0
        if not (args.file_a and args.file_b):
            print("--file-a and --file-b required for diff (or --subagents-of)", file=sys.stderr)
            return 1
        print(mode_diff(Path(args.file_a), Path(args.file_b)))
        return 0
    if mode == "search" and (args.file or args.all_projects):
        if not args.query:
            print("--query required", file=sys.stderr)
            return 1
        fp = Path(args.file) if args.file else None
        print(mode_search_v2(root, args.cwd, args.all_projects, fp, args.query,
                             args.role, args.in_channel, since, until))
        return 0

    # File-required modes
    if mode == "subagent-tools":
        if not args.subagent:
            print("--subagent required", file=sys.stderr)
            return 1
        sp = Path(args.subagent)
        print(mode_tool_calls(sp, _split_tools(args.tool)))
        return 0
    if mode == "subagent-files":
        if not args.subagent:
            print("--subagent required", file=sys.stderr)
            return 1
        sp = Path(args.subagent)
        print(mode_file_edits(sp))
        return 0

    if not args.file:
        print("--file required (or use a discovery mode)", file=sys.stderr)
        return 1

    path = Path(args.file)
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        return 1

    if mode == "brief":
        print(mode_brief(path, args.include_subagents, current_uuid))
        return 0
    if mode == "subagent-list":
        print(mode_subagent_list(path))
        return 0
    if mode == "subagent-finals":
        print(mode_subagent_finals(path))
        return 0
    if mode == "changelog":
        print(mode_changelog(path))
        return 0
    if mode == "file-edits":
        print(mode_file_edits(path))
        return 0
    if mode == "tool-calls":
        print(mode_tool_calls(path, _split_tools(args.tool)))
        return 0

    # Legacy single-file modes
    lines = PR.parse_lines(path)
    print(f"[{path.name} — {len(lines)} entries]\n")

    if mode == "last":
        body = mode_last(lines, args.n)
        if args.include_subagents:
            body += _append_subagents(path)
        print(body)
    elif mode == "advisor":
        print(mode_advisor(lines))
    elif mode == "pre-compact":
        print(mode_pre_compact(lines))
    elif mode == "dump":
        size = path.stat().st_size
        if size > PR.LARGE_FILE_THRESHOLD and not args.force_dump:
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
            body = mode_dump(lines, max(args.n, 80) if args.n != 5 else 80)
            if args.include_subagents:
                body += _append_subagents(path)
            print(body)
    elif mode == "search":
        if not args.query:
            print("--query required with --mode search", file=sys.stderr)
            return 1
        result = mode_search_legacy(lines, args.query)
        print(result if result is not None
              else f"No assistant messages containing '{args.query}' found.")
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
    sys.exit(main())
