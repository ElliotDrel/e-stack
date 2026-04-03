# First-Time Setup: GitHub Issue Tracker

Run this workflow when no tracker file exists. Creates a tracker from scratch by
using startup data and parallel API fetches.

**Prerequisites loaded by router:** `$STARTUP` (JSON from `startup` command with
auth confirmed, username known, new_issues populated), `$SKILL_DIR` (skill directory
path), `$TRACKER_PATH` (tracker file path, will be created).

Uses `fetch-issues` for parallel API data fetching and batched analysis agents
for deep-dive reviews.

---

<step name="use_startup_data" priority="first">

## Step 1: Use Startup Data

Auth already confirmed by router (`$STARTUP.auth` is true).
Username already known: `$STARTUP.username`. No need to ask user.

Discovery already done:
- `$STARTUP.new_issues` contains all open issues involving user
- `$STARTUP.recently_closed` contains recently closed issues

Create a temp directory for results:
```bash
TEMP_DIR=$(node "$SKILL_DIR/bin/tracker-tools.cjs" init-temp)
echo "Temp dir: $TEMP_DIR"
```

**acceptance_criteria:** `$STARTUP` data available, `$TEMP_DIR` created.

</step>

<step name="present_and_select">

## Step 2: Present Findings and Select

Show `$STARTUP.new_issues` grouped by repo.

**For >10 issues**, use summary-based confirmation:
Show a summary table (`repo | count | sample titles`) instead of the full list. Ask:
"Found N issues across M repos. Track all, or review the full list?"
Options:
- "All of them"
- "Show full list first"
- "Let me pick specific ones"
- "None"

**For <=10 issues**, show the full list:
```
Found N open issues involving @USERNAME:

### repo-owner/repo-name
- #123 — Title [role: author] [updated: 2026-03-30]
- #456 — Title [role: commenter] [updated: 2026-03-28]
```

Then ask via AskUserQuestion:
- header: "Track which?"
- question: "Which issues do you want to track? Select an option or type specific numbers."
- options:
  - "All of them"
  - "Let me pick specific ones"
  - "None — I'll add manually later"

For recently closed issues (`$STARTUP.recently_closed`):
- Ask if any should go in the Closed section.
- Auto-include recommendation: if a closed issue references an active issue in its body
  or comments (based on startup data), recommend including it.

**acceptance_criteria:** User has selected which issues to track.

</step>

<step name="fetch_data">

## Step 3: Fetch Issue Data via Script

Write selected issues to `$TEMP_DIR/issues-to-fetch.json` in the format expected by
`fetch-issues`: array of objects with `owner`, `repo`, `number`, `title`, `role`,
`last_check_date` (set to `null` for setup — fetch-issues will fetch all comments),
`known_dupes` (empty array), `upstream` (null).

Run:
```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" fetch-issues --temp-dir "$TEMP_DIR" --issues "$TEMP_DIR/issues-to-fetch.json"
```

Verify the fetch output: check that `fetched` count matches selected issue count.

**acceptance_criteria:** Raw data files exist in `$TEMP_DIR` for all selected issues.

</step>

<step name="batched_analysis">

## Step 4: Batched Analysis Agents

Group selected issues into batches of ~5 issues each.

Spawn **ONE Agent per batch**. Each agent's prompt MUST include:

1. The list of raw data file paths for its batch:
   `$TEMP_DIR/raw-OWNER-REPO-NUMBER.json` for each issue in the batch.
2. Explicit instruction: **"Use the Read tool to read each file listed below."**
3. The result file schema — read `$SKILL_DIR/references/result-file-schema.md` and include
   it in the prompt OR instruct the agent to read it.
4. For each issue: owner, repo, number, title, role, username.
5. The `cross_references` and `urls` arrays from each raw JSON — instruct the agent to use
   these to populate ## Cross-References and ## External Links sections.
6. Instruction to search for NEW duplicates for ALL issues in the batch (not just authored).
   Search by SYMPTOMS and ERROR MESSAGES, not just title keywords.
7. For duplicates/adjacent: explain whether shared ROOT CAUSE or just SYMPTOMS.
8. **MANDATORY:** Write one result file per issue to `$TEMP_DIR/issue-OWNER-REPO-NUMBER.md`
   using the standardized format from `references/result-file-schema.md`.
   Set `state_changed: false` and `has_activity: false` (this is initial setup).
   Set `last_check_date: null`.

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

Wait for all agents. Verify file count matches selected issue count:
```bash
ls "$TEMP_DIR"/issue-*.md | wc -l
```

**acceptance_criteria:** One `issue-*.md` per selected issue in `$TEMP_DIR`.

</step>

<step name="build_tracker" priority="must-execute">

## Step 5: Build Tracker via Script

**MANDATORY — DO NOT SKIP THIS STEP.**

Run build-tracker:
```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" build-tracker --temp-dir "$TEMP_DIR" --template "$SKILL_DIR/tracker-template.md" --username "$STARTUP_USERNAME" --tracker "$TRACKER_PATH"
```

If user selected closed issues, write them to `$TEMP_DIR/closed-issues.json` and pass
`--closed-json "$TEMP_DIR/closed-issues.json"`.

**acceptance_criteria:** Tracker file written to `$TRACKER_PATH`.

</step>

<step name="summary_confirmation">

## Step 6: Summary Confirmation

**For >10 issues:** Show a summary of the tracker (issue count, repos covered, key findings)
rather than the full file content. Ask user to confirm or review full file.

**For <=10 issues:** Show full tracker content for confirmation (same as before).

Use AskUserQuestion:
- header: "Tracker ready"
- question: "Tracker created with N issues. Looks good?"
- options:
  - "Looks good"
  - "Show full file"
  - "Let me edit it"

**acceptance_criteria:** User has confirmed tracker content.

</step>

<step name="compile_report">

## Step 7: Run Compile Report

Instead of routing back to check-in workflow, run compile-report directly:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" compile-report --temp-dir "$TEMP_DIR" --date "$(date +%Y-%m-%d)"
```

**Show the FULL report output to the user as text in your response.** Do not summarize,
truncate, or paraphrase. The user cannot see bash command output — they can only see
text you write in your response. You MUST copy the full report content into your message.

This gives them an immediate overview without running a full check-in cycle
(which would re-fetch everything that was just fetched).

**acceptance_criteria:** Full report text shown in assistant response (not just in bash output). User can read the complete report without expanding anything.

</step>

<step name="cleanup" priority="last">

## Step 8: Cleanup

Clean up the temp directory:
```bash
rm -rf "$TEMP_DIR"
```

Tell user: "Tracker created with N issues. Use `/github-issues-update` for future check-ins."

**acceptance_criteria:** Temp directory removed. User informed of next steps.

</step>
