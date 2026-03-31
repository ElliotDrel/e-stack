# Check-In Workflow

Main workflow for `/github-issues-update`. Executed when tracker file exists.
Read `references/gh-cli-patterns.md` and `references/tracker-schema.md` before starting.

Uses one subagent per tracked issue for thorough, parallel reviews.

---

## Phase 1: Gather Data (Subagents)

Before spawning agents, parse the tracker file to extract:
- All active issues (owner, repo, number, title, role, last check date, known duplicates/related)
- All closed issues (owner, repo, number)
- All upstream issues (owner, repo, number)
- The GitHub USERNAME from the file header
- The `--skip-dupes` and `--dry-run` flags from arguments

### 1a. One subagent per active issue

**Spawn one Agent per active issue**, all in parallel. Each agent performs a thorough
review of a single issue. Include in the agent prompt: OWNER, REPO, NUMBER, TITLE, ROLE,
LAST_CHECK_DATE, USERNAME, known duplicate/related issue numbers, upstream issue (if any),
and whether `--skip-dupes` is active.

Agent prompt template:

> You are doing a thorough review of GitHub issue OWNER/REPO#NUMBER ("TITLE").
> The user's role is ROLE. Last checked: LAST_CHECK_DATE. GitHub username: USERNAME.
>
> **Step 1 — Fetch data (run all in parallel):**
>
> 1. Current metadata:
>    `gh api repos/OWNER/REPO/issues/NUMBER --jq '{state: .state, labels: [.labels[].name], comments: .comments, updated: .updated_at, created: .created_at}'`
>
> 2. Last 5 comments (with full context):
>    `gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '.[-5:] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body[0:500]}'`
>
> 3. Issue body (for context):
>    `gh api repos/OWNER/REPO/issues/NUMBER --jq '{title: .title, body: .body[0:1000], author: .user.login}'`
>
> 4. **Known duplicates/related** (if any — these are the issue numbers: KNOWN_DUPES):
>    For each, fetch state and last 2 comments:
>    `gh api repos/DUPE_OWNER/DUPE_REPO/issues/DUPE_NUMBER --jq '{state: .state, updated: .updated_at}'`
>    `gh api repos/DUPE_OWNER/DUPE_REPO/issues/DUPE_NUMBER/comments --jq '.[-2:] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body[0:300]}'`
>
> 5. **Upstream issue** (if any — UPSTREAM_OWNER/UPSTREAM_REPO#UPSTREAM_NUMBER):
>    `gh api repos/UPSTREAM_OWNER/UPSTREAM_REPO/issues/UPSTREAM_NUMBER --jq '{state: .state, labels: [.labels[].name], updated: .updated_at}'`
>    `gh api repos/UPSTREAM_OWNER/UPSTREAM_REPO/issues/UPSTREAM_NUMBER/comments --jq '.[-2:] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body[0:300]}'`
>
> 6. **Search for NEW duplicates/related** (SKIP if --skip-dupes is active):
>    Run 2-3 keyword searches based on the issue title and topic:
>    `gh api "search/issues?q=repo:OWNER/REPO+is:open+created:>LAST_CHECK_DATE+KEYWORD1+KEYWORD2&per_page=10" --jq '.items[] | "#\(.number) — \(.title) [\(.created_at | split("T")[0])] @\(.user.login)"'`
>    Use different keyword variations to catch different phrasings.
>    Exclude these already-known issue numbers: [list of all tracked + known dupe numbers].
>
> **Step 2 — Analyze:**
>
> Compare fetched data against the last check date (LAST_CHECK_DATE):
> - New comments since last check? Summarize who said what.
> - Label changes? State changes (open → closed or vice versa)?
> - Any comments from repo maintainers or Anthropic employees? (Highest priority signals.)
> - Any new activity on known duplicates/related?
> - Any new duplicate/related issues found?
> - Upstream status changes?
>
> **Step 3 — Return structured report:**
>
> ```
> ## OWNER/REPO#NUMBER — TITLE
> - **State:** Open/Closed [changed since last check? yes/no]
> - **Labels:** [current labels]
> - **Activity since LAST_CHECK_DATE:** [summary of new comments — who said what, highlight maintainer/Anthropic responses. Say "No new activity" if none.]
> - **Known duplicates/related — updates:** [any new activity on previously identified dupes. "None" if no dupes or no activity.]
> - **New duplicates/related found:** [list new ones with #number, @author, title, date, and why related. "None found" if none or skipped.]
> - **Upstream status:** [current state if upstream exists. "N/A" if no upstream.]
> - **Suggested next steps:** [immediate actions — respond to question, comment on new duplicate, follow up, etc. "None" if nothing to do.]
> - **Future:** [things to monitor, low-priority items]
> - **Has activity:** true/false [for sorting purposes]
> ```

### 1b. General check subagent

**Spawn one additional Agent** (in parallel with the per-issue agents) for general checks
that aren't issue-specific. Include USERNAME and LAST_CHECK_DATE (use the oldest "Status as of"
date from the tracker).

