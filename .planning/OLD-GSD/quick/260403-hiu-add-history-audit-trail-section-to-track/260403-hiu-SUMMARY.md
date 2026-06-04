---
phase: quick
plan: hiu
subsystem: github-issues-update
tags: [history, audit-trail, tracker, workflow]
tech-stack:
  added: []
  patterns: [append-only audit log, date-keyed bullet list]
key-files:
  created: []
  modified:
    - github-issues-update/references/tracker-schema.md
    - github-issues-update/references/result-file-schema.md
    - github-issues-update/tracker-template.md
    - github-issues-update/bin/tracker-tools.cjs
    - github-issues-update/workflows/check-issues.md
    - github-issues-update/workflows/save-issues.md
decisions:
  - history_entry lines in result files use "YYYY-MM-DD | description" pipe-separator format for easy regex parsing
  - buildTrackerEntry defaults to "Added to tracker" if no history_entry lines present
  - applyTrackerUpdates deduplicates entries by date+description before appending
completed: 2026-04-03
duration: ~12min
tasks: 3
files: 6
---

# Quick Task 260403-hiu: Add History/Audit Trail to github-issues-update Summary

**One-liner:** Per-issue append-only History section tracking filed, check-in, comment, and external events via timestamped bullets, wired through schemas, CJS tooling, and both workflows.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add History field to schemas and template | b0ca2ce | tracker-schema.md, result-file-schema.md, tracker-template.md |
| 2 | Update tracker-tools.cjs to parse, build, and update History | aa5e51c | bin/tracker-tools.cjs |
| 3 | Update workflows to produce history entries | 8a341f3 | check-issues.md, save-issues.md |

## What Was Built

### Schema Layer (Task 1)

**tracker-schema.md:** Added `**History:**` field after `**Future:**` in the Active Issues entry format with example bullets. Added field rule defining it as append-only chronological log. Added Update Rule 6: "Append new history entries. Never remove or edit existing history entries."

**result-file-schema.md:** Added `history_entry: YYYY-MM-DD | Description` format to the `## Tracker Updates` section. Documents what to log (our actions, external events, routine check-ins) and the quality bar (specific, not generic).

**tracker-template.md:** Added `- **History:**` with initial example bullet to the HTML comment example block.

### CJS Tooling (Task 2)

Three additions to `tracker-tools.cjs`:

1. **`extractHistoryField(block)`** — New function. Finds `- **History:**` in an issue block and collects all indented `- **YYYY-MM-DD:** ...` bullets until the next top-level field. Used by `parseIssueBlock` to populate `issue.history: []`.

2. **`buildTrackerEntry` — History section** — After the Future line, reads `history_entry:` lines from the Tracker Updates section of the result file and emits them as `- **History:**` + indented bullets. Defaults to `Added to tracker` if none found.

3. **`applyTrackerUpdates` — history append logic** — Reads `history_entry:` lines from each result file. If the issue block already has `- **History:**`, deduplicates by date+description and appends new bullets after the last existing bullet. If no History section exists yet, inserts one before the trailing newline of the section.

### Workflows (Task 3)

**check-issues.md — Step 3 (batched_analysis):** Added Point 10 as MANDATORY instruction: analysis agents must write at least one `history_entry` line per issue covering activity, state changes, duplicates found, or a baseline "Check-in: no new activity" entry.

**check-issues.md — Step 7 (confirm_actions):** After posting comments via `gh issue comment`, agents must append `history_entry: YYYY-MM-DD | Posted comment on ...` to the corresponding result file in `$TEMP_DIR`. The `update-tracker` step in Step 8 then picks this up naturally.

**save-issues.md — Step 4 (confirm_and_write):** Added instruction to include a `- **History:**` section in every new tracker entry — `Filed issue (context)` if authored by user, `Added to tracker for monitoring` otherwise.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] tracker-schema.md contains "History" (2 occurrences)
- [x] result-file-schema.md contains "history_entry" (2 occurrences)
- [x] tracker-template.md contains "History" (1 occurrence)
- [x] tracker-tools.cjs loads without syntax errors
- [x] tracker-tools.cjs contains 33 lines referencing "history"
- [x] check-issues.md contains "history_entry" (9 occurrences)
- [x] save-issues.md contains "History" (3 occurrences)
- [x] Commits b0ca2ce, aa5e51c, 8a341f3 verified in git log
