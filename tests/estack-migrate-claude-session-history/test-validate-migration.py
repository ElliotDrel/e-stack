"""Self-test for validate-migration.py.

Builds synthetic transcripts with known defects, runs each check against
them, and confirms each check catches what it's supposed to catch (and
doesn't false-positive on clean inputs).

Run from the repo root:
    python tests/estack-migrate-claude-session-history/test-validate-migration.py

Exit 0 on full pass, 1 if any case fails.
"""

from __future__ import annotations

import importlib.util
import json
import shutil
import sys
import tempfile
from pathlib import Path

# Import validate-migration.py despite the hyphen in the filename.
SCRIPT_DIR = Path(__file__).resolve().parent.parent.parent / "skills" / "estack-migrate-claude-session-history" / "scripts"
spec = importlib.util.spec_from_file_location(
    "validate_migration",
    SCRIPT_DIR / "validate-migration.py",
)
vm = importlib.util.module_from_spec(spec)
if spec.loader is None:
    raise ImportError(f"Cannot load validate-migration.py from {SCRIPT_DIR}")
# Register before exec so @dataclass can resolve the module via sys.modules (Python 3.13+).
sys.modules["validate_migration"] = vm
spec.loader.exec_module(vm)


SESSION_ID = "11111111-2222-3333-4444-555555555555"
OLD_REPO = r"C:\fake\old"
NEW_REPO = r"C:\fake\new"
NEW_REPO_SUBDIR = r"C:\fake\old\subproject"  # for prefix-containment tests


def make_clean_entries(
    session_id: str = SESSION_ID,
    new_cwd: str = NEW_REPO,
    with_migration_note: bool = True,
) -> list[dict]:
    entries = [
        {
            "type": "permission-mode",
            "permissionMode": "default",
            "sessionId": session_id,
        },
        {
            "type": "user",
            "message": {"role": "user", "content": "Hello"},
            "uuid": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "parentUuid": None,
            "sessionId": session_id,
            "cwd": new_cwd,
            "timestamp": "2026-01-01T00:00:00.000Z",
        },
        {
            "type": "assistant",
            "message": {"role": "assistant", "content": "Hi back"},
            "uuid": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "parentUuid": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "sessionId": session_id,
            "cwd": new_cwd,
            "timestamp": "2026-01-01T00:00:01.000Z",
        },
    ]
    if with_migration_note:
        entries.append({
            "type": "user",
            "message": {
                "role": "user",
                "content": "<session-migration-note>\nMigrated from x to y.\n</session-migration-note>",
            },
            "uuid": "cccccccc-cccc-cccc-cccc-cccccccccccc",
            "parentUuid": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "sessionId": session_id,
            "cwd": new_cwd,
            "timestamp": "2026-01-01T00:00:02.000Z",
        })
    return entries


def write_jsonl(path: Path, entries: list[dict], raw_lines: list[str] | None = None) -> None:
    if raw_lines is not None:
        path.write_text("\n".join(raw_lines) + "\n", encoding="utf-8")
    else:
        path.write_text(
            "\n".join(json.dumps(e) for e in entries) + "\n",
            encoding="utf-8",
        )


# Track results
results: list[tuple[str, bool, str]] = []


