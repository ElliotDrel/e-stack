---
name: estack-github-issue-tracker
version: 1.3.0
description: >
  (github-issue-tracker) GitHub issue tracker management. Checks all open issues the user is involved in,
  finds related/duplicate issues, reports what changed, and recommends next steps.
  Run anytime for a check-in — works the same whether it's the first run or a daily habit.
  The tracker file acts as a cache to make repeat runs faster.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
---

<objective>
Give the user a complete, actionable update on every GitHub issue they're involved in.
One flow, every time — no modes, no flags. The only thing that changes between runs is
depth: more work when the tracker is empty or stale, less when it was just checked yesterday.
</objective>

<execution_context>
Resolve `$SKILL_DIR` from this file's location FIRST.

**Script:** `bin/tracker-tools.cjs` — handles all GitHub API calls, tracker parsing,
report compilation, and tracker updates. Invoke via:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" <command> [options]
```

Every script command returns a `today` field like `today's date is **2026-04-05**, ignore earlier dates`.
Extract the date from this string. If you see multiple `today` values in your context
(from earlier commands), always use the most recent one.

**stdout/stderr convention:** `compile-report` outputs the report text to stdout and
metadata (including `today`) to stderr. Parse accordingly.

**Tracker file:** `$HOME/.e-stack/estack-github-issue-tracker/github-tracker.md`
This is the AI's knowledge base and source of truth. It stores everything in full detail:

- Every tracked issue with complete context, history, and technical data
- Known duplicates, related issues, cross-references
- User's intent/goals for each issue and what to watch for
- History of all actions taken and events observed
- Config directives (excluded repos, preferences)

The tracker is written FOR the AI — keep it detailed. When the user asks questions about
any issue, read the tracker first. It should have enough context to answer without
re-fetching from GitHub. The user-facing report (Step 5a) is a separate, concise summary.

**References:**

- `references/tracker-schema.md` — tracker file format
- `references/result-file-schema.md` — per-issue analysis format (agents write these)
- `references/gh-cli-patterns.md` — gh CLI command templates
- `tracker-template.md` — blank tracker for first run
</execution_context>

<flow>

The skill runs the same steps every time. The tracker determines depth — an empty
tracker means everything is new and needs deep analysis. A fresh tracker means most
issues just need a quick diff check.

## Step 0: Startup

1. Set `$TRACKER_PATH` to `$HOME/.e-stack/estack-github-issue-tracker/github-tracker.md`.
2. Run startup:
   ```bash
   node "$SKILL_DIR/bin/tracker-tools.cjs" startup --tracker "$TRACKER_PATH"
   ```
3. Store the full response as `$STARTUP`. The script handles auth checking and temp dir
   creation. If `auth` is false, show the user the `error` message from the output and STOP.
   If `search_errors` is non-empty, warn the user that some discovery queries failed —
   the results may be incomplete.
4. Extract `$TODAY` (the YYYY-MM-DD date) from the `$STARTUP.today` string — use this as today's date for everything.
5. Extract `$TEMP_DIR` from `$STARTUP.temp_dir`.
6. Extract `$CONFIG` from `$STARTUP.config`. This is the user's plain English config
   (excluded repos, preferences, etc.) parsed from the tracker's `## Config` section.
   If null, the tracker has no config yet — you'll ask the user in Step 1.
7. Read the tracker's `## Pending Actions` section into `$PENDING_ACTIONS` (read it
   directly from `$TRACKER_PATH` with the Read tool; if the section or file is absent,
   treat it as empty). Every unfinished `- [ ]` item is an action carried over from a
   prior run — Step 5a surfaces these as "Carried Over". This tracker section is the
   **authoritative cross-session action queue**: the tracker file is the only guaranteed
   cross-session store. Do **not** read carried-over actions from the harness task list
   (`TaskList`) — it is session-scoped and may be empty on a fresh CLI session.

---

## Step 1: Discover

**Goal:** Build the complete list of issues to analyze this run.

Sources (all from `$STARTUP`):

- `tracker_data.active_issues` — issues already tracked
- `new_issues` — open issues involving the user that aren't in the tracker yet
- `reopened_issues` — issues previously closed that are now open again
- `recently_closed` — issues closed since last check

**Check `$CONFIG` from startup.** If it contains directives (excluded repos, preferences),
apply them when filtering issues throughout this step. For example, if config says
"Excluded repos: ElliotDrel/*", skip any issues from repos owned by ElliotDrel.

If `$CONFIG` is null (tracker has no Config section), ask the user if they want to set
one up (which repos to track/exclude). The agent writes Config directly to the tracker
file via the Edit tool (not through the script). The script reads Config; the agent writes it.

**If tracker doesn't exist or has no issues** (first run):

