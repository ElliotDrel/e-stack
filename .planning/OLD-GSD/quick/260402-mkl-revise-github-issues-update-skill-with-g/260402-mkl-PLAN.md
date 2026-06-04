---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - github-issues-update/bin/tracker-tools.cjs
  - github-issues-update/SKILL.md
  - github-issues-update/workflows/check-issues.md
  - github-issues-update/workflows/save-issues.md
  - github-issues-update/setup.md
  - github-issues-update/references/result-file-schema.md
autonomous: true
requirements: [all]
must_haves:
  truths:
    - "startup command returns auth, username, tracker data, new/reopened/recently-closed issues in one call"
    - "fetch-issues command runs all gh api calls in parallel via Node child_process and writes per-issue files to temp dir"
    - "build-tracker command reads temp dir result files + template and writes complete tracker to disk"
    - "SKILL.md router uses single startup call instead of resolve_paths + parse-tracker"
    - "check-issues workflow uses fetch-issues for data, batched analysis agents, synthesis step, completion checklist, no general check subagent"
    - "setup workflow uses startup data, fetch-issues, batched agents, build-tracker, runs compile-report at end"
    - "save-issues workflow uses startup data"
    - "Standardized result file format works for both setup deep-dives and check-in reviews"
    - "null last_check_date defaults to 30 days ago in startup output"
    - "Duplicate search runs for all issues not just authored"
    - "Auto-include obviously related closed issues"
    - "Summary-based confirmation for >10 issues in setup"
    - "Result file schema has GOOD vs BAD examples for role, what-to-check, workarounds, dupes, key data, next steps"
    - "Analysis agent prompts include QUALITY EXAMPLES block in both check-issues and setup"
    - "Verification agent checks for shallow-output patterns (generic language, missing sections)"
    - "fetch-issues extracts cross_references and urls from body/comments into raw JSON"
    - "Synthesis agent checks for untracked cross-references"
  artifacts:
    - path: "github-issues-update/bin/tracker-tools.cjs"
      provides: "startup, fetch-issues, build-tracker commands"
    - path: "github-issues-update/SKILL.md"
      provides: "Router using startup command"
    - path: "github-issues-update/workflows/check-issues.md"
      provides: "Revised check-in with batched agents, synthesis, checklist"
    - path: "github-issues-update/workflows/save-issues.md"
      provides: "Save workflow using startup data"
    - path: "github-issues-update/setup.md"
      provides: "Setup using startup, fetch-issues, build-tracker"
    - path: "github-issues-update/references/result-file-schema.md"
      provides: "Standardized result file format definition"
  key_links:
    - from: "SKILL.md"
      to: "tracker-tools.cjs startup"
      via: "node invocation"
      pattern: "tracker-tools.cjs.*startup"
    - from: "check-issues.md"
      to: "tracker-tools.cjs fetch-issues"
      via: "node invocation"
      pattern: "tracker-tools.cjs.*fetch-issues"
    - from: "setup.md"
      to: "tracker-tools.cjs build-tracker"
      via: "node invocation"
      pattern: "tracker-tools.cjs.*build-tracker"
---

<objective>
Revise the github-issues-update skill to consolidate script commands, standardize file formats,
improve agent orchestration (batched analysis, synthesis, verification), and streamline all
workflows to use a single `startup` entry point.

Purpose: Reduce API call count, eliminate redundant subagents, improve data quality through
batched analysis and cross-issue synthesis, and make all workflows more reliable.

Output: Updated tracker-tools.cjs with 3 new commands, revised SKILL.md router, revised
check-issues/setup/save-issues workflows, new result file schema reference.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@github-issues-update/bin/tracker-tools.cjs
@github-issues-update/SKILL.md
@github-issues-update/workflows/check-issues.md
@github-issues-update/workflows/save-issues.md
@github-issues-update/setup.md
@github-issues-update/references/tracker-schema.md
@github-issues-update/references/gh-cli-patterns.md
@github-issues-update/tracker-template.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Define standardized result file format</name>
  <files>github-issues-update/references/result-file-schema.md</files>
  <action>
