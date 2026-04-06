# Result File Schema

> Written by analysis agents, consumed by `compile-report`, `build-tracker`, and `update-tracker`.

One file per issue: `issue-OWNER-REPO-NUMBER.md` in the temp directory.
Raw API data lives in `raw-OWNER-REPO-NUMBER.json` (written by `fetch-issues`).

---

## Frontmatter

```yaml
---
type: issue
owner: OWNER
repo: REPO
number: NUMBER
title: "Issue title"
state: open
state_changed: false           # true if state changed since last check
labels: label1, label2
has_activity: false             # true if new comments since last check
role: "SEE GUIDANCE BELOW"
filed: YYYY-MM-DD
last_check_date: null           # date of previous check, null for first analysis
last_commenter: "@username"
last_comment_date: YYYY-MM-DD
comment_count: N
---
```

### Role Field

The role MUST describe what the user **did**, not just a label.

Bad: `"Author"`, `"Commenter"`
Good: `"Author (filed with 3 crash instances, posted workaround)"`,
`"Commenter (confirmed bug + shared exact callbackPort: 3118 fix)"`

---

## Body Sections

### ## Summary

Plain English: where does this issue stand and why does it matter? Write as if briefing
someone who hasn't looked at the issue in a week. Include dates, names, numbers.

Bad: "Issue is about a bug that causes crashes."
Good: "You filed this on Jan 15 about a crash when renaming MCP servers. Root cause is
tracked upstream in bun#28175. Workaround: name servers differently."

### ## Activity

What happened since last check (or full history if first analysis).

Format:
```
- @username (YYYY-MM-DD): What they said WITH specifics.
```

### ## Duplicates and Related

Two subsections:

#### ### Known — updates
Status changes on previously known duplicates/adjacent issues. Or "No changes."

#### ### New finds
Newly discovered duplicates or related issues. Or "None found."

For each entry, explain whether it shares a **root cause** (duplicate) or just
**symptoms** (adjacent). Don't just list titles — explain WHY it's related.

Bad: `"#40693 — related rename issue"`
Good: `"#40693 — VS Code UI blocking during rename. Same symptom (rename fails) but
different root cause: UI thread blocking vs JSONL write. Adjacent, not duplicate."`

### ## Next Steps

Specific, actionable items driven by the user's **Goal** for this issue (from the tracker).
If the goal is "get my fix merged", focus on what's blocking the merge.
If "get maintainer to respond", suggest ways to increase visibility.
If "monitor for upstream fix", focus on upstream signals.

Bad: `"Monitor for updates"`, `"Follow up"`
Good: `"Respond to @maintainer's request for memory profiling data"`,
`"Test fix in PR #4521 against your reproduction case"`,
`"Nothing to do — waiting on maintainer review. Check back next week."`

### ## Key Context

Workarounds (exact commands, not paraphrases), severity signals, technical details
someone would need to discuss this issue knowledgeably.

Bad: `"Use different server names"`
Good: `"Workaround: set MIMALLOC_ARENA_EAGER_COMMIT=0 before starting. Reduces peak
RSS from 2.4GB to 1.1GB but doesn't eliminate growth."`

### ## Tracker Updates

Machine-readable lines consumed by `update-tracker` and `build-tracker`:

```
goal: Get my fix merged | Get maintainer response | Monitor for upstream fix | etc.
status_summary: Open. Labels: bug, p1. JSONL crash on rename. 12 comments total.
what_to_check: PRs modifying renameSession; JSONL title write logic changes.
```

Optional:
```
new_duplicate: #NUMBER — @author, "Title" (date). Why related. [duplicate|adjacent]
```

History entries (one per notable event):
```
history_entry: YYYY-MM-DD | Description of action or event
```

What to log: actions taken ("Posted comment"), external events ("Maintainer replied"),
state changes ("Closed via PR #123"). Don't log "no activity" — only real events.
