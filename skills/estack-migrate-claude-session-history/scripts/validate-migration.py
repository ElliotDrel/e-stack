"""Validate a migrated Claude Code session transcript.

Runs structural, schema, and path-consistency checks on the migrated .jsonl
(plus its subagent sidecar dir if present). With --source-backup, also
cross-validates against the pre-migration backup to prove no entries were
lost, no uuids reordered, no encoding variant missed.

Exit code: 0 if every check passes, 1 if any check fails.

Examples:

    # Minimum: schema + self-consistency checks on the migrated file alone
    python validate-migration.py <migrated.jsonl>

    # Add path-replacement check (catches truly-stale old-path references)
    python validate-migration.py <migrated.jsonl> \\
        --old-repo "C:\\Users\\me\\old" \\
        --new-repo "C:\\Users\\me\\new"

    # Full cross-validation against the backup
    python validate-migration.py <migrated.jsonl> \\
        --old-repo "C:\\Users\\me\\old" \\
        --new-repo "C:\\Users\\me\\new" \\
        --source-backup "<backup>/old-project/<uuid>.jsonl" \\
        --target-backup-dir "<backup>/new-project"
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# UUID v4 shape (case-insensitive). Claude Code uses standard UUIDs throughout.
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)

# Entry types that carry conversation content and a cwd field. Other types are
# session-metadata markers (permission-mode, ai-title, last-prompt) and don't
# need to match all the schema rules.
CONVERSATION_TYPES = {"user", "assistant", "attachment", "tool_result", "system"}


@dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str
    sub_results: list["CheckResult"] = field(default_factory=list)


def load_jsonl(path: Path) -> tuple[list[dict[str, Any]], list[tuple[int, str]]]:
    """Return (parsed_entries, parse_errors). Skips blank lines."""
    entries: list[dict[str, Any]] = []
    errors: list[tuple[int, str]] = []
    with path.open(encoding="utf-8") as f:
        for i, raw in enumerate(f, start=1):
            if not raw.strip():
                continue
            try:
                entries.append(json.loads(raw))
            except json.JSONDecodeError as exc:
                errors.append((i, str(exc)))
    return entries, errors


def check_parse_integrity(file_path: Path) -> CheckResult:
    entries, errors = load_jsonl(file_path)
    if errors:
        detail = f"{len(entries)} parseable + {len(errors)} bad line(s); first error: line {errors[0][0]}: {errors[0][1]}"
        return CheckResult("JSONL parse integrity", False, detail)
    return CheckResult("JSONL parse integrity", True, f"{len(entries)} entries, all parseable")


def check_schema(entries: list[dict[str, Any]]) -> CheckResult:
    """Every entry needs `type`. Conversation entries need a usable shape."""
    problems: list[str] = []
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            problems.append(f"entry {idx}: not an object")
            continue
        if "type" not in entry:
            problems.append(f"entry {idx}: missing 'type'")
            continue
        etype = entry["type"]
        if etype in {"user", "assistant"}:
            msg = entry.get("message")
            if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
                problems.append(f"entry {idx} (type={etype}): malformed 'message' (need role + content)")
        if "uuid" in entry and isinstance(entry["uuid"], str) and entry["uuid"] != "":
            if not UUID_RE.match(entry["uuid"]):
                problems.append(f"entry {idx}: uuid not UUID-shaped: {entry['uuid']!r}")
        if "parentUuid" in entry and entry["parentUuid"] is not None:
            if not isinstance(entry["parentUuid"], str) or (entry["parentUuid"] != "" and not UUID_RE.match(entry["parentUuid"])):
                problems.append(f"entry {idx}: parentUuid not UUID-shaped: {entry['parentUuid']!r}")
    if problems:
        sample = "; ".join(problems[:3]) + (f" (+{len(problems) - 3} more)" if len(problems) > 3 else "")
        return CheckResult("Schema consistency", False, sample)
    return CheckResult("Schema consistency", True, f"all {len(entries)} entries have required fields")


def check_session_id_consistency(entries: list[dict[str, Any]], expected_session_id: str) -> CheckResult:
    seen: set[str] = set()
    for entry in entries:
        sid = entry.get("sessionId")
        if isinstance(sid, str) and sid:
            seen.add(sid)
    if not seen:
        return CheckResult("Session ID consistency", False, "no sessionId field found on any entry")
    if seen != {expected_session_id}:
        return CheckResult(
            "Session ID consistency",
            False,
            f"expected only {expected_session_id!r}, found {sorted(seen)!r}",
        )
    return CheckResult("Session ID consistency", True, f"all entries reference session {expected_session_id[:8]}")


def check_parent_uuid_chains(entries: list[dict[str, Any]]) -> CheckResult:
    known_uuids = {e["uuid"] for e in entries if isinstance(e.get("uuid"), str) and e["uuid"]}
    broken: list[str] = []
    for entry in entries:
        parent = entry.get("parentUuid")
        if parent and parent not in known_uuids:
            uid = entry.get("uuid", "?")[:8]
            broken.append(f"entry {uid} references missing parent {parent[:8]}")
    if broken:
        sample = "; ".join(broken[:3]) + (f" (+{len(broken) - 3} more)" if len(broken) > 3 else "")
        return CheckResult("Parent UUID chains", False, sample)
    return CheckResult("Parent UUID chains", True, f"all parent references resolve within the file")


def check_cwd_consistency(entries: list[dict[str, Any]], new_repo: str | None) -> CheckResult:
    """Every non-empty cwd should equal new_repo. If new_repo wasn't passed,
    just check that all non-empty cwds agree with each other (one value)."""
    cwds = {e["cwd"] for e in entries if isinstance(e.get("cwd"), str) and e["cwd"]}
    if not cwds:
        return CheckResult("CWD field consistency", True, "no non-empty cwd values to check")
    if len(cwds) > 1:
        return CheckResult(
            "CWD field consistency",
            False,
            f"multiple distinct cwd values found: {sorted(cwds)!r}",
        )
    (only,) = cwds
    if new_repo is not None and only != new_repo:
        return CheckResult(
            "CWD field consistency",
            False,
            f"cwd is {only!r} but --new-repo says it should be {new_repo!r}",
        )
    return CheckResult("CWD field consistency", True, f"all entries use cwd={only}")


def _iter_strings(value: Any):
    """Walk a parsed JSON value and yield every string it contains."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _iter_strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from _iter_strings(v)


