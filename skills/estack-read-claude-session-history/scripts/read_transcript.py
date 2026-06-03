#!/usr/bin/env python3
"""
Extract signal from Claude Code session transcripts (.jsonl files).

Usage:
  python read_transcript.py --file <path.jsonl> --mode last
  python read_transcript.py --file <path.jsonl> --mode advisor
  python read_transcript.py --file <path.jsonl> --mode pre-compact
  python read_transcript.py --file <path.jsonl> --mode dump
  python read_transcript.py --file <path.jsonl> --mode search --query <text>
  python read_transcript.py --cwd <project-cwd> --list
  python read_transcript.py --file <path.jsonl> --list-subagents
"""

import json
import os
import re
import sys
import argparse
from pathlib import Path

# Force UTF-8 output on Windows to handle emoji and non-ASCII in transcripts
if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


CLAUDE_DIR = Path.home() / ".claude"
PROJECTS_DIR = CLAUDE_DIR / "projects"

NOISE_TYPES = {
    "permission-mode", "ai-title", "custom-title", "attachment",
    "last-prompt", "queue-operation", "file-history-snapshot",
    "system", "agent-name", "pr-link",
}

COMPACT_MARKER = "This session is being continued from a previous conversation"


def encode_path(cwd: str) -> str:
    """Convert an absolute path to the Claude project directory name."""
    # Replace :, \, /, and space each with -
    result = re.sub(r'[:\\/\s]', '-', cwd)
    # Normalize multiple consecutive dashes that shouldn't be there
    # (except C:\ which legitimately produces C--)
    return result


def find_project_dir(cwd: str) -> Path:
    encoded = encode_path(cwd)
    candidate = PROJECTS_DIR / encoded
    if candidate.exists():
        return candidate
    # Fuzzy fallback: find closest match
    if PROJECTS_DIR.exists():
        matches = [d for d in PROJECTS_DIR.iterdir() if d.is_dir() and encoded.lower() in d.name.lower()]
        if matches:
            return matches[0]
    raise FileNotFoundError(f"No project directory found for cwd: {cwd}\nExpected: {candidate}")


def list_transcripts(cwd: str) -> list[Path]:
    """Return .jsonl files in the project dir, newest first."""
    project_dir = find_project_dir(cwd)
    files = sorted(
        [f for f in project_dir.glob("*.jsonl") if not f.name.startswith("agent-")],
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )
    return files