Agent prompt:

> Run these general GitHub checks for user USERNAME. Last check date: LAST_CHECK_DATE.
>
> **Fetch in parallel:**
>
> 1. Recent activity involving the user (issues not already in the tracker):
>    `gh api "search/issues?q=involves:USERNAME+updated:>LAST_CHECK_DATE+is:open" --jq '.items[] | "#\(.number) \(.repository_url | split(\\"/\\") | .[-2:] | join(\\"/\\")) — \(.title) [updated: \(.updated_at)]"'`
>    Filter out these already-tracked issue numbers: [ALL_TRACKED_NUMBERS].
>
> 2. Check closed issues for reopens (run each in parallel):
>    For each of these closed issues: [CLOSED_ISSUE_LIST]
>    `gh api repos/OWNER/REPO/issues/NUMBER --jq '.state'`
>    Flag any that are no longer "closed".
>
> **Return:**
> - **New issues not in tracker:** list with #number, title, repo, and recommendation (track/ignore)
> - **Reopened issues:** any closed issues that were reopened (or "None")

### 1c. Collect results

Wait for ALL agents to complete. You now have:
- One structured report per active issue
- One general check report

---

## Phase 2: Compile and Present Report

Using the collected subagent results, present a unified report to the user.

**Order:** Issues with activity first (sorted by most active), then issues with no activity.

**For issues WITH new activity (has_activity: true), show the full report from the agent:**

```
### owner/repo#NUMBER — Title
- **Status:** [Open/Closed] [state changes since last check]
- **Labels:** [current labels]
- **Activity since last check:** [new comments summary — who said what, highlight maintainer/Anthropic responses]
- **Known duplicates — updates:** [any new activity on previously identified dupes]
- **New duplicates/related found:** [new ones: #number — @author, "title" (date), why related]
- **Next steps (now):** [immediate actions — comment on duplicate, respond to question, etc.]
- **Future:** [things to monitor, low-priority actions]
```

**For issues with NO new activity**, group them briefly:

```
### No Activity
- owner/repo#NUMBER — Title (last activity: DATE)
- owner/repo#NUMBER — Title (last activity: DATE)
```

**After all active issues, add these sections from the general check agent:**

```
### New Issues Not in Tracker
[Issues found not already tracked. For each: #number, title, repo, role, recommendation (track/ignore)]

### Closed Issues Status
[Confirm all closed issues still closed. Flag any surprises.]

### Upstream Status
[Status of any upstream dependencies. Flag if fixed upstream but not downstream.]
```

---

## Phase 3: Confirm and Execute

**If `--dry-run` flag is active, STOP here.** Tell the user: "Dry run complete. No actions taken."

**If there are "Next steps (now)" items:**

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

---

## Phase 4: Update Tracker

Use AskUserQuestion:
- header: "Update file?"
- question: "Want me to update the tracker file with today's findings?"
- options:
  - "Yes, update it"
  - "No, leave it as-is"

If confirmed, update `github-tracker.md` following the schema in `references/tracker-schema.md`:

- Update all "Status as of" dates to today's date
- Update comment counts, labels, state descriptions
- Add newly discovered duplicates/related issues under their parent issue
- Add new issues to Active or Closed sections as appropriate
- Move any newly closed issues from Active to Closed
- Clear completed "Next steps (now)" items
- Add new "Future" items identified this check-in
- Preserve any content the user added manually (don't overwrite custom notes)

After updating, tell the user what changed:
> Tracker updated. Changed: [brief summary of what was modified].