def check_stale_path_references(
    entries: list[dict[str, Any]],
    old_repo: str,
    new_repo: str,
) -> CheckResult:
    """A "truly stale" reference is an occurrence of the old path that is NOT
    followed by the added segment of the new path. When new_repo is a subdir
    of old_repo, a naive substring search matches itself; the negative
    lookahead filters those false positives.

    Operates on parsed entry values (Python strings — single-backslash form),
    not on raw file text. This sidesteps JSON-escape mismatches between CLI
    argument processing and on-disk encoding.

    The migration-note entry is excluded from the search because it
    legitimately contains old-path references in its explanatory text."""

    # Normalize CLI inputs: if either path was passed with doubled backslashes,
    # collapse them to single backslashes so we always work with the
    # in-memory (parsed) form.
    if "\\\\" in old_repo:
        old_repo = old_repo.replace("\\\\", "\\")
    if "\\\\" in new_repo:
        new_repo = new_repo.replace("\\\\", "\\")

    note_idx = None
    for i, e in enumerate(entries):
        msg = e.get("message")
        if isinstance(msg, dict) and isinstance(msg.get("content"), str) and "<session-migration-note>" in msg["content"]:
            note_idx = i
            break

    if new_repo.startswith(old_repo) and new_repo != old_repo:
        added_segment = new_repo[len(old_repo):]
        pattern = re.compile(re.escape(old_repo) + "(?!" + re.escape(added_segment) + ")")
    else:
        added_segment = None
        pattern = re.compile(re.escape(old_repo))

    # Only check entries that existed at migration time — i.e., up to and
    # including the note. Anything after the note is post-migration activity
    # that may legitimately reference the old path (e.g. a tool listing that
    # touched files still living at the old location). Those references are
    # outside the migration's scope and not a defect.
    if note_idx is not None:
        in_scope_entries = entries[: note_idx + 1]
        scope_detail = f"checked entries 0..{note_idx} (pre/at migration-note); {len(entries) - note_idx - 1} post-note entries skipped"
    else:
        in_scope_entries = entries
        scope_detail = f"checked all {len(entries)} entries (no migration-note found)"

    hits_by_entry: list[tuple[int, int]] = []
    for i, entry in enumerate(in_scope_entries):
        if i == note_idx:
            continue
        count = 0
        for s in _iter_strings(entry):
            count += len(pattern.findall(s))
        if count:
            hits_by_entry.append((i, count))

    total = sum(c for _, c in hits_by_entry)
    if total == 0:
        if added_segment:
            detail = f"0 truly-stale old-path occurrences ({scope_detail})"
        else:
            detail = f"0 old-path occurrences in any entry value ({scope_detail})"
        return CheckResult("Stale path references", True, detail)

    sample = ", ".join(f"entry {i}: {c}" for i, c in hits_by_entry[:3])
    return CheckResult(
        "Stale path references",
        False,
        f"{total} truly-stale old-path occurrences across {len(hits_by_entry)} entries ({sample}); {scope_detail}",
    )


