"""Path resolution, project discovery, and time-spec parsing."""

from __future__ import annotations

import os
import re
from datetime import datetime, timedelta
from pathlib import Path


CLAUDE_DIR = Path.home() / ".claude"
DEFAULT_LIVE_PROJECTS = CLAUDE_DIR / "projects"
DEFAULT_BACKUPS_DIR = Path.home() / ".claude-backups"

KNOWN_ROOTS = {"live", "mirror", "snapshot-24h", "snapshot-1w", "snapshot-1mo"}


def encode_cwd(cwd: str) -> str:
    """Convert an absolute path to the Claude project directory name.

    Replaces colons, backslashes, forward slashes, and whitespace with hyphens.
    Verified against the 34 real project dirs on this machine — no other chars
    appear in encoded names.
    """
    return re.sub(r"[:\\/\s]", "-", cwd)


def decode_project_name(encoded: str) -> str:
    """Best-effort reverse for display.

    Strips the `C--Users-<user>-` drive/home prefix when present, replaces
    remaining hyphens with spaces, and joins path-like segments with " > ".

    Falls back to the raw encoded name if the heuristic fails. Display only —
    never use this to look up a real directory.
    """
    if not encoded:
        return encoded

    # Strip leading drive prefix `C--Users-<name>-`
    m = re.match(r"^([A-Z])--Users-([^-]+)-(.+)$", encoded)
    if m:
        remainder = m.group(3)
    else:
        remainder = encoded

    # Heuristic: every run of single hyphens is a path separator. The encoder
    # mapped one `-` per separator char, so a single `-` in the original path
    # is impossible to recover. We split on single `-` between word characters
    # and treat the result as path segments. Multiple consecutive hyphens
    # indicate the original had spaces+hyphens fused together — collapse to one.
    # In practice this gives readable output like "Other Claude Code > Personal Brand Project".
    cleaned = re.sub(r"-{2,}", "-", remainder)
    # Words are likely separated by hyphens; segments by capitalized starts.
    # Simple approach: just replace hyphens with spaces.
    return cleaned.replace("-", " ").strip() or encoded


def current_session_id() -> str | None:
    """Return the current Claude Code session UUID from the environment.

    Claude Code sets ``CLAUDE_CODE_SESSION_ID`` in the actual OS process
    environment (verified against a live session) — that's checked first.
    ``CLAUDE_SESSION_ID`` is a DIFFERENT thing: a SKILL.md text substitution
    the harness performs on the markdown body before the model reads it, never
    exported as a real env var. It's checked second only as a compatibility
    fallback (e.g. a caller that exported it manually, or a future/alternate
    harness that uses that name). Returns None outside a Claude Code session.
    """
    val = os.environ.get("CLAUDE_CODE_SESSION_ID", "").strip()
    if not val:
        val = os.environ.get("CLAUDE_SESSION_ID", "").strip()
    return val or None


def resolve_root(name: str | None) -> Path:
    """Resolve a root name to its absolute projects directory.

    - "live" (default, None) -> ~/.claude/projects
    - "mirror" -> ~/.claude-backups/mirror/projects
    - "snapshot-24h" -> ~/.claude-backups/snapshot-24h/projects
    - "snapshot-1w" / "snapshot-1mo" -> analogous
    - <absolute path> -> passes through unchanged
    """
    if not name or name == "live":
        return DEFAULT_LIVE_PROJECTS
    if name in KNOWN_ROOTS:
        return DEFAULT_BACKUPS_DIR / name / "projects"
    p = Path(name)
    if p.is_absolute():
        return p
    raise ValueError(
        f"Unknown root: {name!r}. Expected one of {sorted(KNOWN_ROOTS)} or an absolute path."
    )


