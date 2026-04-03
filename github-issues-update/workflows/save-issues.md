# Save Issues to Tracker

Adds issues from the current conversation to the tracker file. Designed to be run
in a chat where the user has been creating or discussing GitHub issues.

**Prerequisites loaded by router:** `$STARTUP` (JSON from `startup` command containing
auth, username, tracker_data), `$SKILL_DIR` (skill directory path),
`$TRACKER_PATH` (tracker file path).

---

<step name="understand_tracker" priority="first">

## Step 1: Understand the Tracker

The tracker has already been parsed by the startup command. Use `$STARTUP` to:
- Learn which issues are already tracked (`$STARTUP.tracker_data.all_tracked_numbers`) — avoid duplicates
- Get the GitHub username (`$STARTUP.username`)
- Understand the existing entry format by reading `references/tracker-schema.md`

**acceptance_criteria:** `$STARTUP` loaded with username and tracked issue list.

</step>

<step name="scan_conversation">

## Step 2: Identify Issues from Conversation

Scan the conversation history for GitHub issues the user created or discussed. Look for:
- `gh issue create` commands and their output (issue URLs/numbers)
- Issue URLs pasted by the user (e.g., `github.com/owner/repo/issues/123`)
- Issue numbers mentioned in context with a repo (e.g., "opened #45 on owner/repo")
- Issues discussed in detail that the user would want to track

For each issue found, extract what you can from the conversation:
- Owner/repo and issue number
- Title (if known from conversation)
- The user's role (usually Author if they just created it)
- Key context: why they filed it, what they're watching for, any workarounds

Cross-check against `$STARTUP.tracker_data.all_tracked_numbers` — skip issues already tracked.

If no new issues found, tell the user: "No new issues found in this conversation to add."
Then **STOP**.

**acceptance_criteria:** List of new issues identified with owner/repo/number for each.

</step>

<step name="fetch_metadata">

## Step 3: Fetch Missing Data

For each identified issue, fetch current metadata to fill gaps the conversation didn't cover:

```bash
gh api repos/OWNER/REPO/issues/NUMBER --jq '{title: .title, state: .state, labels: [.labels[].name], comments: .comments, created: (.created_at | split("T")[0])}'
```

Run all fetches in parallel.

**acceptance_criteria:** Metadata fetched for all identified issues.

</step>

<step name="confirm_and_write" priority="must-execute">

## Step 4: Confirm and Write

**MANDATORY — DO NOT SKIP THIS STEP.**

1. Build new tracker entries following the format in `references/tracker-schema.md`.
   Match the style of existing entries in the tracker exactly.
   Include a History section with the initial filing entry:
   - If the user authored the issue:
     ```
     - **History:**
       - **YYYY-MM-DD:** Filed issue (brief context — e.g., "Filed issue with 3 crash instances")
     ```
   - If the user is adding an existing issue they didn't author:
     ```
     - **History:**
       - **YYYY-MM-DD:** Added to tracker for monitoring
     ```
2. Show the user the entries that will be added.
3. Ask for confirmation via AskUserQuestion:
   - header: "Add to tracker?"
   - question: "Add these N issues to the tracker?"
   - options:
     - "Yes, add them"
     - "Let me edit first"
     - "Cancel"
4. If confirmed, read the current tracker file, append new entries to the
   `## Active Issues (watching for updates)` section, and write it back.
5. Report what was added.

**acceptance_criteria:** New issues appended to tracker file (or explicitly cancelled by user).

</step>