def find_migration_note(entries: list[dict[str, Any]]) -> tuple[int, dict[str, Any]] | None:
    for idx, entry in enumerate(entries):
        msg = entry.get("message")
        if isinstance(msg, dict) and isinstance(msg.get("content"), str) and "<session-migration-note>" in msg["content"]:
            return idx, entry
    return None


def check_migration_note(entries: list[dict[str, Any]]) -> CheckResult:
    matches = [(i, e) for i, e in enumerate(entries) if (
        isinstance(e.get("message"), dict)
        and isinstance(e["message"].get("content"), str)
        and "<session-migration-note>" in e["message"]["content"]
    )]
    if not matches:
        return CheckResult(
            "Migration note present",
            False,
            "no <session-migration-note> entry found — was this file actually migrated?",
        )
    if len(matches) > 1:
        return CheckResult(
            "Migration note present",
            False,
            f"{len(matches)} migration-note entries (should be exactly 1); duplicate append",
        )
    idx, entry = matches[0]
    problems = []
    if entry.get("type") != "user":
        problems.append(f"type={entry.get('type')!r} (expected 'user')")
    if entry.get("isMeta") is True:
        problems.append("isMeta=true (should not be meta — both user and AI need to see it)")
    if problems:
        return CheckResult("Migration note present", False, f"found at entry {idx}, but: {'; '.join(problems)}")
    return CheckResult(
        "Migration note present",
        True,
        f"found at entry {idx}, type=user, isMeta unset",
    )


def check_sidecar_integrity(file_path: Path, expected_session_id: str) -> CheckResult:
    sidecar_dir = file_path.with_suffix("")  # strip .jsonl → <uuid>/ dir
    if not sidecar_dir.is_dir():
        return CheckResult("Sidecar integrity", True, "no sidecar dir (no subagents were spawned)")
    sidecar_files = list(sidecar_dir.rglob("*.jsonl"))
    if not sidecar_files:
        return CheckResult("Sidecar integrity", True, "sidecar dir exists but contains no .jsonl files")
    problems: list[str] = []
    for sf in sidecar_files:
        entries, errors = load_jsonl(sf)
        if errors:
            problems.append(f"{sf.name}: {len(errors)} parse errors")
            continue
        # Subagent files share the parent session's sessionId
        seen_sids = {e.get("sessionId") for e in entries if e.get("sessionId")}
        unexpected = seen_sids - {expected_session_id}
        if unexpected:
            problems.append(f"{sf.name}: unexpected sessionId(s) {unexpected!r}")
    if problems:
        return CheckResult("Sidecar integrity", False, "; ".join(problems[:3]))
    return CheckResult("Sidecar integrity", True, f"{len(sidecar_files)} subagent files, all parseable, sessionId matches")


def check_backup_cross_validation(
    migrated_entries: list[dict[str, Any]],
    source_backup_path: Path,
    sidecar_live: Path,
    sidecar_backup: Path | None,
    target_backup_dir: Path | None,
    target_live_dir: Path,
) -> CheckResult:
    """Cross-validate against the pre-migration backup. This is what proves
    the migration was complete and non-destructive."""
    sub: list[CheckResult] = []

    # Source-backup parse
    src_entries, src_errors = load_jsonl(source_backup_path)
    if src_errors:
        sub.append(CheckResult(
            "Source backup parses",
            False,
            f"{len(src_errors)} parse error(s) in backup — backup may be corrupt",
        ))
        return CheckResult("Backup cross-validation", False, "source backup unreadable", sub)
    sub.append(CheckResult("Source backup parses", True, f"{len(src_entries)} entries in backup"))

    # Entry count: migrated = source + 1 (the migration note)
    expected = len(src_entries) + 1
    actual = len(migrated_entries)
    sub.append(CheckResult(
        "Entry count = source + 1",
        actual == expected,
        f"source={len(src_entries)}, migrated={actual}, expected={expected}",
    ))

    # UUID order preserved: every source uuid present in migrated, in the same order, as a prefix
    src_uuids = [e["uuid"] for e in src_entries if isinstance(e.get("uuid"), str) and e["uuid"]]
    new_uuids = [e["uuid"] for e in migrated_entries if isinstance(e.get("uuid"), str) and e["uuid"]]
    prefix_ok = new_uuids[: len(src_uuids)] == src_uuids
    sub.append(CheckResult(
        "UUID order preserved",
        prefix_ok,
        f"source has {len(src_uuids)} uuids, migrated has {len(new_uuids)} (extras at tail: {len(new_uuids) - len(src_uuids)})",
    ))

    # Sidecar file count: source backup sidecar vs live sidecar
    src_sidecar_files = list(sidecar_backup.rglob("*.jsonl")) if (sidecar_backup and sidecar_backup.is_dir()) else []
    new_sidecar_files = list(sidecar_live.rglob("*.jsonl")) if sidecar_live.is_dir() else []
    sub.append(CheckResult(
        "Sidecar count matches backup",
        len(src_sidecar_files) == len(new_sidecar_files),
        f"backup={len(src_sidecar_files)}, live={len(new_sidecar_files)}",
    ))

    # Target dir untouched: every file in target backup should still exist in live target with same size
    if target_backup_dir and target_backup_dir.is_dir():
        issues: list[str] = []
        for backup_file in target_backup_dir.rglob("*"):
            if not backup_file.is_file():
                continue
            rel = backup_file.relative_to(target_backup_dir)
            live_file = target_live_dir / rel
            if not live_file.exists():
                issues.append(f"missing in live: {rel}")
            elif live_file.stat().st_size != backup_file.stat().st_size:
                issues.append(f"size changed: {rel}")
        sub.append(CheckResult(
            "Target dir pre-existing files unchanged",
            not issues,
            f"{len(issues)} issue(s)" + (f"; first: {issues[0]}" if issues else ""),
        ))
    else:
        sub.append(CheckResult(
            "Target dir pre-existing files unchanged",
            True,
            "skipped (no --target-backup-dir provided)",
        ))

    overall = all(r.passed for r in sub)
    return CheckResult(
        "Backup cross-validation",
        overall,
        f"{sum(1 for r in sub if r.passed)}/{len(sub)} sub-checks passed",
        sub,
    )


