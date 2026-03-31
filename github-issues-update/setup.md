# First-Time Setup: GitHub Issue Tracker

Run this workflow when no tracker file exists. Creates a tracker from scratch by
discovering all open issues the user is involved in.

Uses subagents to parallelize discovery and per-issue deep dives.

## Prerequisites

Verify `gh` CLI is authenticated before proceeding:
```bash
gh auth status
```
If not authenticated, tell the user to run `! gh auth login` in their terminal and STOP.

## Phase 1: Get GitHub Username

Ask the user for their GitHub username. Verify it exists:
```bash
gh api users/USERNAME --jq '.login'
```
If invalid, ask again. Do not guess.

## Phase 2: Discover Active Issues (Subagent)

**Spawn a single Agent** (general-purpose) to run all discovery searches in parallel and return
a consolidated list. The agent's prompt must include the USERNAME and these instructions:

> You are discovering all open GitHub issues involving a user. Run ALL of the following
> searches in parallel using separate Bash calls, then combine results into a single
> deduplicated list. For each issue, include: number, owner/repo, title, role, updated date.
>
> **Searches to run (all in parallel):**
>
> 1. Issues authored:
>    `gh api "search/issues?q=author:USERNAME+is:open&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: author] [updated: \(.updated_at | split("T")[0])]"'`
>
> 2. Issues commented on (excluding authored):
>    `gh api "search/issues?q=commenter:USERNAME+is:open+-author:USERNAME&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: commenter] [updated: \(.updated_at | split("T")[0])]"'`
>
> 3. Issues mentioned in (excluding authored/commented):
>    `gh api "search/issues?q=mentions:USERNAME+is:open+-author:USERNAME+-commenter:USERNAME&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: mentioned] [updated: \(.updated_at | split("T")[0])]"'`
>
> 4. Open PRs authored:
>    `gh api "search/issues?q=author:USERNAME+is:open+type:pr&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: PR author] [updated: \(.updated_at | split("T")[0])]"'`
>
> 5. Recently closed issues (last 30 days):
>    `gh api "search/issues?q=involves:USERNAME+is:closed+closed:>THIRTY_DAYS_AGO&per_page=50&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [closed: \(.closed_at | split("T")[0])]"'`
>    (Calculate the date 30 days ago using: `python3 -c "import datetime; print((datetime.datetime.now()-datetime.timedelta(days=30)).strftime('%Y-%m-%d'))"`)
>
> **Return format:** Two sections — "Open Issues" and "Recently Closed" — each grouped by repo.
> Deduplicate across searches (same issue may appear in multiple results). Preserve the role
> from whichever search found it first (priority: author > PR author > commenter > mentioned).

## Phase 3: Present Findings and Select

Show all discovered issues grouped by repo using the agent's output:

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

If "Let me pick," ask the user to list issue numbers.

For recently closed issues, ask if any should be added to "Closed / Resolved" for historical tracking.

## Phase 4: Deep Dive on Selected Issues (One Subagent per Issue)

**Spawn one Agent per selected issue**, all in parallel. Each agent does a thorough review
of a single issue. The agent's prompt must include the OWNER, REPO, NUMBER, and ROLE, plus:

> You are reviewing GitHub issue OWNER/REPO#NUMBER for initial tracker setup.
> The user's role is ROLE.
> Fetch ALL of the following in parallel, then return a structured summary.
>
> **Data to fetch (all in parallel):**
> 1. Full metadata: `gh api repos/OWNER/REPO/issues/NUMBER --jq '{state: .state, labels: [.labels[].name], comments: .comments, updated: .updated_at, created: .created_at}'`
> 2. Issue body (FULL — do not truncate): `gh api repos/OWNER/REPO/issues/NUMBER --jq '.body'`
> 3. Comments (FULL — do not truncate): `gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '.[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body}'`
> 4. **Search for duplicates/related** (for authored issues only — skip if ROLE is not "author"):
>    Run 2-3 keyword searches based on the issue title and key terms from the body:
>    `gh api "search/issues?q=repo:OWNER/REPO+is:open+KEYWORD1+KEYWORD2&per_page=10" --jq '.items[] | "#\(.number) — \(.title) [\(.created_at | split("T")[0])] @\(.user.login)"'`
>    Exclude the issue itself. Use different keyword variations to catch different phrasings.
>
> **Analyze and return:**
>
> IMPORTANT — Extract specifics, don't paraphrase. For authored issues especially, pull
> exact technical data from the body and comments: error codes, memory addresses, stack
> traces, test counts, file counts, competing approaches, version numbers, config values,
> and any other concrete data points. Quote or reproduce them — don't summarize "3 crash
> instances documented" when you can list the actual addresses/sizes.
>
> - **Title:** (from metadata)
> - **Role:** ROLE
> - **State:** Open/Closed
> - **Labels:** comma-separated list
> - **Filed:** date (if role is author)
> - **Comment count:** N
> - **Status summary:** 2-3 sentence summary of where the issue stands. Include specific technical details, not generic descriptions.
> - **Key technical data:** (for authored issues) List concrete data points from the issue body and comments — error codes, addresses, sizes, test counts, config values, file lists, etc. This section should contain the raw facts someone would need to discuss this issue knowledgeably.
> - **Last commenter:** who commented last, and when
> - **Waiting on:** who the issue is waiting on (maintainer response? user action? etc.)
> - **Cross-references:** any other issue numbers mentioned in the body or comments
> - **Duplicates/related found:** (if searched) list with #number, title, author, and why related. "None found" if none. "Skipped — not authored" if role is not author.
> - **What to check:** recommended signals to watch for on future check-ins
> - **Key context:** anything notable (workarounds mentioned, upstream links, severity signals, competing PRs)

Wait for all agents to complete and collect their results.

## Phase 5: Build the Tracker

1. Read `tracker-template.md` from the skill directory.
2. Replace `USERNAME_HERE` with the actual GitHub username.
3. For each selected issue, create an entry under "Active Issues" following the schema in `references/tracker-schema.md`. Use the per-issue agent results to populate all fields.
4. Add any selected closed issues to "Closed / Resolved".
5. Show the complete tracker content to the user for confirmation.
6. After confirmation, write to: `$HOME/Documents/github-tracker.md`

Tell the user:
> Tracker created. Running first check-in now.

Setup is complete. Return control to the router (SKILL.md Phase 0, step 4) which will
proceed into the check-in workflow automatically.