Create a new reference file that defines ONE result file format (with frontmatter) that works
for BOTH setup deep-dives and check-in reviews. This is the contract that fetch-issues writes
and that compile-report / build-tracker both consume.

The format must include:

**Frontmatter fields:**
- type (always "issue"), owner, repo, number, title, state, state_changed
  (bool, false for setup), labels, has_activity (bool, false for setup), role, filed,
  last_check_date (null for setup), last_commenter, last_comment_date, comment_count

**Role field guidance (CRITICAL for quality):**
The role field MUST describe what the user DID, not just a label.
Include GOOD vs BAD examples directly in the schema:
  BAD:  "Author"
  GOOD: "Author (filed with 3 crash instances, upstream tracking in bun#28175, posted workaround)"
  BAD:  "Commenter"
  GOOD: "Commenter (confirmed bug + posted workaround with exact `callbackPort: 3118` fix)"

**Body sections (all REQUIRED unless marked optional):**
- ## Status Summary — 2-3 sentences with specific technical details, not generic descriptions
- ## Key Technical Data (REQUIRED, not optional) — Concrete data points from body/comments:
  error codes, memory addresses, API parameters, config paths, version numbers, stack traces,
  test counts, file lists. This section should contain the raw facts someone would need to
  discuss this issue knowledgeably. Include verbatim error messages and exact commands.
- ## External Links (REQUIRED) — All URLs found in body/comments: fork repos, PR links,
  workaround documentation, tool links, upstream references. If none found, say "None found."
- ## Activity (new comments or "Initial review" for setup)
- ## Duplicates and Related (### Known — updates, ### New finds) — For EACH duplicate or
  related issue, explain whether it shares a ROOT CAUSE or just SYMPTOMS. Use labels:
  "duplicate" (same root cause), "adjacent" (related area, different problem).
  Include GOOD vs BAD examples:
    BAD:  "#40693 — related rename issue"
    GOOD: "#40693 — VS Code UI blocking during rename. Shares symptoms (rename fails) but
           root cause is different: UI thread blocking vs JSONL write. Adjacent, not duplicate."
- ## Competing PRs (if applicable) — When multiple PRs exist for the same issue, compare
  approaches: which supersedes, what semantic differences exist, downstream effects.
- ## Upstream — upstream dependency status or "N/A"
- ## Cross-References — ALL issue numbers mentioned in body and comments (even if not tracked).
  These may reveal related issues not yet in the tracker.
- ## Next Steps — MUST be specific, not generic.
    BAD:  "Monitor for maintainer engagement"
    GOOD: "Respond to @maintainer's request for memory profiling data from session replay"
- ## Watch For — MUST name specific signals.
    BAD:  "Watch for updates"
    GOOD: "PRs modifying `renameSession` or `custom-title` handling; JSONL title write logic changes"
- ## Tracker Updates (with status_summary, what_to_check, new_duplicate lines)
- ## Key Context — workarounds (EXACT commands, not paraphrases), severity signals, competing PRs.
    BAD:  "Use different server names"
    GOOD: "Name servers differently (`slack-buildpurdue`, `slack-keel`) at user scope via `claude mcp add-json`"

Note at top: "This format is consumed by both `compile-report` and `build-tracker` commands.
Agent analysis writes this format to temp dir. The script commands read it."

Document which fields are required vs optional, and which are setup-only vs check-in-only
(mark with "(setup)" or "(check-in)" or "(both)").
  </action>
  <verify>
    <automated>test -f github-issues-update/references/result-file-schema.md && echo "OK"</automated>
  </verify>
  <done>Result file schema reference exists with unified format documented for both workflows.</done>
</task>

<task type="auto">
  <name>Task 2: Add startup, fetch-issues, and build-tracker commands to tracker-tools.cjs</name>
  <files>github-issues-update/bin/tracker-tools.cjs</files>
  <action>
Add three new commands to tracker-tools.cjs. All use Node child_process (execSync or
spawn) for gh CLI calls. Keep zero external dependencies.

**Command 1: `startup`**
Usage: `tracker-tools.cjs startup --tracker <path>`
Steps:
1. Run `gh auth status` via child_process.execSync. Parse output for username (line containing
   "Logged in to github.com account USERNAME"). If auth fails, return `{ script_ok: true, auth: false }`.