- Show `new_issues` grouped by repo. List which repos were found.
- Ask: "Which repos do you want to track? You can also exclude any."
- Save their choices to the `## Config` section by writing directly to the tracker via Edit.
- Then ask which specific issues to track from the included repos.

**If tracker exists with issues:**

- Active issues are automatically included (unless excluded by config).
- If `new_issues` is non-empty and passes config filters, tell the user what was
  found and add them to the analysis list.
- If `reopened_issues` is non-empty, add them back to the active analysis list and
  note in your report that they were reopened (state changed from closed to open).
  The agent should manually move reopened issues from the Closed section back to
  Active in the tracker, preserving any context from the closed entry.

Write the final issue list to `$TEMP_DIR/issues-to-fetch.json` for the fetch command.
Each entry needs: `owner`, `repo`, `number`, `title`, `role`, `last_check_date`
(null for new issues), `known_dupes` (from tracker or empty), `upstream` (from tracker or null).

---

## Step 2: Connect

**Goal:** Fetch current data for every issue and find related/duplicate issues.

### 2a: Fetch all issue data

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" fetch-issues --temp-dir "$TEMP_DIR" --issues "$TEMP_DIR/issues-to-fetch.json"
```

This fetches metadata, body, comments, dupe states, upstream state, cross-references,
and URLs for every issue in parallel. One `raw-OWNER-REPO-NUMBER.json` per issue.

### 2b: Analyze issues in batches

Read `references/result-file-schema.md` and `references/gh-cli-patterns.md` from `$SKILL_DIR`.

Group issues into batches of ~5. Spawn **one Agent per batch**. Each agent:

1. Reads the raw JSON files for its batch issues.
2. Searches for duplicates/related issues using `gh api` search queries.
3. Writes one result file per issue to `$TEMP_DIR/issue-OWNER-REPO-NUMBER.md` following
   the format in `references/result-file-schema.md`.

**Depth control based on `last_check_date`:**

The duplicate/related search always runs, but the scope changes:

- **`null` (new issue):** Deep analysis. Read full comment history. Search broadly for
  duplicates by symptoms, error messages, and keywords.
- **Checked within the last 7 days:** Shallow pass. Only read new comments since last check.
  Only check the state of already-known duplicates/related issues. Only search for new
  duplicates among issues created since the last check date.
- **Checked more than 7 days ago:** Medium depth. Read comments since last check. Re-scan
  for new duplicates across a wider window. Check state of known duplicates.

**Reconcile tracker against the API — two categories:** For each issue, compare what the
tracker has against what the API returned. Sort every field into one of two buckets:

- **Always re-fetch and overwrite** (API-observable, high-churn — never trust the tracker
  for these): open/closed `state`, `labels`, `comment_count`, last-comment date,
  `mergeStateStatus`, `mergeable`, `reviewDecision`, CI status. A wrong-but-present value
  (e.g. a PR previously marked "approved") **must** be overwritten with the fresh API value,
  not preserved.
- **Fill only if missing** (human analysis, low-churn): Goal, root cause, Workaround, Key
  technical data, Role description. Populate these from the API/analysis only when the tracker
  entry has a blank — never clobber existing human-authored context.

Include both overwritten and newly populated fields in the result file's `## Tracker Updates`
section. Every run thus refreshes volatile facts and progressively fills analysis gaps.

**If the item is a PR** (raw JSON has a non-null `pr_health` block — see Step 2a), fetch the
PR-health template from `gh-cli-patterns.md` if `pr_health` is missing, and record merge state,
review decision, and CI status in `## Status Summary`, the `## PR Health` section, and
`## Next Steps`. Distinguish bot reviews (login ends in `[bot]`) from human reviews, and treat
`COMMENTED` ≠ `APPROVED` — a `COMMENTED` review is not an approval.

**Exception — fields that require user input:** The **Goal** field must be asked, not
guessed. If an issue is missing a Goal, flag it in the result file so Step 5d can
collect them. Same for Config — never assume repo exclusions or preferences, always ask.

Each agent prompt must include:

- Raw data file paths for its batch
- The existing tracker entry data for each issue (so the agent can identify gaps)
- `owner`, `repo`, `number`, `title`, `role`, `last_check_date`, `username`
- `cross_references` and `urls` from raw JSON
- All tracked issue numbers (to filter dupe search results)
- `$TODAY` as today's date (for history entries)
- Instruction to read `$SKILL_DIR/references/result-file-schema.md` for format and quality guidance

**Subagent return convention.** Each agent's analysis is persisted by `update-tracker`
(Step 3) reading the result files — agents do **not** call `append-history` themselves.
But if an agent takes a tracker-relevant action directly (rare in 2b), it must end its
reply with one line per action so the orchestrator can persist it incrementally:

