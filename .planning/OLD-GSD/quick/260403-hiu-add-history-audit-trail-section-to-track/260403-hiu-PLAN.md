---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - github-issues-update/references/tracker-schema.md
  - github-issues-update/references/result-file-schema.md
  - github-issues-update/tracker-template.md
  - github-issues-update/bin/tracker-tools.cjs
  - github-issues-update/workflows/check-issues.md
  - github-issues-update/workflows/save-issues.md
autonomous: true
requirements: [HIU-01]

must_haves:
  truths:
    - "Each active issue in the tracker has a **History:** section with timestamped entries"
    - "Filing an issue via save-issues appends a history entry like '- **YYYY-MM-DD:** Filed issue'"
    - "Check-in actions (comments posted, state changes detected, duplicates found) are logged as history entries"
    - "External events detected during check-in (maintainer replies, PRs merged) appear as history entries"
    - "build-tracker generates History section from result file data"
    - "update-tracker appends new history entries without clobbering existing ones"
  artifacts:
    - path: "github-issues-update/references/tracker-schema.md"
      provides: "History field definition and rules"
      contains: "**History:**"
    - path: "github-issues-update/references/result-file-schema.md"
      provides: "history_entries field in Tracker Updates section"
      contains: "history_entries"
    - path: "github-issues-update/bin/tracker-tools.cjs"
      provides: "buildTrackerEntry emits History, update-tracker appends history, parseIssueBlock extracts history"
  key_links:
    - from: "github-issues-update/workflows/check-issues.md"
      to: "result-file-schema.md"
      via: "Agent prompt instructs history_entries in Tracker Updates"
      pattern: "history_entries"
    - from: "github-issues-update/bin/tracker-tools.cjs"
      to: "tracker-schema.md"
      via: "buildTrackerEntry and applyTrackerUpdates handle History field"
      pattern: "History"
---

<objective>
Add a per-issue History/audit trail to the github-issues-update skill.

Purpose: Track what happened to each issue over time — our actions (filing, commenting, posting workarounds) and external events (maintainer replies, state changes, PRs merged). Gives chronological context during check-ins.

Output: Updated schema, template, result-file format, CJS tooling, and both workflows to produce and consume history entries.
</objective>

<execution_context>
@.claude/skills/get-shit-done/workflows/execute-plan.md
@.claude/skills/get-shit-done/templates/summary.md
</execution_context>

<context>
@github-issues-update/references/tracker-schema.md
@github-issues-update/references/result-file-schema.md
@github-issues-update/tracker-template.md
@github-issues-update/bin/tracker-tools.cjs
@github-issues-update/workflows/check-issues.md
@github-issues-update/workflows/save-issues.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add History field to schemas and template</name>
  <files>
    github-issues-update/references/tracker-schema.md
    github-issues-update/references/result-file-schema.md
    github-issues-update/tracker-template.md
  </files>
  <action>
**tracker-schema.md** — Add `**History:**` field to the Active Issues entry format, placed after `**Future:**` (last content field, before the next issue). Add field rules:
- Timestamped bullet list, chronological (newest last): `- **YYYY-MM-DD:** Action description`
- Logs both our actions and detected external events
- Never remove or rewrite existing entries — only append
- On initial filing, first entry is: `- **YYYY-MM-DD:** Filed issue` (or `Added to tracker` if not authored)

Add to the example entry block:
```
- **History:**
  - **YYYY-MM-DD:** Filed issue with 3 crash instances, upstream tracking in bun#28175
  - **YYYY-MM-DD:** Posted workaround (callbackPort: 3118 fix)
  - **YYYY-MM-DD:** Maintainer @user replied with fix proposal
```

Add to Update Rules: "Append new history entries. Never remove or edit existing history entries."

**result-file-schema.md** — Add `history_entries` lines to the `## Tracker Updates` section (alongside existing `status_summary`, `what_to_check`, `new_duplicate`). Format:
```
history_entry: YYYY-MM-DD | Description of action or event
```
Multiple `history_entry` lines allowed (one per event). These are consumed by `update-tracker` and `build-tracker`.

Add guidance on what to log:
- Our actions: "Posted comment with workaround", "Filed issue", "Added duplicate reference"
- External events: "Maintainer @user replied with fix proposal", "State changed to closed", "PR #123 merged"
- Keep descriptions specific (same quality bar as role/next-steps — no generic "Updated issue")

**tracker-template.md** — Add `- **History:**` to the HTML comment example inside the Active Issues section, after `- **Future:**`.
  </action>
  <verify>
    <automated>grep -c "History" github-issues-update/references/tracker-schema.md github-issues-update/references/result-file-schema.md github-issues-update/tracker-template.md</automated>
  </verify>
  <done>All three reference/template files define the History field. Schema documents the format and rules. Result-file-schema defines history_entry lines in Tracker Updates. Template includes History in its example comment.</done>
</task>

<task type="auto">
  <name>Task 2: Update tracker-tools.cjs to parse, build, and update History</name>
  <files>github-issues-update/bin/tracker-tools.cjs</files>
  <action>
Three changes to tracker-tools.cjs:

**1. parseIssueBlock (line ~155):** Extract the History field. History is a multi-line field — extract all `- **YYYY-MM-DD:**` bullet lines under `**History:**`. Add to the issue object as `history: []` array of strings (each string is the full bullet text like `**2026-03-15:** Filed issue`). Use a new extraction function since it's multi-line unlike the single-line extractField pattern.

