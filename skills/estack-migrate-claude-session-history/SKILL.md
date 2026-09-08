---
name: estack-migrate-claude-session-history
version: 1.0.5
description: >-
  (migrate-claude-session-history) Move a Claude Code session transcript and
  its subagent sidecar files to another project so /resume finds it there. Use
  when asked to migrate or move a session between projects.
---

# Migrate Claude Session History

## When this skill applies

The user wants a specific session (or a handful of sessions) that currently lives under Project A in `~/.claude/projects/` to instead live under Project B, so that `claude --resume` and `/resume` find it under B and the conversation's recorded working directory matches B.

This is **not** the right skill for:

- Listing / searching / reading sessions → use `estack-read-agent-history`
- Recovering deleted sessions from backups → use the `.claude-backups` snapshots via `estack-read-agent-history`
- Renaming a project's working directory and moving **all** of its sessions at once → use `scripts/migrate-claude-history.js` directly without the `--session` flag (it has a full-project mode)
- A brand-new conversation in a different folder → just start a fresh Claude Code session there

## Why this is not a one-liner

A Claude Code session is keyed by the project's working directory, which gets encoded into the project folder name under `~/.claude/projects/`. The session's `.jsonl` transcript contains hundreds of references to that directory across **nine** path-encoding variants (JSON-escaped backslash, plain backslash, forward slash, MSYS, hyphenated project-dir name — each in upper/lower drive-letter forms). A `cwd` field exists on most entries. There is also a sidecar directory (`<uuid>/subagents/`) holding subagent transcripts that must move together.

Just `mv` will not work. The bundled script handles all of this; the workflow below ties it together with a backup, a visible migration note, and verification.

See `references/path-encoding.md` for the encoding reference.

## Workflow

Work through these steps in order. Skipping the plan / backup / verification steps is exactly how a migration goes wrong silently — the script reports success, but `/resume` fails to find the session or loads it under the wrong project.

### 1. Resolve the inputs

You need three things. Treat the conversation as the primary source — only ask the user for what is genuinely missing.

| Input | How to resolve |
|---|---|
| **Session UUID** | If the user gave a UUID, use it. If they gave a session file path, take the basename without `.jsonl`. If they only described the session ("the one where we did X"), use `estack-read-agent-history` search mode across projects to find candidates and confirm only if several remain plausible. |
| **Source project path** (the real cwd) | Use `estack-read-agent-history` lookup to locate the source `.jsonl`, then read its recorded `cwd` field. Do not reverse the hyphenated project-folder name: hyphens in a real path cannot be reconstructed reliably. If the transcript has no usable `cwd`, ask for or independently establish the source path. |
| **Target project path** (where the session should live) | Ask the user, unless the conversation already named it (e.g. "move it to `~\Foo\Bar`"). The target project directory under `~/.claude/projects/` does **not** need to exist yet — the script creates it. The encoded folder name is derived from the path. |

If the source and target encoded folder names are identical, the migration is a no-op — tell the user.

### 2. Resolve the plan

Before touching anything, show the user a short plan with:

- Source `.jsonl` path
- Target `.jsonl` path
- Old cwd → New cwd (the values that will be rewritten)
- Backup location (default: `~/.e-stack/estack-migrate-claude-session-history/backups/<timestamp>-pre-migration/`, or a path the user prefers)
- A note that the script will also append a visible user-message migration note to the migrated transcript (on by default; see step 6)

Proceed once the source session and target path are unambiguous. Ask only if the target, source, or requested scope is still unclear; a session-migration request already authorizes this reversible copy-and-rewrite workflow.

### 3. Back up both project directories — full copies, both sides

Robocopy is the right tool on Windows — fast and resilient with large dirs:

```powershell
$ts = Get-Date -Format "yyyy-MM-dd-HHmmss"
$backupRoot = "$HOME\.e-stack\estack-migrate-claude-session-history\backups\$ts-pre-migration"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
robocopy "<source-project-dir>" "$backupRoot\<source-folder-name>" /E /NFL /NDL /NJH /NJS /NP /MT:8 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Source backup failed (robocopy exit $LASTEXITCODE)." }
if (Test-Path "<target-project-dir>") {
  robocopy "<target-project-dir>" "$backupRoot\<target-folder-name>" /E /NFL /NDL /NJH /NJS /NP /MT:8 | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Target backup failed (robocopy exit $LASTEXITCODE)." }
} else {
  "Target project directory was absent before migration." | Set-Content -Encoding UTF8 "$backupRoot\target-absent.txt"
}
```

Back up the **entire** source project dir **and** the **entire** target project dir, even if the target only has one or two unrelated sessions. These backups serve two purposes, and the second one is the one people forget:

1. **Rollback safety net.** If anything in the migration goes wrong, you can restore both sides to their pre-migration state in one command.
2. **Ground truth for validation.** The backup of the source dir is the only authoritative record of what the original transcript looked like — every entry, every path string, every sidecar file. After migration, step 7 will diff the migrated content against the backup to prove that **every** old-path occurrence was rewritten (no encoding variant was missed) and **no** entries were lost, duplicated, or reordered. The backup of the target dir proves you only **added** files to it — you didn't accidentally overwrite anything that was already there. Without both backups, "the migration worked" is hope, not verification.