2. Parse tracker file (reuse existing parseTrackerFile). If file doesn't exist, return
   `{ script_ok: true, auth: true, username, tracker_exists: false }`.
3. Run TWO `gh api` search queries via child_process (in parallel using Promise + exec):
   - `search/issues?q=involves:USERNAME+is:open+updated:>LAST_CHECK_DATE&per_page=100`
   - `search/issues?q=involves:USERNAME+is:closed+closed:>THIRTY_DAYS_AGO&per_page=50`
   Where LAST_CHECK_DATE = tracker's oldest_check_date (or 30 days ago if null).
   THIRTY_DAYS_AGO = 30 days before today.
4. Compare results against all_tracked_numbers. Identify:
   - new_issues: open issues involving user that are NOT in tracker
   - reopened_issues: issues in closed section that are now open
   - recently_closed: closed issues involving user (for reference)
5. For each issue in active_issues, default last_check_date to 30 days ago if null.
6. Return JSON: `{ script_ok, auth, username, tracker_exists, tracker_path, tracker_data
   (full parsed tracker with defaulted dates), new_issues, reopened_issues, recently_closed }`

For the parallel gh calls, use a helper that spawns child processes:
```javascript
const { execSync } = require('child_process');
// For parallel, use Promise.all with exec (callback-based) wrapped in promises
const { exec } = require('child_process');
function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err); else resolve(stdout);
    });
  });
}
```
Since startup needs async, make cmdStartup an async function. Update the CLI router to handle
async commands: wrap the command call in a Promise check —
`const result = commands[command](flags); if (result instanceof Promise) result.catch(...)`.

**Command 2: `fetch-issues`**
Usage: `tracker-tools.cjs fetch-issues --temp-dir <dir> --issues <json-file>`
Where --issues points to a JSON file containing an array of issue objects, each with:
`{ owner, repo, number, title, role, last_check_date, known_dupes, upstream }`.
The caller (agent) writes this JSON file before invoking.

Steps:
1. Read the issues JSON file.
2. For EACH issue, run these gh api calls in parallel (all issues x all calls):
   - Metadata: `gh api repos/O/R/issues/N --jq '{...}'`
   - Body: `gh api repos/O/R/issues/N --jq '.body'`
   - Comments since last_check_date (or all comments if last_check_date is null/setup):
     `gh api repos/O/R/issues/N/comments --jq '...'`
   - Known duplicate state checks (for each dupe number)
   - Upstream state check (if upstream exists)
   Use Promise.all with batching — max 15 concurrent requests to avoid rate limits.
   Use the execAsync helper from startup.
3. Post-process: For each issue, extract from body + comments:
   - `cross_references`: all `#NUMBER` patterns found in text (potential related issues)
   - `urls`: all URLs found in text (fork repos, PR links, external tools, workaround docs)
   These are stored alongside the raw data so analysis agents have them readily available.
4. Write raw data to temp dir as one JSON file per issue: `raw-OWNER-REPO-NUMBER.json`
   containing `{ metadata, body, comments, dupe_states, upstream_state, cross_references, urls }`.
5. Return JSON: `{ fetched: N, files: [...paths], errors: [...] }`

**Command 3: `build-tracker`**
Usage: `tracker-tools.cjs build-tracker --temp-dir <dir> --template <path> --username <name> --tracker <output-path> [--closed-json <path>]`

Steps:
1. Read the template file (tracker-template.md).
2. Replace USERNAME_HERE with --username value.
3. Read all `issue-*.md` result files from temp-dir (the standardized format from Task 1).
4. For each, extract frontmatter and body sections to build a tracker entry following
   tracker-schema.md format. Map fields:
   - title from frontmatter
   - Role from frontmatter role field
   - Filed from frontmatter filed field
   - Status from ## Status Summary section + frontmatter labels
   - What to check from ## Watch For section
   - Duplicates from ## Duplicates and Related section
   - Next steps from ## Next Steps section
   - Key Context -> Future field