def print_result(result: CheckResult, indent: int = 0) -> None:
    label = "PASS" if result.passed else "FAIL"
    pad = "    " * indent
    print(f"{pad}[{label}] {result.name:<42s} {result.detail}")
    for sub in result.sub_results:
        print_result(sub, indent + 1)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate a migrated Claude Code session transcript.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("file", type=Path, help="Path to migrated .jsonl file")
    parser.add_argument("--old-repo", help="Old project root path (enables stale-reference check)")
    parser.add_argument("--new-repo", help="New project root path (enables cwd-value check)")
    parser.add_argument("--source-backup", type=Path, help="Path to source backup .jsonl (enables cross-validation)")
    parser.add_argument("--source-backup-sidecar", type=Path, help="Path to source backup sidecar dir; defaults to <source-backup>/ minus .jsonl")
    parser.add_argument("--target-backup-dir", type=Path, help="Path to the entire backup of the target project dir (enables 'target untouched' check)")
    args = parser.parse_args(argv)

    file_path: Path = args.file
    if not file_path.is_file():
        print(f"ERROR: file not found: {file_path}", file=sys.stderr)
        return 2

    expected_session_id = file_path.stem  # filename without .jsonl extension

    print(f"=== Validating {file_path} ===\n")

    results: list[CheckResult] = []

    # Parse + load entries once for downstream checks
    parse_result = check_parse_integrity(file_path)
    results.append(parse_result)
    if not parse_result.passed:
        print_result(parse_result)
        print("\nFile cannot be parsed; downstream checks skipped.")
        return 1

    entries, _ = load_jsonl(file_path)

    results.append(check_schema(entries))
    results.append(check_session_id_consistency(entries, expected_session_id))
    results.append(check_parent_uuid_chains(entries))
    results.append(check_cwd_consistency(entries, args.new_repo))
    results.append(check_migration_note(entries))

    if args.old_repo and args.new_repo:
        results.append(check_stale_path_references(entries, args.old_repo, args.new_repo))
    else:
        results.append(CheckResult(
            "Stale path references",
            True,
            "skipped (pass --old-repo and --new-repo to enable)",
        ))

    results.append(check_sidecar_integrity(file_path, expected_session_id))

    if args.source_backup:
        if not args.source_backup.is_file():
            results.append(CheckResult(
                "Backup cross-validation",
                False,
                f"--source-backup not found: {args.source_backup}",
            ))
        else:
            sidecar_live = file_path.with_suffix("")
            sidecar_backup = args.source_backup_sidecar or args.source_backup.with_suffix("")
            target_live_dir = file_path.parent
            results.append(check_backup_cross_validation(
                entries,
                args.source_backup,
                sidecar_live,
                sidecar_backup if sidecar_backup.is_dir() else None,
                args.target_backup_dir,
                target_live_dir,
            ))
    else:
        results.append(CheckResult(
            "Backup cross-validation",
            True,
            "skipped (pass --source-backup to enable)",
        ))

    for r in results:
        print_result(r)

    passed = sum(1 for r in results if r.passed)
    total = len(results)
    overall = all(r.passed for r in results)
    print(f"\n=== Result: {'PASS' if overall else 'FAIL'} ({passed}/{total} checks) ===")
    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(main())