Robocopy's exit codes are non-standard — 0–7 are successful outcomes with varying copy/extra-file states, while 8 or greater is failure. After it finishes, report the file counts and sizes from `Get-ChildItem ... -Recurse | Measure-Object` so the user sees the backup actually contains something. If the target directory was absent, retain `target-absent.txt` as that pre-migration evidence.

### 4. Dry-run, then execute

```bash
node <skill-dir>/scripts/migrate-claude-history.js \
  --old-repo "<source-project-real-path>" \
  --new-repo "<target-project-real-path>" \
  --session <session-uuid> \
  --dry-run
```

The dry-run prints:

- Which `.jsonl` plus how many sidecar files would be copied
- Replacement counts per path-encoding variant (most sessions hit only pattern A — JSON-escaped backslash, upper-drive — because that's what `cwd` fields use)

If the dry-run output looks wrong (zero sidecar files when there should be subagents, wildly different replacement counts than expected, or zero replacements at all), stop and investigate before running for real. See `references/troubleshooting.md`.

Before running without `--dry-run`, inspect the target session path and `<uuid>/` sidecar path. If either already exists, stop rather than overwriting it. Also check the source transcript's modification time before and after preflight; if it changes, an active Claude writer may be appending and the migration should wait until that session is idle.

Then run without `--dry-run` to execute. The script:

- Copies the `<uuid>.jsonl` to the target project dir, applying all 9 path replacements
- Copies the entire `<uuid>/subagents/` sidecar tree (subagent transcripts + meta files) with the same replacements
- Appends a visible migration note as a regular user message to the main `.jsonl` (see step 6)
- Runs its own stale-reference verifier and reports any matches

### 5. Handle the "stale reference" warning

When the **new** project path contains the **old** project path as a prefix (e.g. moving from `Other Claude Code` → `Other Claude Code\Personal-Health-Project`), the script's verifier will warn about "stale references" in the migrated file. These are **false positives**: every occurrence of the old path is now actually inside a new-path string (since the new path begins with the old path).

Confirm it really is a false positive by counting genuine stale references — occurrences of the old path that are **not** followed by the new path's added segment. A Python check is in `references/troubleshooting.md`. If true-stale count is zero, ignore the warning.

If true-stale count is non-zero, **do not** declare success. Investigate which pattern the script missed and either fix the script or hand-patch the file.

### 6. The migration note

By default, the script appends a `type: "user"` entry (no `isMeta`) as the last entry of the migrated `.jsonl`. This entry:

- Tells future-Claude (and the user, when scrolling the conversation) that the session was migrated, what was rewritten, and how to recover when a rewritten path no longer exists on disk
- Is intentionally **not** `isMeta: true` — the user wants both themselves and the AI to see it on `/resume`
- Is duplicate-safe — the script's append routine checks the last few entries for an existing `<session-migration-note>` block and refuses to add a second

Users can opt out with `--no-migration-note`, but the script prints a warning that this is strongly discouraged. Do not pass `--no-migration-note` unless the user has explicitly asked for it.

### 7. Verify end-to-end — and validate against the backup

Run the bundled validation script. It consolidates every structural, schema, path-consistency, sidecar, and (optional) backup-cross-validation check into one invocation, prints a per-check PASS/FAIL table, and exits non-zero on any failure.

```bash
python <skill-dir>/scripts/validate-migration.py \
  "<target-project-encoded-dir>/<uuid>.jsonl" \
  --old-repo "<source-real-path>" \
  --new-repo "<target-real-path>" \
  --source-backup "<backup-root>/<source-folder-name>/<uuid>.jsonl" \
  --target-backup-dir "<backup-root>/<target-folder-name>"
```

When `target-absent.txt` records that the target directory did not exist, omit
`--target-backup-dir`: there are no pre-existing target files to compare. The source-backup
cross-validation still runs and the marker remains evidence of that condition.

The script runs these checks in order — most of them require no flags, the path checks need `--old-repo` and `--new-repo`, and the cross-validation checks need `--source-backup` (with `--target-backup-dir` enabling the "target untouched" sub-check):

| Check | What it validates | Needs flags |
|---|---|---|
| JSONL parse integrity | Every line is valid JSON | — |
| Schema consistency | Each entry has `type`; user/assistant entries have well-formed `message`; uuids and parentUuids are UUID-shaped | — |
| Session ID consistency | Every entry's `sessionId` matches the file's UUID | — |
| Parent UUID chains | Every non-null `parentUuid` resolves to a uuid present in the file | — |
| CWD field consistency | All non-empty `cwd` values are identical (and equal `--new-repo` if passed) | optionally `--new-repo` |
| Migration note present | Exactly one `<session-migration-note>` entry exists, is `type: "user"`, no `isMeta` | — |
| Stale path references | No "truly-stale" old-path references in entries that existed at migration time (post-note entries are skipped — those are later activity that can legitimately reference the old path) | `--old-repo` + `--new-repo` |
| Sidecar integrity | Every subagent `.jsonl` in `<uuid>/` parses and shares the parent `sessionId` | — |
| Backup cross-validation | Source backup parses; entry count = source + 1; every source uuid present in order; sidecar count matches; pre-existing target files unchanged | `--source-backup` (+ `--target-backup-dir`) |

If anything fails, stop. Read the failed check's detail line — it points at the specific entry index or file. The backup is right there; if recovery is needed: `robocopy <backup-dir> <live-dir> /MIR`.

All checks must pass before declaring success. The script's final line is the summary you report back to the user.

### 8. Tell the user what's next, and retain the safety net

After verification, the user still has work to do. Walk them through these in order — each one unlocks the next.

1. **Test `/resume` in the new project's working directory.** This is the real validation. The migrated session should appear in the resume picker and load with the full conversation history. If it doesn't, **stop** — do not delete anything. See `references/troubleshooting.md` → "/resume doesn't show the session under the new project" for diagnosis.

   Give the user a ready-to-run command they can copy directly. Format it in a fenced code block:

   ```
   cd "<target-project-real-path>";claude -r <session-uuid>
   ```

   Example: `cd "C:\Users\2supe\Other Claude Code\Personal-Health-Project";claude -r ef382169-d56b-4850-b092-8084a52983ef`

2. **Once `/resume` works, delete the original session from the source project.** Until they do, `--mode lookup` will report the UUID as ambiguous, and Claude Code may still find the session under the old project. Ask the user before running these yourself — deletion is irreversible:
   ```powershell
   Remove-Item "<source-project-encoded-dir>\<uuid>.jsonl"
   Remove-Item -Recurse "<source-project-encoded-dir>\<uuid>"  # sidecar dir
   ```

### 9. Retain or remove the backup

Keep the pre-migration backup by default. It is the recovery handoff for a transcript the user may later discover was incomplete. If the user expressly asks to remove that exact backup after `/resume` works and the source copy is intentionally deleted, first show the resolved backup path and measured size, then remove only that folder and report the result.

## Common pitfalls

These are the failure modes that have actually happened — read `references/troubleshooting.md` for the fixes.

- Forgetting the sidecar dir — the main `.jsonl` migrates but the subagent transcripts get left behind, so the migrated brief shows `subagents: 0` even though the original had many. The script's `--session` mode now handles this automatically, but verify with the subagent-list check.
- Treating "stale reference" warnings as real when the new path is a subdir of the old path.
- Running the migration without `--session`, which migrates **every** session in the source project (the constants/CLI default is full-project mode).
- Source-path encoding mismatch — Claude Code creates `C--Foo` on Windows but case-insensitive filesystems can produce `c--Foo`. The script tries both.
- Forgetting to rewrite `gitBranch` / `version` consistency on the appended note — the script copies these from the last uuid-bearing entry; do not invent values.

## Files in this skill

- `scripts/migrate-claude-history.js` — the migration script. Supports full-project and single-session modes, CLI overrides for old/new repo, auto-append of the migration note (on by default), `--no-migration-note` opt-out, and `--dry-run`. Run `node scripts/migrate-claude-history.js --help` for the full CLI.
- `scripts/validate-migration.py` — post-migration validator. Runs structural, schema, path-consistency, sidecar, and (optional) backup-cross-validation checks on a migrated `.jsonl`. Exits 0 if every check passes, 1 otherwise. Run `python scripts/validate-migration.py --help` for the full CLI. Use this in step 7 instead of writing ad-hoc Python.
- `tests/estack-migrate-claude-session-history/test-append-note.js` — smoke test for the note-append routine (path relative to repo root). Run with `node tests/estack-migrate-claude-session-history/test-append-note.js` from the repo root. Useful if you edit the migration script and want to sanity-check the duplicate-detection and non-meta entry shape.
- `tests/estack-migrate-claude-session-history/test-validate-migration.py` — self-test for the validator (path relative to repo root). Runs 27 synthetic cases covering every check. Run with `python tests/estack-migrate-claude-session-history/test-validate-migration.py` from the repo root. Exit 0 on full pass, 1 if any case fails.
- `references/path-encoding.md` — the 9 path-encoding variants, why each exists, which entries use which form.
- `references/troubleshooting.md` — recoveries for stale-reference false positives, missed sidecars, ambiguous lookups, and the true-stale grep recipe.
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-migrate-claude-session-history:` and a body. File an
issue only when the user explicitly asks you to do so. If they have not asked,
offer the draft and issue page for their review; do not post or open anything
automatically.

When the user explicitly authorizes filing and `gh` is installed (`gh --version` succeeds), create the issue with structured arguments. Put the reviewed body in a UTF-8 temporary file and pass its literal path with `--body-file`; do not interpolate feedback into shell code.

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "<reviewed title>" \
  --body-file "<path-to-reviewed-UTF-8-body-file>"
```

If `gh` is unavailable, give the user the reviewed title and body to paste into a
new issue at `https://github.com/ElliotDrel/e-stack/issues/new`.