```
TRACKER_UPDATE: owner/repo#NUMBER | YYYY-MM-DD | <one-line description>
```

On receipt, the orchestrator calls `append-history` once per `TRACKER_UPDATE:` line
(`--issue owner/repo#NUMBER --date YYYY-MM-DD --desc "<description>"`) before continuing.

After all agents finish, verify file count:

```bash
ls "$TEMP_DIR"/issue-*.md 2>/dev/null | wc -l
```

---

## Step 3: Save

**Goal:** Immediately persist all factual data from the analysis to the tracker.

This step is **mandatory and automatic** — no user permission needed. The analysis just
finished and the result files contain factual data from the GitHub API. This step caches
that data in the tracker so that even if the conversation is interrupted after this point,
the tracker has the latest information.

**If this is the first run** (no tracker existed):

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" build-tracker --temp-dir "$TEMP_DIR" --template "$SKILL_DIR/tracker-template.md" --username "$USERNAME" --tracker "$TRACKER_PATH" --date "$TODAY"
```

**If the tracker already exists:**

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" update-tracker --tracker "$TRACKER_PATH" --temp-dir "$TEMP_DIR" --date "$TODAY"
```

This saves: status dates, new comments, new duplicates, filled data gaps, state changes.

**Every tracker update must be logged in History.** Every change the script makes to the
tracker — new fields populated, status updates, new duplicates found — gets a history
entry on the affected issue. The History section is an append-only audit trail. Examples:
- `**2026-04-06:** Check-in: no new activity`
- `**2026-04-06:** Filled in missing Workaround and Key technical data fields`
- `**2026-04-06:** Found new duplicate #45123`
- `**2026-04-06:** Status changed: open → closed`

---

## Step 4: Advise

**Goal:** Identify concrete next steps for each issue before presenting the report.

Read through all result files in `$TEMP_DIR/issue-*.md`. For each issue, use the
**Goal** field from the tracker (e.g., "Get my fix merged", "Get maintainer to respond",
"Monitor for upstream fix") to tailor recommendations. The goal tells you what success
looks like — next steps should move toward that outcome.

For each issue, determine:

- Given the user's goal, what action would move this issue forward?
- Are there related issues where commenting with a link to the user's issue would help?
- Are there duplicates the user should reference or link to?
- Is there a PR fixing the issue that needs testing or review?

Collect all next steps. These get included in the report output.

---

## Step 5: Report and Act

**Goal:** Show the user what's going on and help them take action.

### 5a: Report

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" compile-report --temp-dir "$TEMP_DIR" --date "$TODAY"
```

The script outputs the report text to stdout and metadata (including `today`) to stderr.
Use the stdout output as raw data, but present the report to the user in YOUR response
using the format below.

**Carried Over (from `$PENDING_ACTIONS`).** If `$PENDING_ACTIONS` (read at Step 0) has
any unfinished `- [ ]` items, **prepend** a `## Carried Over` section to the report
listing them verbatim — these are actions queued in a prior run that were never executed
or completed. Omit the section entirely when there are no unfinished items. This list
comes from the tracker's `## Pending Actions` section, never from the harness task list.

**Report format — keep it tight and actionable:**

The user wants to know three things: what changed, what's the update, what do I do.
Skip GitHub spam (bot comments, auto-close noise, label changes). Use bullets, not tables.

```
# Check-In — {date}

## Carried Over
- unfinished `- [ ]` action from a prior run (omit this whole section if there are none)

## What Changed
- bullet per issue that had real activity (new human comments, state changes, PRs)
- if nothing changed, say "No new activity across N tracked issues."

## New Issues Found
- bullet per newly discovered issue (if any, after config filtering)

## Recommended Actions
### Do Today
- specific action items the user should take right now
### Watch For
- things that might need attention soon but not today
### No Action Needed
- brief grouped summary of issues that are just waiting (e.g., "15 google-tools-mcp issues — no maintainer response")
```

Do NOT list every single issue with its full status. Only mention issues where
something happened or something needs to happen. Group quiet issues into one line.

### 5b: Persist actions to the queue

The `## Pending Actions` section of the tracker is the **authoritative, cross-session
action queue** — the source of truth. Write **every** "Do Today" item from the 5a report
into it, one line each, using the Edit tool:

```
- [ ] <action> (from <issue-ref>, <date>)
```

Use `$TODAY` for `<date>` and the `owner/repo#NUMBER` form for `<issue-ref>`. If the
`## Pending Actions` section does not exist yet, create it (see
`references/tracker-schema.md` for placement and format). Carried-over `- [ ]` items
from prior runs that are still relevant stay in place — do not duplicate them.