5. If --closed-json provided, read it and add entries to Closed section.
6. Write the composed tracker to --tracker path.
7. Return JSON: `{ written: true, path, active_count, closed_count }`
  </action>
  <verify>
    <automated>node github-issues-update/bin/tracker-tools.cjs startup --help 2>&1 | head -1; node github-issues-update/bin/tracker-tools.cjs fetch-issues 2>&1 | head -1; node github-issues-update/bin/tracker-tools.cjs build-tracker 2>&1 | head -1</automated>
  </verify>
  <done>
All three commands registered in CLI router, startup returns structured JSON with auth/username/
tracker_data/new_issues/reopened/recently_closed, fetch-issues runs parallel gh api calls and
writes raw data files, build-tracker composes tracker from result files + template.
  </done>
</task>

<task type="auto">
  <name>Task 3: Revise SKILL.md router to use startup command</name>
  <files>github-issues-update/SKILL.md</files>
  <action>
Replace the current two-step process (resolve_paths + route with parse-tracker) with a single
startup call. The new process section:

**Step 1 (only step): startup and route**

1. Determine `$SKILL_DIR` from this file's location.
2. Verify script exists (same as current).
3. Set `$TRACKER_PATH` to `$HOME/OneDrive/Documents/github-tracker.md`.
4. Parse `$ARGUMENTS` for mode (--save or default).
5. Run startup:
   ```bash
   node "$SKILL_DIR/bin/tracker-tools.cjs" startup --tracker "$TRACKER_PATH"
   ```
6. Store entire response as `$STARTUP`. Extract: auth, username, tracker_exists, tracker_data,
   new_issues, reopened_issues, recently_closed.
7. If auth is false -> tell user to run `gh auth login`, STOP.

**Save mode:**
- If tracker_exists is false -> tell user to run `/github-issues-update` first, STOP.
- Read `workflows/save-issues.md` and `references/tracker-schema.md`.
- Execute save workflow passing `$STARTUP`, `$SKILL_DIR`, `$TRACKER_PATH`.

**Check-in mode:**
- If tracker_exists is false or tracker_data has no issues:
  - Tell user: "No tracker file found. Let's set one up."
  - Read `setup.md`.
  - Follow setup, passing `$STARTUP` (already has username and auth confirmed).
  - After setup, proceed to check-in.
- If tracker exists with content:
  - Store `$STARTUP` as context (replaces old `$TRACKER_DATA`).
  - Read `workflows/check-issues.md`, `references/gh-cli-patterns.md`, `references/tracker-schema.md`.
  - Execute check-in passing `$STARTUP`, `$SKILL_DIR`, `$TRACKER_PATH`.

Remove the old resolve_paths and route steps entirely. Keep everything else (frontmatter,
objective, execution_context references) the same.
  </action>
  <verify>
    <automated>grep -c "startup" github-issues-update/SKILL.md</automated>
  </verify>
  <done>SKILL.md uses single startup call, routes based on response, passes $STARTUP to all workflows.</done>
</task>

<task type="auto">
  <name>Task 4: Revise check-issues.md workflow</name>
  <files>github-issues-update/workflows/check-issues.md</files>
  <action>
Rewrite check-issues.md with these changes. Prerequisites now receive `$STARTUP` (not
`$TRACKER_DATA`), `$SKILL_DIR`, `$TRACKER_PATH`.

**Step 1: Initialize**
- Create temp dir via init-temp (same as current).
- Extract from `$STARTUP`: username, active_issues (with defaulted last_check_dates),
  new_issues, reopened_issues, recently_closed, all_tracked_numbers.
- Write the issues JSON file for fetch-issues:
  Build a JSON array of all active issues with fields: owner, repo, number, title, role,
  last_check_date, known_dupes (from duplicates + adjacent fields), upstream.
  Write to `$TEMP_DIR/issues-to-fetch.json`.

**Step 2: Fetch issue data via script**
- Run fetch-issues command:
  ```bash
  node "$SKILL_DIR/bin/tracker-tools.cjs" fetch-issues --temp-dir "$TEMP_DIR" --issues "$TEMP_DIR/issues-to-fetch.json"
  ```
  This replaces ALL the per-agent gh api calls. The script handles parallelism.