def list_subagents(session_file: Path) -> list[Path]:
    """Return subagent transcript files for a given session."""
    uuid = session_file.stem
    subagent_dir = session_file.parent / uuid / "subagents"
    if not subagent_dir.exists():
        return []
    return sorted(subagent_dir.glob("agent-*.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True)


def parse_lines(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        lines = []
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                lines.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return lines


def extract_text_blocks(content) -> list[str]:
    """Pull text strings from a content field (string or array of blocks)."""
    if isinstance(content, str):
        return [content] if content.strip() else []
    if not isinstance(content, list):
        return []
    texts = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text" and block.get("text", "").strip():
            texts.append(block["text"])
        elif block.get("type") == "advisor_tool_result":
            inner = block.get("content", {})
            if isinstance(inner, dict) and inner.get("text"):
                texts.append(f"[ADVISOR]\n{inner['text']}")
    return texts


def get_messages(lines: list[dict]) -> list[dict]:
    """Filter to signal messages only, returning {role, texts, line_index}."""
    messages = []
    for i, obj in enumerate(lines):
        if obj.get("type") in NOISE_TYPES:
            continue
        msg = obj.get("message", {})
        if not msg:
            continue
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue
        content = msg.get("content", "")
        texts = extract_text_blocks(content)
        # For user messages, also check if it's the compact marker
        is_compact = False
        if role == "user":
            all_text = " ".join(texts) if texts else (content if isinstance(content, str) else "")
            if COMPACT_MARKER in all_text:
                is_compact = True
        messages.append({
            "role": role,
            "texts": texts,
            "line_index": i,
            "is_compact": is_compact,
        })
    return messages


def mode_last(lines, n=5):
    """Last N assistant text outputs."""
    messages = get_messages(lines)
    assistant_msgs = [m for m in messages if m["role"] == "assistant" and m["texts"]]
    recent = assistant_msgs[-n:]
    output = []
    for i, m in enumerate(recent, 1):
        output.append(f"=== Assistant message -{len(recent) - i + 1} from end ===")
        output.append("\n".join(m["texts"]))
    return "\n\n".join(output) if output else "No assistant messages found."


def mode_advisor(lines):
    """All advisor responses in the session."""
    results = []
    for obj in lines:
        if obj.get("type") in NOISE_TYPES:
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
    """Content just before the most recent /compact."""
    messages = get_messages(lines)
    # Find last compact marker
    compact_idx = None
    for i, m in enumerate(messages):
        if m["is_compact"]:
            compact_idx = i
    if compact_idx is None:
        return "No /compact found in this transcript. Showing last messages instead.\n\n" + mode_last(lines, 10)
    # Show window messages before the compact
    start = max(0, compact_idx - window)
    pre_compact = messages[start:compact_idx]
    output = [f"--- Pre-compact content ({len(pre_compact)} exchanges before /compact) ---\n"]
    for m in pre_compact:
        if m["texts"]:
            role_label = "USER" if m["role"] == "user" else "ASSISTANT"
            output.append(f"[{role_label}]\n" + "\n".join(m["texts"]))
    return "\n\n".join(output) if output else "No content found before compact."


def mode_dump(lines, limit=80):
    """Human-readable conversation dump (text only, last N exchanges)."""
    messages = get_messages(lines)
    # Take last `limit` messages that have text content
    with_text = [m for m in messages if m["texts"]]
    recent = with_text[-limit:]
    output = [f"--- Conversation dump (last {len(recent)} messages with text) ---\n"]
    for m in recent:
        if m["is_compact"]:
            output.append(f"\n--- /COMPACT ---\n")
            continue
        role_label = "USER" if m["role"] == "user" else "ASSISTANT"
        text = "\n".join(m["texts"])
        # Truncate very long messages
        if len(text) > 1500:
            text = text[:1500] + "\n[...truncated...]"
        output.append(f"[{role_label}]\n{text}")
    return "\n\n".join(output)


def mode_search(lines, query: str):
    """Find all assistant messages containing query (case-insensitive)."""
    messages = get_messages(lines)
    results = []
    q = query.lower()
    for m in messages:
        if m["role"] == "assistant":
            combined = " ".join(m["texts"])
            if q in combined.lower():
                results.append(combined)
    if not results:
        return f"No assistant messages containing '{query}' found."
    output = [f"=== {len(results)} match(es) for '{query}' ===\n"]
    for i, r in enumerate(results, 1):
        output.append(f"--- Match #{i} ---\n{r[:1500]}")
    return "\n\n".join(output)


def mode_debug(lines):
    """Structural diagnostic — shows entry type distribution, content block types,
    and sample signal entries. Use this when a mode returns empty/unexpected results
    to check if the transcript format has drifted."""
    output = []

    # 1. Entry type distribution
    type_counts: dict[str, int] = {}
    for obj in lines:
        t = obj.get("type", "<missing>")
        type_counts[t] = type_counts.get(t, 0) + 1
    output.append("=== Entry type distribution ===")
    for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        marker = " [NOISE - skipped]" if t in NOISE_TYPES else " [SIGNAL]" if t in ("user", "assistant") else ""
        output.append(f"  {count:4d}  {t}{marker}")

    # 2. Content block type distribution across all signal messages
    block_type_counts: dict[str, int] = {}
    signal_entries = [o for o in lines if o.get("type") not in NOISE_TYPES]
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

    # 3. Advisor result probe
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
            output.append(f"  Block #{i}: outer_keys={a['outer_keys']}, inner={a['inner_type']}({a['inner_keys']}), has_text={a['has_text']}")
    else:
        output.append("  No advisor_tool_result blocks found.")
        output.append("  → If you expected advisor output, the block type name may have changed.")

    # 4. Compact marker probe
    output.append("\n=== Compact marker probe ===")
    compact_hits = []
    for obj in lines:
        msg = obj.get("message", {})
        if msg.get("role") != "user":
            continue
        content = msg.get("content", "")
        text = content if isinstance(content, str) else " ".join(
            b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"
        )
        if COMPACT_MARKER in text:
            compact_hits.append(obj.get("type", "?"))
    if compact_hits:
        output.append(f"  Found {len(compact_hits)} compact marker(s) in entry type(s): {compact_hits}")
    else:
        output.append("  No compact markers found in this transcript.")

    # 5. Sample signal entries (first 3 assistant messages with text)
    output.append("\n=== Sample assistant messages (first 3 with text) ===")
    messages = get_messages(lines)
    samples = [m for m in messages if m["role"] == "assistant" and m["texts"]][:3]
    if samples:
        for i, m in enumerate(samples, 1):
            preview = m["texts"][0][:200].replace("\n", " ")
            output.append(f"  [{i}] \"{preview}{'...' if len(m['texts'][0]) > 200 else ''}\"")
    else:
        output.append("  No assistant messages with text found.")
        output.append("  → Check that get_messages() is correctly identifying signal entries.")

    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(description="Extract content from Claude Code transcript files")
    parser.add_argument("--file", help="Path to .jsonl transcript file")
    parser.add_argument("--cwd", help="Project working directory (to auto-find transcripts)")
    parser.add_argument("--mode", choices=["last", "advisor", "pre-compact", "dump", "search", "debug"],
                        default="last", help="Extraction mode")
    parser.add_argument("--query", help="Search query (used with --mode search)")
    parser.add_argument("--list", action="store_true", help="List transcripts for --cwd")
    parser.add_argument("--list-subagents", action="store_true", help="List subagent files for --file")
    parser.add_argument("-n", type=int, default=5, help="Number of messages for 'last' mode")
    args = parser.parse_args()

    if args.list:
        if not args.cwd:
            print("--cwd required with --list", file=sys.stderr)
            sys.exit(1)
        files = list_transcripts(args.cwd)
        if not files:
            print("No transcript files found.")
            return
        print(f"Transcripts for {args.cwd}:")
        for f in files:
            size_kb = f.stat().st_size / 1024
            from datetime import datetime
            mtime = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
            print(f"  {mtime}  {size_kb:6.0f}KB  {f.name}")
        return

    # Search across all sessions in a project directory
    if args.cwd and args.mode == "search":
        if not args.query:
            print("--query required with --mode search", file=sys.stderr)
            sys.exit(1)
        files = list_transcripts(args.cwd)
        if not files:
            print("No transcript files found.")
            return
        total_matches = 0
        for f in files:
            lines = parse_lines(f)
            result = mode_search(lines, args.query)
            if not result.startswith("No assistant messages"):
                from datetime import datetime
                mtime = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
                print(f"\n{'='*60}")
                print(f"Session: {f.name}  ({mtime})")
                print("="*60)
                print(result)
                total_matches += 1
        if total_matches == 0:
            print(f"No matches for '{args.query}' found across {len(files)} session(s).")
        else:
            print(f"\n--- Found matches in {total_matches}/{len(files)} session(s) ---")
        return

    if not args.file:
        print("--file required (or use --list with --cwd)", file=sys.stderr)
        sys.exit(1)

    path = Path(args.file)
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)

    if args.list_subagents:
        subagents = list_subagents(path)
        if not subagents:
            print("No subagent transcripts found.")
            return
        print(f"Subagents for {path.name}:")
        for f in subagents:
            size_kb = f.stat().st_size / 1024
            print(f"  {size_kb:5.0f}KB  {f.name}")
        return

    lines = parse_lines(path)
    print(f"[{path.name} — {len(lines)} entries]\n")

    if args.mode == "last":
        print(mode_last(lines, args.n))
    elif args.mode == "advisor":
        print(mode_advisor(lines))
    elif args.mode == "pre-compact":
        print(mode_pre_compact(lines))
    elif args.mode == "dump":
        print(mode_dump(lines))
    elif args.mode == "search":
        if not args.query:
            print("--query required with --mode search", file=sys.stderr)
            sys.exit(1)
        print(mode_search(lines, args.query))
    elif args.mode == "debug":
        print(mode_debug(lines))


if __name__ == "__main__":
    main()