**Optional within-session mirror.** You may mirror these items to the harness task list
(`TaskCreate`) for within-session focus, but it is a convenience only — never the source
of truth. The harness task list is session-scoped and may be empty on a fresh CLI
session, so "Carried Over" (Step 5a) and the queue itself always read from the tracker
section, never from `TaskList`.

### 5c: Execute approved actions

Present the queued items to the user and ask whether to act on them (e.g. "Want me to
act on these? I'll do all of them." or per-item). If the user declines, leave the items
as `- [ ]` in the queue — they carry over to the next run. If the user approves (a
blanket "do all of them" approves the whole batch), run the execution framework below
against the 5b queue.

1. **Mark before acting.** Flip the queue item you're about to work on to in-progress
   (note it inline, e.g. `- [~]`, or mark the mirrored harness task `in_progress` if you
   created one). Do this before any work starts so an interruption leaves a clear trail.

2. **Parallel subagents — one per approved action.** Spawn one Agent per approved queue
   item so independent actions run concurrently.

3. **Action-type routing table.** Route each action by type:

   | Action | Execution |
   |---|---|
   | Post comment / tag maintainer | `gh pr comment` / `gh issue comment` directly — no clone |
   | Rebase a PR branch | clone fork → temp dir → add upstream remote → rebase → force-push → `rm -rf` |
   | Fix PR review blockers | clone branch → temp dir → make change → push → re-request review → `rm -rf` |
   | Watch / monitor | no action; note it in the report |

4. **Temp-dir-only for git.** Any `git clone` goes into a fresh `mktemp -d` directory;
   do the work there and `rm -rf` it when done. **Never** clone into the user's working
   directory.

5. **Force-push auth.** A blanket "do all of them" approval authorizes force-pushing the
   rebased PR branches in this batch. Do **not** re-ask for permission per branch.

6. **Subagent model.** Follow the global subagent cascade (one tier below the
   orchestrator). For complex code-fixing tasks (unfamiliar repo plus test infrastructure),
   floor the model at Sonnet even if the cascade would otherwise pick Haiku.

7. **Report back + persist immediately.** Each agent returns what it did: conflicts
   resolved, push/comment success, and any blockers. As **each** action completes,
   **immediately** record it with `append-history` for that issue — do not batch, do not
   wait until the end of the session, and do not use `Edit` for history (`append-history`
   is atomic and dedup'd; this is the same incremental-persistence invariant the rest of
   the skill follows):

   ```bash
   node "$SKILL_DIR/bin/tracker-tools.cjs" append-history \
     --tracker "$TRACKER_PATH" --issue OWNER/REPO#NUMBER \
     --date "$TODAY" --desc "description of the action"
   ```

   Re-running the same entry is a safe no-op (it dedups). If the command exits non-zero
   because the issue section is not found, the tracker is left unchanged — surface the
   error, fix the issue key, and retry; do not fall back to `Edit`.

   Then flip the queue item in `## Pending Actions` from `- [ ]` (or `- [~]`) to
   `- [x] <action> (<date>)` via the Edit tool, and mark the mirrored harness task
   complete if you created one. **Prune** any `- [x]` items whose date is more than 7 days
   old from the section.

   If a subagent reports actions via `TRACKER_UPDATE:` lines (see Step 2b and
   `references/result-file-schema.md`), call `append-history` once per line as soon as you
   receive them — one line maps to one `--issue` / `--date` / `--desc` invocation.

**Tracker-relevant action set** (each one triggers an immediate `append-history`):

- Comment posted (`gh issue comment` / `gh pr comment`)
- Issue or PR linked/cross-referenced from another issue
- Goal set or changed for an issue
- State change applied or observed (open → closed, reopened, etc.)
- PR filed, pushed, or rebased for an issue
- Config change written to the tracker

Examples of the `--desc` text:
- `Posted comment on #1234 linking to duplicate #5678`
- `Rebased PR branch onto upstream/main and force-pushed`
- `Goal set: "Get maintainer to respond"`
- `Added Config section to tracker (excluded: ElliotDrel/*)`

### 5d: Collect missing Goals

If result files flagged issues without a Goal, present them to the user grouped by repo
and ask what their intent is for each. Example: "These issues don't have a goal set
yet — what are you hoping for with each?"

Once the user provides goals, write them directly to the tracker file via the Edit tool
(not through the script). Log the *action* with `append-history` (not `Edit`) for each
goal set — the field value goes in via `Edit`, the history entry via `append-history`:
- `**2026-04-06:** Goal set: "Get maintainer to respond"`

### 5e: Cleanup

```bash
rm -rf "$TEMP_DIR"
```

</flow>

<context>
$ARGUMENTS
</context>

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-github-issue-tracker: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-github-issue-tracker: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