**Step 3: Batched analysis agents**
- Group active issues into batches of ~5 issues each.
- Spawn ONE Agent per batch (not one per issue).
- Each agent's prompt MUST include:
  - The list of raw data file paths for its batch (e.g., `$TEMP_DIR/raw-owner-repo-123.json`)
  - Explicit instruction: "Use the Read tool to read each file listed below."
  - The result file schema reference (inline or via file path).
  - For each issue: owner, repo, number, title, role, last_check_date, username,
    all_tracked_numbers (for filtering duplicate search results).
  - The `cross_references` and `urls` arrays from the raw JSON — use these to populate
    the ## Cross-References and ## External Links sections.
  - Instruction to search for NEW duplicates for ALL issues in the batch (not just authored).
    Search by SYMPTOMS and ERROR MESSAGES, not just title keywords.
    Run keyword searches per issue. Also flag any obviously related closed issues from
    `$STARTUP.recently_closed`.
  - Auto-include instruction: If a recently_closed issue is obviously related to an active
    issue (same topic, same repo, referenced in comments), note it in the Duplicates section.
  - For duplicates/adjacent: explain whether shared ROOT CAUSE or just SYMPTOMS.
  - MANDATORY: Write one result file per issue to `$TEMP_DIR/issue-OWNER-REPO-NUMBER.md`
    using the standardized format from references/result-file-schema.md.
  - Include these QUALITY EXAMPLES directly in the prompt:
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
- Wait for all agents. Verify file count matches active_issues count.

**Step 4: Cross-issue synthesis**
- Spawn ONE Agent that reads ALL result files from `$TEMP_DIR/issue-*.md`.
- Agent prompt: "Use the Read tool to read each of these files: [list paths]. Then analyze
  across all issues for: (1) Clusters — issues that are related or affect the same area,
  (2) Contradictions — conflicting information across issues, (3) Gaps — issues missing
  data or with stale information, (4) Priority signals — which issues need attention most
  urgently, (5) Untracked cross-references — check if any issue numbers found in
  ## Cross-References sections point to issues NOT in the tracker. List them as potential
  tracking candidates. Write your synthesis to `$TEMP_DIR/synthesis.md` with sections for each."
- The compile-report step will read this synthesis and append it to the report.

**Step 5: Compile and present report** (same as current Step 3, but also):
- After compile-report runs, read `$TEMP_DIR/synthesis.md` if it exists and append a
  "### Cross-Issue Analysis" section to the report output.
- Also include new_issues and reopened_issues from `$STARTUP` in the report (replaces
  what the general check subagent used to provide). Format new_issues as a table:
  `| Issue | Repo | Recommendation |`. Format reopened as a list.

**Step 6: Verification agent**
- Spawn ONE Agent after report compilation.
- Prompt: "Use the Read tool to read the compiled report at `$TEMP_DIR/_compiled-report.md`.
  Then read each issue result file in `$TEMP_DIR/issue-*.md`. Verify:
  (1) Every active issue has a corresponding section in the report.
  (2) No data was lost — key findings from result files appear in the report.
  (3) All new_issues and reopened_issues are mentioned.
  (4) QUALITY CHECK — flag any of these shallow-output patterns:
      - 'What to check' that only says 'Monitor for maintainer' or similar generic phrase
      - Missing '## Key Technical Data' section or section that says only 'N/A'
      - Role field that is a single word ('Author', 'Commenter') without contribution description
      - Duplicate listed without WHY reasoning (root cause vs symptoms)
      - 'Next steps' that says only 'Follow up' or 'Monitor' without specifics
      - Missing '## External Links' section when the issue body/comments clearly contain URLs
      - Workarounds described generically instead of with exact commands
  Write verification result to `$TEMP_DIR/verification.md` with: pass/fail, data gaps,
  and a 'Quality Flags' section listing any shallow-output issues found."
- If verification finds gaps OR quality flags, warn the user before presenting the report.

**Step 7: Confirm and execute actions** (same as current Step 4)

**Step 8: Update tracker** (same as current Step 5)

**Step 9: Completion checklist**
Replace the current validate_and_cleanup step with a completion checklist:
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
Run validation command, then check each item. If any item is unchecked, report it to the user
before cleanup. This replaces the simple validate step — it has "teeth" because it explicitly
lists what must be done and blocks cleanup if items are missing.

