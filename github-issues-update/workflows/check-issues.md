# Check-In Workflow

Main workflow for `/github-issues-update`. Executed when tracker file exists.

**Prerequisites loaded by router:** `$STARTUP` (JSON from `startup` command containing
auth, username, tracker_data, new_issues, reopened_issues, recently_closed),
`$SKILL_DIR` (skill directory path), `$TRACKER_PATH` (tracker file path).

Read `references/gh-cli-patterns.md` and `references/tracker-schema.md` before starting.

Uses `fetch-issues` for parallel API data fetching, batched analysis agents (~5 issues
per agent), cross-issue synthesis, verification agent, and a completion checklist.

---

<step name="init_and_fetch" priority="first">

## Step 1: Initialize and Prepare Fetch

Create the temp directory for results:

```bash
TEMP_DIR=$(node "$SKILL_DIR/bin/tracker-tools.cjs" init-temp)
echo "Temp dir: $TEMP_DIR"
```

Store `$TEMP_DIR` for all subsequent steps.

Extract from `$STARTUP`:
- `username` — GitHub username
- `tracker_data.active_issues` — array of active issue objects (last_check_dates already defaulted)
- `tracker_data.all_tracked_numbers` — list of all tracked issue keys (owner/repo#N)
- `new_issues` — open issues involving user NOT in tracker
- `reopened_issues` — closed issues that are now open
- `recently_closed` — recently closed issues involving user

Write the issues JSON file for `fetch-issues`:
Build a JSON array of all active issues with fields: `owner`, `repo`, `number`, `title`,
`role`, `last_check_date`, `known_dupes` (from duplicates + adjacent fields), `upstream`.
Write to `$TEMP_DIR/issues-to-fetch.json`.

**acceptance_criteria:** `$TEMP_DIR` exists and `issues-to-fetch.json` written with all active issues.

</step>

<step name="fetch_data">

## Step 2: Fetch Issue Data via Script

Run the `fetch-issues` command to fetch all API data in parallel:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" fetch-issues --temp-dir "$TEMP_DIR" --issues "$TEMP_DIR/issues-to-fetch.json"
```

This replaces ALL per-agent gh api calls. The script handles parallelism (max 15 concurrent),
writes one `raw-OWNER-REPO-NUMBER.json` file per issue containing metadata, body, comments,
dupe states, upstream state, cross_references, and urls.

Verify the fetch output: check that `fetched` count matches expected and `errors` is empty.

**acceptance_criteria:** Raw data files exist in `$TEMP_DIR` for all active issues.

</step>

<step name="batched_analysis">

## Step 3: Batched Analysis Agents

Group active issues into batches of ~5 issues each.

Spawn **ONE Agent per batch** (not one per issue). Each agent's prompt MUST include:

1. The list of raw data file paths for its batch:
   `$TEMP_DIR/raw-OWNER-REPO-NUMBER.json` for each issue in the batch.
2. Explicit instruction: **"Use the Read tool to read each file listed below."**
3. The result file schema — read `$SKILL_DIR/references/result-file-schema.md` and include
   it in the prompt OR instruct the agent to read it.
4. For each issue in the batch: owner, repo, number, title, role, last_check_date, username,
   all_tracked_numbers (for filtering duplicate search results).
5. The `cross_references` and `urls` arrays from each raw JSON — instruct the agent to use
   these to populate ## Cross-References and ## External Links sections.
6. Instruction to search for NEW duplicates for ALL issues in the batch (not just authored).
   Search by SYMPTOMS and ERROR MESSAGES, not just title keywords.
   Run keyword searches per issue.
7. Auto-include instruction: If a recently_closed issue from `$STARTUP.recently_closed` is
   obviously related to an active issue (same topic, same repo, referenced in comments),
   note it in the Duplicates section.
8. For duplicates/adjacent: explain whether shared ROOT CAUSE or just SYMPTOMS.
9. **MANDATORY:** Write one result file per issue to `$TEMP_DIR/issue-OWNER-REPO-NUMBER.md`
   using the standardized format from `references/result-file-schema.md`.

Include these QUALITY EXAMPLES directly in each agent prompt:

```
QUALITY REQUIREMENTS — read these before writing any result file:

Role description:
  BAD:  "Author"
  GOOD: "Author (filed with 3 crash instances, upstream tracking in bun#28175)"

What to check:
  BAD:  "Monitor for maintainer engagement"
  GOOD: "PRs modifying `renameSession` or `custom-title` handling; JSONL title write logic changes"

Workarounds:
  BAD:  "Use different server names"
  GOOD: "Name servers differently (`slack-buildpurdue`, `slack-keel`) at user scope via `claude mcp add-json`"

Duplicate reasoning:
  BAD:  "#40693 — related rename issue"
  GOOD: "#40693 — VS Code UI blocking during rename. Shares symptoms but different root cause:
         UI thread vs JSONL write. Adjacent, not duplicate."

Key technical data:
  BAD:  "Memory leak reported"
  GOOD: "@kolkov's mimalloc analysis: ~1GB/h growth, traced to arena retention in bun's GC cycle"

Next steps:
  BAD:  "Follow up"
  GOOD: "Post memory profiling data from session replay showing 1.2GB peak at 45min mark"
```

Wait for all agents. Verify file count matches active_issues count:
```bash
ls "$TEMP_DIR"/issue-*.md | wc -l
```

If any result files are missing, report which agents failed and re-run failed agents.

**acceptance_criteria:** One `issue-*.md` per active issue in `$TEMP_DIR`, all following result-file-schema format.

</step>

<step name="synthesis">

## Step 4: Cross-Issue Synthesis

Spawn **ONE Agent** that reads ALL result files from `$TEMP_DIR/issue-*.md`.

Agent prompt:

> Use the Read tool to read each of these files: [list all issue-*.md paths].
>
> Then analyze across all issues for:
> 1. **Clusters** — issues that are related or affect the same area
> 2. **Contradictions** — conflicting information across issues
> 3. **Gaps** — issues missing data or with stale information
> 4. **Priority signals** — which issues need attention most urgently
> 5. **Untracked cross-references** — check if any issue numbers found in
>    ## Cross-References sections point to issues NOT in the tracker
>    (compare against `$STARTUP.tracker_data.all_tracked_numbers`).
>    List them as potential tracking candidates.
>
> Write your synthesis to `$TEMP_DIR/synthesis.md` with sections for each of the above.

**acceptance_criteria:** `$TEMP_DIR/synthesis.md` exists with cross-issue analysis.

</step>

<step name="compile_report" priority="must-execute">

## Step 5: Compile and Present Report

**MANDATORY — DO NOT SKIP THIS STEP.**
This is the primary output of the check-in. Proceeding to actions or tracker updates
without showing the overview to the user is a workflow violation.

Run the compile-report script:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" compile-report --temp-dir "$TEMP_DIR" --date "$(date +%Y-%m-%d)"
```

The script reads all result files from `$TEMP_DIR`, compiles the overview report, and
outputs it to stdout. It also writes it to `$TEMP_DIR/_compiled-report.md`.

After compile-report runs, read `$TEMP_DIR/synthesis.md` if it exists and append a
**"### Cross-Issue Analysis"** section to the report output.

Also include `new_issues` and `reopened_issues` from `$STARTUP` in the report:
- Format new_issues as a table: `| Issue | Repo | Recommendation |`
- Format reopened_issues as a list.

These are sourced directly from the startup command output.

**Show the FULL report output to the user.** Do not summarize, truncate, or paraphrase.

**acceptance_criteria:** Report shown to user containing "GitHub Issues Check-In" header.
`$TEMP_DIR/_compiled-report.md` exists. New issues and reopened issues surfaced.

</step>

<step name="verification">

## Step 6: Verification Agent

Spawn **ONE Agent** after report compilation.

Agent prompt:

> Use the Read tool to read the compiled report at `$TEMP_DIR/_compiled-report.md`.
> Then read each issue result file in `$TEMP_DIR/issue-*.md`.
>
> Verify:
> 1. Every active issue has a corresponding section in the report.
> 2. No data was lost — key findings from result files appear in the report.
> 3. All new_issues and reopened_issues are mentioned.
> 4. **QUALITY CHECK** — flag any of these shallow-output patterns:
>    - 'What to check' that only says 'Monitor for maintainer' or similar generic phrase
>    - Missing '## Key Technical Data' section or section that says only 'N/A'
>    - Role field that is a single word ('Author', 'Commenter') without contribution description
>    - Duplicate listed without WHY reasoning (root cause vs symptoms)
>    - 'Next steps' that says only 'Follow up' or 'Monitor' without specifics
>    - Missing '## External Links' section when the issue body/comments clearly contain URLs
>    - Workarounds described generically instead of with exact commands
>
> Write verification result to `$TEMP_DIR/verification.md` with: pass/fail, data gaps,
> and a 'Quality Flags' section listing any shallow-output issues found.

If verification finds gaps OR quality flags, warn the user before presenting the report.

**acceptance_criteria:** `$TEMP_DIR/verification.md` exists. Quality issues flagged if present.

</step>

<step name="confirm_actions">

## Step 7: Confirm and Execute Actions

**If there are "Next steps" items in the report:**

Use AskUserQuestion:
- header: "Execute?"
- question: "Found N actions to take. How should we proceed?"
- options:
  - "Draft comments for my review, then post after approval"
  - "Show me the list, I'll pick which ones"
  - "Skip — no actions this time"

If the user wants drafts:
1. Draft ALL comments. For each draft, include:
   - Target issue number and title
   - The full comment text
   - Why we're posting it (context)
2. Present all drafts together in a numbered list.
3. Wait for approval. The user may:
   - Approve all ("send" / "go" / "approved")
   - Request edits to specific drafts ("change #3 to ...")
   - Remove specific drafts ("skip #2")
4. After final approval, post ALL approved comments in parallel via `gh issue comment`.
5. Report back with a link table:

```
| Issue | Comment Link |
|-------|-------------|
| #NUMBER | [link](url) |
```

**Before drafting any comment about a duplicate/related issue:**
- Read the target issue's FULL body first (not just the title)
- Verify your claims are accurate — don't misattribute root causes
- Match the tone of the target repo's community

**acceptance_criteria:** Actions either executed with confirmation or explicitly skipped by user.

</step>

<step name="update_tracker">

## Step 8: Update Tracker

Use AskUserQuestion:
- header: "Update file?"
- question: "Want me to update the tracker file with today's findings?"
- options:
  - "Yes, update it"
  - "No, leave it as-is"

If confirmed, run the update-tracker script:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" update-tracker --tracker "$TRACKER_PATH" --temp-dir "$TEMP_DIR" --date "$(date +%Y-%m-%d)"
```

The script returns JSON with `updated` (bool) and `changes` (array of descriptions).

Report what changed to the user.

**acceptance_criteria:** Tracker either updated (with changes reported) or explicitly skipped by user.

</step>

<step name="completion_checklist" priority="last">

## Step 9: Completion Checklist

Run validation:
```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" validate --temp-dir "$TEMP_DIR" --tracker "$TRACKER_PATH" --expected ACTIVE_ISSUE_COUNT --date "$(date +%Y-%m-%d)"
```

Then check each item:

```
## Completion Checklist
- [ ] All N active issues analyzed (result files exist)
- [ ] Cross-issue synthesis completed
- [ ] Report compiled and shown to user
- [ ] Verification agent confirmed no data loss
- [ ] New issues (N) and reopened issues (N) surfaced to user
- [ ] User confirmed/skipped actions
- [ ] Tracker updated/skipped
- [ ] Temp directory cleaned up
```

If any item is unchecked, report it to the user before cleanup.

Clean up the temp directory:
```bash
rm -rf "$TEMP_DIR"
```

**acceptance_criteria:** All checklist items checked or reported. Temp directory removed.

</step>
