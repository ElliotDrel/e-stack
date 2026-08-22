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
is_pr: false                    # true if the tracked item is a pull request
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

The role describes what the user **did**, not just a label.

Bad: `"Author"`, `"Commenter"`
Good: `"Author (filed with 3 crash instances, posted workaround)"`,
`"Commenter (confirmed bug + shared exact callbackPort: 3118 fix)"`

---

## Body Sections

### ## Status Summary

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

### ## Upstream

Upstream dependency status — is this issue blocked on or related to an upstream fix?
Write "N/A" if there are no upstream dependencies.

Bad: `"There's an upstream issue."`
Good: `"Blocked on bun#28175 (open, no activity since Mar 2). Fix landed in Node 22.4 but
Bun hasn't ported it. No workaround available upstream."`

### ## PR Health

**Conditional — include only when `is_pr: true`.** Omit this entire section for plain issues.

Populated from the `pr_health` block in the raw JSON (or the PR-health template in
`references/gh-cli-patterns.md`). Record:

```
merge_state: CLEAN | DIRTY | BLOCKED | UNSTABLE | ...   (mergeStateStatus)
mergeable: MERGEABLE | CONFLICTING | UNKNOWN
review_decision: APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | null
ci_status: passing | failing | pending
ci_failures: list each failing check by name (or "none")
human_reviews: @reviewer (APPROVED) — login NOT ending in [bot]
bot_reviews: @some-bot[bot] (COMMENTED) — listed separately, do NOT count toward approval
```

Rules:
- `state: COMMENTED` is **not** an approval — only `APPROVED` counts.
- A reviewer whose login ends in `[bot]` never satisfies a human-review requirement.
- `mergeStateStatus: DIRTY` or `mergeable: CONFLICTING` means a merge conflict — surface it in
  `## Status Summary` and `## Next Steps`.

Good: `"merge_state: DIRTY (conflict in src/index.ts). ci_status: failing — 'lint' check.
review_decision: REVIEW_REQUIRED. human_reviews: none. bot_reviews: @codecov[bot] (COMMENTED)."`

### ## Cross-References

All issue numbers mentioned in the issue body and comments. Helps the tracker build
a cross-reference map. List each with a one-line explanation of why it was mentioned.

Bad: `"#100, #200, #300"`
Good:
```
- #28175 — upstream Bun issue causing the root crash
- #40693 — adjacent rename bug (different root cause, shared symptom)
- #41022 — PR that attempted a fix but was reverted
```

### ## Next Steps

Specific, actionable items driven by the user's **Goal** for this issue (from the tracker).
If the goal is "get my fix merged", focus on what's blocking the merge.
If "get maintainer to respond", suggest ways to increase visibility.
If "monitor for upstream fix", focus on upstream signals.

Bad: `"Monitor for updates"`, `"Follow up"`
Good: `"Respond to @maintainer's request for memory profiling data"`,
`"Test fix in PR #4521 against your reproduction case"`,
`"Nothing to do — waiting on maintainer review. Check back next week."`

### ## Watch For

Specific, concrete signals to monitor for this issue. These drive what gets checked
on the next run. Avoid generic statements — name exact PRs, labels, or events.

Bad: `"Watch for updates"`, `"Monitor the repo"`
Good:
```
- PR #4521 merging (would fix root cause)
- `p0` label being added (escalation signal)
- @core-dev responding to the reproduction request from Mar 28
```

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

**Write discipline (mirrors SKILL.md Step 2b):**
- **Always write (overwrite stale values):** `status_summary` — it carries the API-observable,
  high-churn facts (open/closed state, labels, comment count, last-comment date, and for PRs
  the merge state, review decision, and CI status). Always regenerate it from fresh API data;
  never preserve a stale value.
- **Fill only if missing (do not clobber human context):** `goal` (always user-supplied — never
  guess), `what_to_check`, and any analysis-derived context (root cause, workaround, key
  technical data). Emit these only when the tracker entry has a blank for them.

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

---

## `TRACKER_UPDATE:` return convention (subagent → orchestrator)

`history_entry:` lines above are persisted in bulk by `update-tracker` when it reads
the result file (Step 3). That covers analysis. It does **not** cover an action a
subagent takes *directly* (e.g. posting a comment mid-analysis), which must be
persisted immediately rather than waiting for the end-of-session bulk write.

For those, a subagent ends its reply (not the result file) with one line per action:

```
TRACKER_UPDATE: owner/repo#NUMBER | YYYY-MM-DD | <one-line description>
```

The orchestrator parses each line and, on receipt, calls `append-history` once per line
before continuing:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" append-history \
  --tracker "$TRACKER_PATH" --issue owner/repo#NUMBER \
  --date YYYY-MM-DD --desc "<one-line description>"
```

`append-history` is atomic and dedups, so a repeated line is a safe no-op. This is the
incremental, interrupt-safe path; `history_entry:` remains the bulk path for analysis
captured in result files.
