# Brief 03 — Incremental tracker persistence via `append-history`

**Closes:** #3
**Files:** `bin/tracker-tools.cjs`, `SKILL.md`, `references/result-file-schema.md`
**Size:** medium — one new CLI command + extracted helper + prompt rules.
**Depends on:** Brief 01 (must land first).

---

## Root cause (verified against source)

Two coupled roots, the structural one primary:

1. **Structural (primary): no atomic incremental-write mechanism exists.** The command router
   (lines 37-43) has exactly five commands — `compile-report`, `update-tracker`, `startup`,
   `fetch-issues`, `build-tracker`. There is **no** `append-history`. The only write paths are
   `update-tracker` (bulk, reads the whole temp dir, rewrites the file once) or the raw `Edit`
   tool (fragile, requires read-before-edit, manual markdown location). The prompt **cannot**
   persist incrementally even if instructed to — the primitive doesn't exist.

2. **Behavioral: the prompt batches writes to session end.** Step 3 runs `update-tracker`
   after all Step 2b agents finish; Step 5b/5c write via `Edit` near the end. Any interruption
   between an action and the end-of-session write loses that action. Subagent action results
   are worst — they come back as text the orchestrator must remember to persist.

**Verified interruption trace:** Steps 0-1 persist nothing (safe). Step 2b writes ephemeral
temp files. Step 3's `applyTrackerUpdates` does a single `fs.writeFileSync`. Steps 5b-5c rely
on `Edit`. Interruption before Step 3, or mid-5c, loses all intermediate state.

**Dependency on Brief 01 (verified):** the History-append logic already exists inside
`applyTrackerUpdates` (lines 640-687) but it operates on `section`, which is produced by the
buggy `sectionRe` (line 510, Brief 01 Site A). On the current code that `section` is truncated
to the header line, so `section.indexOf('- **History:**')` fails. **An `append-history`
command that reuses today's section-finding inherits the truncation bug.** Brief 01 must land
first; this brief then extracts the *fixed* logic into a shared helper.

---

## The fix (recommended: Option A — new `append-history` command)

1. **Extract a shared helper** from `applyTrackerUpdates`:
   - `findIssueSection(trackerContent, owner, repo, number)` → returns the section bounds.
     Implement with a **split-based finder** (split on `\n### `, match the header prefix) to be
     structurally immune to the `$`/`m` ambiguity, even after Brief 01 fixes the regex. Belt
     and suspenders.
   - `appendHistoryEntry(section, date, desc)` → the dedup + insert-after-last-bullet logic
     currently at lines 640-687.
   Refactor `applyTrackerUpdates` to call these helpers (no behavior change there).

2. **Add the command** to the router and implement:
   ```
   node tracker-tools.cjs append-history \
     --tracker "$TRACKER_PATH" --issue OWNER/REPO#NUMBER \
     --date YYYY-MM-DD --desc "description"
   ```
   Read tracker → `findIssueSection` → `appendHistoryEntry` (create `- **History:**` block if
   absent) → write back. Atomic, no read-before-edit dance, dedups against existing entries.

3. **Prompt rule (SKILL.md Step 5c + subagent prompts):** "After each tracker-relevant action
   (comment posted, issue/PR linked, goal set, state change, PR filed/pushed), immediately run
   `append-history` for that issue before moving on. Do not batch tracker writes at the end."
   Define the tracker-relevant action set explicitly.

4. **Subagent return convention** (`result-file-schema.md` + subagent prompts): each subagent
   emits, for every action, a line:
   ```
   TRACKER_UPDATE: owner/repo#NUMBER | YYYY-MM-DD | <one-line description>
   ```
   The orchestrator calls `append-history` per line on receipt, before continuing.

### Why Option A over alternatives
- **Option C (prompt-only Edit):** relies on Claude doing read-before-edit correctly on every
  action — exactly the "error-prone" path the issue calls out. Rejected.
- **Option B (make `update-tracker` write per-issue + per-batch):** narrows the bulk window but
  doesn't help Step 5c at all (those go through `Edit`, not result files) and still needs temp
  result files. Rejected as incomplete.
- **Option A** gives one atomic, reusable write primitive used by Step 3 (per batch), Step 5c
  (per action), and subagent results (per `TRACKER_UPDATE:` token), and removes the
  read-before-edit dependency from the prompt entirely.

---

## Verification / test plan
1. Unit-test `append-history` against a tracker with an existing History block, a missing
   History block, and a non-existent issue (should no-op with a clear message). Confirm dedup.
2. Confirm `findIssueSection` returns full multi-line sections (regression vs Brief 01).
3. Simulate interruption: run a check-in, take 2 actions (each calls `append-history`), kill
   the session before the end. Re-read the tracker — both actions are recorded.
4. Confirm `applyTrackerUpdates` still passes its own tests after the helper extraction.

## Sequencing
After Brief 01. Composes with Brief 04 (action-queue completions are a natural
`append-history` / `TRACKER_UPDATE` caller).

## Commit / PR
`feat(tracker-tools): add append-history for incremental, interrupt-safe persistence (#3)`