Remove the general check subagent entirely (Step 2b in old version). Startup now covers
new issue discovery and reopened detection.
  </action>
  <verify>
    <automated>grep -c "fetch-issues" github-issues-update/workflows/check-issues.md && grep -c "synthesis" github-issues-update/workflows/check-issues.md && grep -c "Completion Checklist" github-issues-update/workflows/check-issues.md && grep -c "general check" github-issues-update/workflows/check-issues.md | grep "0"</automated>
  </verify>
  <done>
Check-in workflow uses fetch-issues for data, batched ~5-issue analysis agents with explicit
"Use the Read tool" instruction, cross-issue synthesis step, verification agent, completion
checklist, no general check subagent. Duplicate search runs for all issues. Auto-includes
related closed issues.
  </done>
</task>

<task type="auto">
  <name>Task 5: Revise setup.md workflow</name>
  <files>github-issues-update/setup.md</files>
  <action>
Rewrite setup.md. Prerequisites now receive `$STARTUP` (with auth confirmed, username known,
new_issues populated as discovery results), `$SKILL_DIR`, `$TRACKER_PATH`.

**Step 1: Use startup data (replaces old Steps 1-3)**
- Auth already confirmed by router (startup returned auth: true).
- Username already known from `$STARTUP.username`. No need to ask user.
- Discovery already done: `$STARTUP.new_issues` contains all open issues involving user.
  `$STARTUP.recently_closed` contains recently closed issues.
- Skip the old discovery subagent entirely.

**Step 2: Present findings and select** (similar to old Step 4)
- Show `$STARTUP.new_issues` grouped by repo.
- For >10 issues, use summary-based confirmation: Show a summary table
  (repo | count | sample titles) instead of the full list. Ask:
  "Found N issues across M repos. Track all, or review the full list?"
  Options: "All of them" / "Show full list first" / "Let me pick specific ones" / "None"
- For <=10 issues, show full list as before.
- For recently closed: ask if any should go in Closed section.
- Auto-include obviously related closed issues: if a closed issue references an active
  issue in its body or comments (based on startup data), recommend including it.

**Step 3: Fetch issue data via script**
- Write selected issues to `$TEMP_DIR/issues-to-fetch.json` (same format as check-in).
  For setup, set last_check_date to null (fetch-issues will fetch all comments).
- Run:
  ```bash
  node "$SKILL_DIR/bin/tracker-tools.cjs" fetch-issues --temp-dir "$TEMP_DIR" --issues "$TEMP_DIR/issues-to-fetch.json"
  ```

**Step 4: Batched analysis agents**
- Same pattern as check-issues Task 4: group into batches of ~5, spawn one Agent per batch.
- Each agent reads raw data files via Read tool, analyzes, writes standardized result files.
- Duplicate search for ALL issues (not just authored). Search by SYMPTOMS and ERROR MESSAGES,
  not just title keywords.
- Agent prompt references result-file-schema.md for output format.
- Agent prompt MUST include the same QUALITY EXAMPLES block as check-issues (GOOD vs BAD
  for role descriptions, what to check, workarounds, duplicate reasoning, key technical data,
  next steps). This is where v3 lost the most depth — the setup deep dive is the critical path
  for tracker quality. The examples are non-negotiable.

**Step 5: Build tracker via script** (replaces old manual Step 6)
- Run build-tracker:
  ```bash
  node "$SKILL_DIR/bin/tracker-tools.cjs" build-tracker --temp-dir "$TEMP_DIR" --template "$SKILL_DIR/tracker-template.md" --username "$USERNAME" --tracker "$TRACKER_PATH"
  ```
  If user selected closed issues, write them to `$TEMP_DIR/closed-issues.json` and pass
  `--closed-json "$TEMP_DIR/closed-issues.json"`.

**Step 6: Summary confirmation**
- For >10 issues: Show a summary of the tracker (issue count, repos covered, key findings)
  rather than the full file content. Ask user to confirm or review full file.
- For <=10 issues: Show full tracker content for confirmation (same as before).