Pattern: Match from `**History:**` until the next `- **FieldName:**` or `### ` or end. Collect all lines matching `^\s+- \*\*\d{4}-\d{2}-\d{2}\*\*:`.

**2. buildTrackerEntry (line ~1163):** After the `Future` line and before the final empty line, add the History section. Read `history_entry:` lines from the `## Tracker Updates` section of the result file body. Format them as:
```
- **History:**
  - **YYYY-MM-DD:** Description
```
If no history_entry lines found, add a default entry: `- **YYYY-MM-DD:** Added to tracker` (using today's date from dateStr).

**3. applyTrackerUpdates (line ~438):** After handling status_summary, what_to_check, and new_duplicate updates, add history entry handling. Parse `history_entry:` lines from the result file's Tracker Updates section. For each entry, append it to the existing History section in the tracker issue block. If no History section exists yet, create one before the trailing newline of the issue block.

Append logic: Find `- **History:**` in the section. If found, append new `  - **DATE:** description` lines after the last existing history bullet. If not found, insert `- **History:**\n  - **DATE:** description` after the last field line (before the next `### ` or end of section).

IMPORTANT: Never remove existing history entries. Only append new ones. Check for duplicate entries by comparing the date+description text before appending to avoid re-adding the same entry on repeated runs.
  </action>
  <verify>
    <automated>node github-issues-update/bin/tracker-tools.cjs 2>&1 | head -5</automated>
  </verify>
  <done>parseIssueBlock returns history array. buildTrackerEntry writes History section from result file history_entry lines. applyTrackerUpdates appends new history entries without clobbering existing ones. Script loads without syntax errors.</done>
</task>

<task type="auto">
  <name>Task 3: Update workflows to produce history entries</name>
  <files>
    github-issues-update/workflows/check-issues.md
    github-issues-update/workflows/save-issues.md
  </files>
  <action>
**check-issues.md — Step 3 (batched_analysis):** In the agent prompt instructions (around point 9, after the MANDATORY write instruction), add:

Point 10: **MANDATORY — Write `history_entry` lines in the `## Tracker Updates` section.** For each issue, include one `history_entry` line per notable event:
- If `has_activity` is true: `history_entry: YYYY-MM-DD | New activity: @commenter replied (brief summary)`
- If `state_changed` is true: `history_entry: YYYY-MM-DD | State changed to {open|closed}`
- If new duplicates found: `history_entry: YYYY-MM-DD | Found duplicate #NUMBER`
- If the agent recommends posting a comment (in Next Steps): `history_entry: YYYY-MM-DD | Check-in review completed`
- If no activity and no changes, still log: `history_entry: YYYY-MM-DD | Check-in: no new activity`

Use today's date (pass the date to the agent prompt alongside the other per-issue data).

**check-issues.md — Step 7 (confirm_actions):** After successfully posting comments via `gh issue comment`, note that the tracker update in Step 8 should reflect these actions. Add instruction: "For each comment posted, the update-tracker step will record this in history. Write a temporary file `$TEMP_DIR/actions-taken.md` listing each action as a `history_entry:` line (e.g., `history_entry: YYYY-MM-DD | Posted comment on owner/repo#NUMBER: brief description`). The update-tracker command will consume this."

Actually — simpler approach: After posting comments in Step 7, append `history_entry` lines to the corresponding `issue-OWNER-REPO-NUMBER.md` result files in `$TEMP_DIR` (inside the existing `## Tracker Updates` section). This way update-tracker picks them up naturally.

**save-issues.md — Step 4 (confirm_and_write):** When building new tracker entries, include a History section with the initial entry:
```
- **History:**
  - **YYYY-MM-DD:** Filed issue (brief context from conversation)
```
Or if the user is adding an existing issue they didn't author:
```
- **History:**
  - **YYYY-MM-DD:** Added to tracker for monitoring
```
Add this instruction after "Build new tracker entries following the format in `references/tracker-schema.md`."
  </action>
  <verify>
    <automated>grep -c "history_entry" github-issues-update/workflows/check-issues.md github-issues-update/workflows/save-issues.md</automated>
  </verify>
  <done>check-issues.md instructs analysis agents to write history_entry lines per issue and appends entries after comment posting. save-issues.md includes initial History entry when adding issues to tracker.</done>
</task>

</tasks>

<verification>
1. `grep -n "History" github-issues-update/references/tracker-schema.md` — shows History field definition
2. `grep -n "history_entry" github-issues-update/references/result-file-schema.md` — shows history_entry format
3. `grep -n "history" github-issues-update/bin/tracker-tools.cjs` — shows parse, build, update handling
4. `grep -n "history_entry\|History" github-issues-update/workflows/check-issues.md` — shows agent instructions
5. `grep -n "History" github-issues-update/workflows/save-issues.md` — shows initial entry on filing
6. `node github-issues-update/bin/tracker-tools.cjs` — exits without syntax error (shows usage)
</verification>

<success_criteria>
- tracker-schema.md defines History field with format, examples, and rules
- result-file-schema.md defines history_entry lines in Tracker Updates
- tracker-template.md includes History in its example comment
- tracker-tools.cjs parseIssueBlock extracts history entries
- tracker-tools.cjs buildTrackerEntry writes History from result file data
- tracker-tools.cjs applyTrackerUpdates appends history entries without clobbering
- check-issues.md instructs agents to produce history_entry lines
- check-issues.md appends history entries after posting comments
- save-issues.md includes initial History entry when adding issues
</success_criteria>

<output>
After completion, create `.planning/quick/260403-hiu-add-history-audit-trail-section-to-track/260403-hiu-SUMMARY.md`
</output>