def record(test_name: str, expected_pass: bool, result_obj) -> None:
    ok = result_obj.passed == expected_pass
    results.append((test_name, ok, result_obj.detail))
    label = "PASS" if ok else "FAIL"
    expected = "should PASS" if expected_pass else "should FAIL"
    print(f"[{label}] {test_name:<60s} ({expected}; got {'PASS' if result_obj.passed else 'FAIL'}) {result_obj.detail}")


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)

        # --- HAPPY PATH: a clean synthetic transcript ---
        clean_entries = make_clean_entries()
        clean_file = tmp / f"{SESSION_ID}.jsonl"
        write_jsonl(clean_file, clean_entries)

        print("\n--- Happy path: all checks should PASS ---")
        record("happy.parse_integrity", True, vm.check_parse_integrity(clean_file))
        record("happy.schema", True, vm.check_schema(clean_entries))
        record("happy.session_id", True, vm.check_session_id_consistency(clean_entries, SESSION_ID))
        record("happy.parent_chain", True, vm.check_parent_uuid_chains(clean_entries))
        record("happy.cwd", True, vm.check_cwd_consistency(clean_entries, NEW_REPO))
        record("happy.migration_note", True, vm.check_migration_note(clean_entries))
        record("happy.stale_refs", True, vm.check_stale_path_references(clean_entries, OLD_REPO, NEW_REPO))
        record("happy.sidecar", True, vm.check_sidecar_integrity(clean_file, SESSION_ID))

        # --- Failure cases: one per check ---
        print("\n--- Failure cases: each should be detected ---")

        # 1. Malformed JSON line
        bad_parse_file = tmp / "bad_parse.jsonl"
        write_jsonl(
            bad_parse_file,
            [],
            raw_lines=[json.dumps(clean_entries[0]), "{not valid json", json.dumps(clean_entries[1])],
        )
        record("fail.parse_integrity", False, vm.check_parse_integrity(bad_parse_file))

        # 2. Schema violation: user entry with malformed message
        bad_schema = list(clean_entries)
        bad_schema[1] = {**clean_entries[1], "message": "not-a-dict"}
        record("fail.schema (bad message)", False, vm.check_schema(bad_schema))

        # 3. Schema violation: bad uuid format
        bad_uuid = list(clean_entries)
        bad_uuid[1] = {**clean_entries[1], "uuid": "not-a-uuid"}
        record("fail.schema (bad uuid)", False, vm.check_schema(bad_uuid))

        # 4. SessionId inconsistency
        mixed_sids = list(clean_entries)
        mixed_sids[2] = {**clean_entries[2], "sessionId": "00000000-0000-0000-0000-000000000000"}
        record("fail.session_id (mixed sids)", False, vm.check_session_id_consistency(mixed_sids, SESSION_ID))

        # 5. Broken parent uuid chain
        broken_parent = list(clean_entries)
        broken_parent[2] = {**clean_entries[2], "parentUuid": "99999999-9999-9999-9999-999999999999"}
        record("fail.parent_chain (orphan parent)", False, vm.check_parent_uuid_chains(broken_parent))

        # 6. Multiple distinct cwd values
        mixed_cwd = list(clean_entries)
        mixed_cwd[2] = {**clean_entries[2], "cwd": r"C:\different\cwd"}
        record("fail.cwd (multiple distinct)", False, vm.check_cwd_consistency(mixed_cwd, NEW_REPO))

        # 7. Cwd doesn't match expected new_repo
        wrong_new_cwd = make_clean_entries(new_cwd=r"C:\unexpected\path")
        record("fail.cwd (wrong new_repo)", False, vm.check_cwd_consistency(wrong_new_cwd, NEW_REPO))

        # 8. No migration note
        no_note = make_clean_entries(with_migration_note=False)
        record("fail.migration_note (missing)", False, vm.check_migration_note(no_note))

        # 9. Multiple migration notes (duplicate append)
        dup_note = list(clean_entries) + [{
            "type": "user",
            "message": {"role": "user", "content": "<session-migration-note>\nduplicate\n</session-migration-note>"},
            "uuid": "dddddddd-dddd-dddd-dddd-dddddddddddd",
            "parentUuid": "cccccccc-cccc-cccc-cccc-cccccccccccc",
            "sessionId": SESSION_ID,
            "cwd": NEW_REPO,
            "timestamp": "2026-01-01T00:00:03.000Z",
        }]
        record("fail.migration_note (duplicate)", False, vm.check_migration_note(dup_note))

        # 10. Migration note with isMeta=True (should be regular user message)
        meta_note = make_clean_entries(with_migration_note=False) + [{
            "type": "user",
            "message": {"role": "user", "content": "<session-migration-note>\nmeta version\n</session-migration-note>"},
            "isMeta": True,
            "uuid": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
            "parentUuid": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "sessionId": SESSION_ID,
            "cwd": NEW_REPO,
            "timestamp": "2026-01-01T00:00:02.000Z",
        }]
        record("fail.migration_note (isMeta=true)", False, vm.check_migration_note(meta_note))

        # 11. Truly-stale old path in pre-note entry (unrelated old vs new)
        stale_entries = make_clean_entries(new_cwd=NEW_REPO)
        stale_entries[1] = {
            **stale_entries[1],
            "message": {
                "role": "user",
                "content": f"Check the file at {OLD_REPO}\\stuff.txt please",
            },
        }
        record("fail.stale_refs (unrelated paths)", False, vm.check_stale_path_references(stale_entries, OLD_REPO, NEW_REPO))

        # 12. Prefix-containment false-positive shouldn't trigger
        # When new_repo is a subdir of old_repo, references to old-path-as-prefix-of-new-path are NOT stale.
        prefix_clean = make_clean_entries(new_cwd=NEW_REPO_SUBDIR)
        record(
            "happy.stale_refs (subdir new path, no actual stale refs)",
            True,
            vm.check_stale_path_references(prefix_clean, OLD_REPO, NEW_REPO_SUBDIR),
        )

        # 13. Post-note stale refs should NOT trigger (out of scope)
        post_note_stale = list(clean_entries) + [{
            "type": "tool_result",
            "uuid": "ffffffff-ffff-ffff-ffff-ffffffffffff",
            "parentUuid": "cccccccc-cccc-cccc-cccc-cccccccccccc",
            "sessionId": SESSION_ID,
            "cwd": NEW_REPO,
            "timestamp": "2026-01-01T00:00:04.000Z",
            "message": {
                "role": "user",
                "content": f"Tool output mentioning {OLD_REPO}\\somefile.txt — but this is AFTER migration",
            },
        }]
        record(
            "happy.stale_refs (post-note refs ignored)",
            True,
            vm.check_stale_path_references(post_note_stale, OLD_REPO, NEW_REPO),
        )

        # 14. Sidecar with parse error
        sidecar_file = tmp / SESSION_ID
        sidecar_file.mkdir()
        (sidecar_file / "agent-test.jsonl").write_text(
            json.dumps({"type": "user", "sessionId": SESSION_ID, "uuid": "11111111-1111-1111-1111-111111111111"}) + "\n{bad json line\n",
            encoding="utf-8",
        )
        record("fail.sidecar (bad parse in subagent)", False, vm.check_sidecar_integrity(clean_file, SESSION_ID))

        # 15. Sidecar with wrong sessionId
        shutil.rmtree(sidecar_file)
        sidecar_file.mkdir()
        (sidecar_file / "agent-mismatch.jsonl").write_text(
            json.dumps({"type": "user", "sessionId": "different-session-id", "uuid": "11111111-1111-1111-1111-111111111111"}) + "\n",
            encoding="utf-8",
        )
        record("fail.sidecar (wrong sessionId)", False, vm.check_sidecar_integrity(clean_file, SESSION_ID))

        # 16. Sidecar clean
        shutil.rmtree(sidecar_file)
        sidecar_file.mkdir()
        (sidecar_file / "agent-good.jsonl").write_text(
            json.dumps({"type": "user", "sessionId": SESSION_ID, "uuid": "11111111-1111-1111-1111-111111111111"}) + "\n",
            encoding="utf-8",
        )
        record("happy.sidecar (clean)", True, vm.check_sidecar_integrity(clean_file, SESSION_ID))

        # 17. Backup cross-validation happy path
        backup_file = tmp / f"backup-{SESSION_ID}.jsonl"
        # Source backup = clean entries WITHOUT the migration note (note is added by migration)
        source_entries = make_clean_entries(with_migration_note=False)
        write_jsonl(backup_file, source_entries)
        live_entries = make_clean_entries(with_migration_note=True)  # = source + note
        # Sidecar live present + matching backup absent (skipped sub-check)
        result = vm.check_backup_cross_validation(
            migrated_entries=live_entries,
            source_backup_path=backup_file,
            sidecar_live=tmp / "no-sidecar-live",  # doesn't exist; counts as 0
            sidecar_backup=None,
            target_backup_dir=None,
            target_live_dir=tmp,
        )
        record("happy.backup_cross_validation", True, result)

        # 18. Backup cross-validation: entry count mismatch
        truncated = make_clean_entries(with_migration_note=True)[:-2]  # drop note + one entry
        result = vm.check_backup_cross_validation(
            migrated_entries=truncated,
            source_backup_path=backup_file,
            sidecar_live=tmp / "no-sidecar-live",
            sidecar_backup=None,
            target_backup_dir=None,
            target_live_dir=tmp,
        )
        record("fail.backup_cross_validation (entry count)", False, result)

        # 19. Backup cross-validation: uuid order broken
        reordered = list(live_entries)
        reordered[1], reordered[2] = reordered[2], reordered[1]
        result = vm.check_backup_cross_validation(
            migrated_entries=reordered,
            source_backup_path=backup_file,
            sidecar_live=tmp / "no-sidecar-live",
            sidecar_backup=None,
            target_backup_dir=None,
            target_live_dir=tmp,
        )
        record("fail.backup_cross_validation (uuid order)", False, result)

        # --- Summary ---
        passed = sum(1 for _, ok, _ in results if ok)
        total = len(results)
        print(f"\n=== test-validate-migration: {passed}/{total} cases passed ===")
        if passed != total:
            print("\nFailing cases:")
            for name, ok, detail in results:
                if not ok:
                    print(f"  - {name}: {detail}")
            return 1
        return 0


if __name__ == "__main__":
    sys.exit(main())