def find_project_dir(cwd: str, root: Path | None = None) -> Path:
    """Resolve a project directory under the given root.

    Tries exact encoded match first, falls back to case-insensitive substring.
    """
    if root is None:
        root = DEFAULT_LIVE_PROJECTS
    encoded = encode_cwd(cwd)
    candidate = root / encoded
    if candidate.exists():
        return candidate
    if root.exists():
        matches = [
            d for d in root.iterdir()
            if d.is_dir() and encoded.lower() in d.name.lower()
        ]
        if matches:
            return matches[0]
    raise FileNotFoundError(
        f"No project directory found for cwd: {cwd}\nExpected: {candidate}"
    )


def list_projects(root: Path | None = None) -> list[Path]:
    """All encoded-cwd dirs under the given root."""
    if root is None:
        root = DEFAULT_LIVE_PROJECTS
    if not root.exists():
        return []
    return sorted([d for d in root.iterdir() if d.is_dir()], key=lambda d: d.name)


def filter_projects(root: Path | None, name: str) -> list[Path]:
    """Project dirs whose encoded or decoded name contains `name` (case-insensitive).

    Matches against both forms so `--project "Keel Project"`, `--project
    Keel-Project`, and `--project keel` all hit the same directory.
    """
    q = name.strip().lower()
    q_encoded = q.replace(" ", "-")
    out = []
    for d in list_projects(root):
        dname = d.name.lower()
        decoded = decode_project_name(d.name).lower()
        if q in dname or q_encoded in dname or q in decoded:
            out.append(d)
    return out


def list_transcripts(
    project_dir: Path,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[Path]:
    """Return .jsonl files in the project dir, newest first.

    Excludes subagent transcripts (files starting with `agent-`).
    """
    if not project_dir.exists():
        return []
    files = [f for f in project_dir.glob("*.jsonl") if not f.name.startswith("agent-")]
    # display_to_epoch (not .timestamp()) — naive bounds are in the display
    # timezone, which differs from local under a --tz override.
    from . import parser as _parser
    if since is not None:
        since_ts = _parser.display_to_epoch(since)
        files = [f for f in files if f.stat().st_mtime >= since_ts]
    if until is not None:
        until_ts = _parser.display_to_epoch(until)
        files = [f for f in files if f.stat().st_mtime <= until_ts]
    files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    return files


def list_subagents(session_file: Path) -> list[Path]:
    """Return subagent transcript files for a given parent session."""
    uuid = session_file.stem
    subagent_dir = session_file.parent / uuid / "subagents"
    if not subagent_dir.exists():
        return []
    return sorted(
        subagent_dir.glob("agent-*.jsonl"),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )


_RELATIVE_RE = re.compile(r"^(\d+)\s*(m|h|d|w|mo)$", re.IGNORECASE)


def parse_timespec(s: str) -> datetime:
    """Parse a time spec into a naive datetime in the display timezone
    (system local time unless --tz overrides it).

    Accepts:
      - ISO date: "2026-05-01"
      - ISO datetime: "2026-05-01T14:30" or "2026-05-01 14:30"
      - Relative: "30m", "24h", "7d", "1w", "1mo"
      - Named: "today", "yesterday", "now"
    """
    if not s:
        raise ValueError("Empty time spec")
    s = s.strip()
    lower = s.lower()
    # "now" in the display timezone (== datetime.now() unless --tz is set),
    # so that named/relative specs stay consistent with displayed times.
    from . import parser as _parser
    now = _parser.now_display()
    if lower == "now":
        return now
    if lower == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if lower == "yesterday":
        return (now - timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    m = _RELATIVE_RE.match(s)
    if m:
        n = int(m.group(1))
        unit = m.group(2).lower()
        if unit == "m":
            return now - timedelta(minutes=n)
        if unit == "h":
            return now - timedelta(hours=n)
        if unit == "d":
            return now - timedelta(days=n)
        if unit == "w":
            return now - timedelta(weeks=n)
        if unit == "mo":
            return now - timedelta(days=30 * n)
    # ISO formats
    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s)
    except ValueError as e:
        raise ValueError(f"Unrecognized time spec: {s!r}") from e