**Step 7: Run compile-report** (NEW — replaces old "auto check-in")
- Instead of routing back to check-in workflow, run compile-report directly:
  ```bash
  node "$SKILL_DIR/bin/tracker-tools.cjs" compile-report --temp-dir "$TEMP_DIR" --date "$(date +%Y-%m-%d)"
  ```
- Show the report to the user. This gives them an immediate overview without running a
  full check-in cycle (which would re-fetch everything that was just fetched).

**Step 8: Cleanup**
- Clean up temp dir.
- Tell user: "Tracker created with N issues. Use `/github-issues-update` for future check-ins."
  </action>
  <verify>
    <automated>grep -c "startup" github-issues-update/setup.md && grep -c "fetch-issues" github-issues-update/setup.md && grep -c "build-tracker" github-issues-update/setup.md && grep -c "compile-report" github-issues-update/setup.md</automated>
  </verify>
  <done>
Setup uses startup data (no auth check, no username prompt, no discovery subagent), fetch-issues
for API data, batched analysis agents, build-tracker command, summary confirmation for >10 issues,
compile-report at end instead of auto check-in.
  </done>
</task>

<task type="auto">
  <name>Task 6: Revise save-issues.md to use startup data</name>
  <files>github-issues-update/workflows/save-issues.md</files>
  <action>
Update save-issues.md prerequisites line: receives `$STARTUP` (not `$TRACKER_DATA`).

In Step 1 (understand_tracker), change references from `$TRACKER_DATA` to `$STARTUP.tracker_data`:
- `$STARTUP.tracker_data.all_tracked_numbers` instead of `$TRACKER_DATA.all_tracked_numbers`
- `$STARTUP.username` instead of `$TRACKER_DATA.username`

The rest of the workflow (scan conversation, fetch metadata, confirm and write) stays the same.
This is a small change — just update the data source references throughout the file.
  </action>
  <verify>
    <automated>grep -c "STARTUP" github-issues-update/workflows/save-issues.md && grep -c "TRACKER_DATA" github-issues-update/workflows/save-issues.md | grep "0"</automated>
  </verify>
  <done>Save workflow references $STARTUP instead of $TRACKER_DATA throughout.</done>
</task>

</tasks>

<verification>
After all tasks complete:

1. All 6 files exist and have been modified:
   - `github-issues-update/references/result-file-schema.md` (new)
   - `github-issues-update/bin/tracker-tools.cjs` (startup, fetch-issues, build-tracker added)
   - `github-issues-update/SKILL.md` (router uses startup)
   - `github-issues-update/workflows/check-issues.md` (batched agents, synthesis, checklist)
   - `github-issues-update/setup.md` (uses startup, fetch-issues, build-tracker, compile-report)
   - `github-issues-update/workflows/save-issues.md` (uses $STARTUP)

2. No references to "general check subagent" remain in check-issues.md.

3. All workflows reference `$STARTUP` not `$TRACKER_DATA`.

4. tracker-tools.cjs has 8 commands total (5 existing + 3 new).

5. The standardized result file format in result-file-schema.md is referenced by both
   check-issues.md and setup.md agent prompts.
</verification>

<success_criteria>
- `node tracker-tools.cjs` shows all 8 commands in usage output
- SKILL.md contains "startup" and no "parse-tracker" in routing logic
- check-issues.md contains "fetch-issues", "synthesis", "Completion Checklist", "batch"
- check-issues.md does NOT contain "general check" or "2b"
- setup.md contains "startup", "fetch-issues", "build-tracker", "compile-report"
- setup.md does NOT contain "gh auth status", "ask the user for their GitHub username", or "discovery subagent"
- save-issues.md references $STARTUP, not $TRACKER_DATA
- result-file-schema.md exists with unified format AND contains GOOD/BAD examples
- check-issues.md and setup.md analysis agent prompts contain "QUALITY REQUIREMENTS" block
- check-issues.md verification agent prompt contains "Quality Flags" check
- fetch-issues raw JSON files contain cross_references and urls arrays
</success_criteria>

<output>
After completion, create `.planning/quick/260402-mkl-revise-github-issues-update-skill-with-g/260402-mkl-SUMMARY.md`
</output>
