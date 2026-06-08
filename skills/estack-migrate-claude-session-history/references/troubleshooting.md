# Troubleshooting

Specific failure modes that have actually happened, with the diagnostic and the fix.

## Stale reference false positive

**Symptom.** The script prints, for the migrated file:

```
Stale reference in: <new-path>\<uuid>.jsonl (matches: C:\\Users\\...)
WARNING: Found N file(s) in the new project dir that still contain old path references.
```

**When this is harmless.** When the **new** project path contains the **old** project path as a prefix (e.g. you migrated `C:\Users\me\Workspace` → `C:\Users\me\Workspace\Sub-Project`), every successfully rewritten occurrence of the new path also contains the old path as a substring. The verifier does naive substring matching, so it flags itself.

**Diagnostic — count GENUINELY stale occurrences.** Run the bundled validator with `--old-repo` and `--new-repo`; the "Stale path references" check uses a negative-lookahead that filters out the prefix-containment false positives. It also scopes the check to entries that existed at migration time, ignoring any later activity that legitimately references the old path:

```bash
python <skill-dir>/scripts/validate-migration.py \
  "<target-jsonl>" \
  --old-repo "<source-real-path>" \
  --new-repo "<target-real-path>"
```

If that check passes, the migration script's own warning was a false positive — move on. If it fails, the failure detail names the specific entries and counts; figure out which encoding variant the migration script missed (see `path-encoding.md`) and either re-run with a fix or hand-patch the file.

## Sidecar / subagent files left behind

**Symptom.** The migrated session's brief shows `subagents: 0`, but the original had several. Or `--mode subagent-list` against the migrated file returns nothing.

**Cause.** In an older version of the script's single-session mode, only the top-level `<uuid>.jsonl` was copied — the `<uuid>/subagents/` sidecar directory was missed because the filter matched on basename only.

**Fix.** The current script copies the sidecar tree automatically when `--session` is set. If you see this symptom, you're running an out-of-date copy of the script. Use the bundled one at `scripts/migrate-claude-history.js`.

**Recovery if it already happened.** Just re-run the migration. The script's "skip if destination exists" check means the already-copied `.jsonl` won't be touched, and the sidecar files will be added on the second pass.

## Ambiguous UUID lookup

**Symptom.** After migration, `read-claude-session-history --mode lookup --uuid <prefix>` returns:

```
Ambiguous prefix '<uuid>' matches 2 sessions:
  <source-project>/<uuid>.jsonl
  <target-project>/<uuid>.jsonl
```

**Cause.** This is expected and correct — the migration is non-destructive. The source copy is still in place as a safety net until the user confirms `/resume` works under the new project.

**Fix.** Once the user has confirmed the migrated session resumes correctly under the new project, delete the source copy:

```powershell
Remove-Item "<source-project-encoded-dir>\<uuid>.jsonl"
Remove-Item -Recurse "<source-project-encoded-dir>\<uuid>"  # sidecar dir
```

Never delete before the user confirms. The backup folder is a fallback if the user discovers something broken later, but the in-place source copy is the fastest recovery path.

## /resume doesn't show the session under the new project

**Symptom.** User runs `claude` in the new project's working directory, types `/resume`, and the migrated session doesn't appear in the list.

**Diagnosis — go through these in order.**

1. **Confirm the migrated `.jsonl` is in the right encoded folder.** The folder under `~/.claude/projects/` must exactly match the encoded form of the **real** path the user is `cd`'d into. Case differences (`C--Foo` vs `c--Foo`) and missing/added hyphens both break the match. Compare: get the real cwd → encode it (drop drive colon, replace separators with `-`) → ensure that's the folder name.

2. **Confirm the `cwd` field inside the entries matches.** A surprising amount of `/resume` logic keys off the entries' `cwd` field, not the folder name. Run the distinct-cwd check from SKILL.md step 7 — every entry should be the new path (or empty for marker entries).

3. **Confirm the `.jsonl` is not zero-byte or malformed.** Open it: `python -c "import json; [json.loads(l) for l in open(r'<path>', encoding='utf-8') if l.strip()]"` — if this errors, the migration corrupted something.

4. **Check whether Claude Code stripped or reordered entries.** Claude Code occasionally writes `permission-mode` and `ai-title` metadata entries when something opens a file. These are harmless. But if the count is far off from the original (say, more than +5), something else is wrong.

## "Cannot find old project directory" error from the script

**Symptom.** Script exits with: `Could not find old Claude project directory. Checked: ...`

**Cause.** The `--old-repo` value's encoded form doesn't match any folder under `~/.claude/projects/`. Most often this is because the user gave a real path that doesn't actually have any sessions yet (the project folder gets created lazily).

**Fix.** Run `ls ~/.claude/projects/` and find the folder name that corresponds to the user's intended source. Reverse-engineer the real path from the folder name and pass that as `--old-repo`. The encoding is: `C--<rest>` becomes `C:\<rest with hyphens turned back into backslashes>`.

## The migration note was accidentally appended twice

**Symptom.** Two `<session-migration-note>` blocks at the tail of the file.

**Cause.** Pre-fix versions of the append routine didn't dedupe; or the file was edited between two script runs.

**Fix.** The current script checks the last few entries for an existing `<session-migration-note>` and won't append a duplicate. To clean up an already-doubled note, hand-edit the file: remove the older note entry, keep the newer one. Always backup the file first.

## Forgetting `--session` and migrating the whole project

**Symptom.** Script copies hundreds of files, takes much longer than expected, prints replacement counts in the thousands. The target project dir suddenly has many `.jsonl` files.

**Cause.** Without `--session`, the script's default mode migrates **every** session in the source project — that's how the script was originally written, for the rename-a-project use case.

**Fix.** Stop the script (Ctrl-C if still running). Delete the unintended files from the target project dir (compare with the target backup to know what wasn't there before). Re-run with `--session <uuid>` this time.

This is why backing up the **target** dir matters as much as backing up the source — without it, recovering from this mistake is much harder.
