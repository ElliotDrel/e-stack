# Overview Report Template

Use this template to compile the final check-in report from subagent results.
Replace all `[placeholders]` with actual data. Remove sections that don't apply.

---

## GitHub Issues Check-In — [TODAY'S DATE]

**Tracking [N] active issues across [N] repos** | Last check: [LAST_CHECK_DATE]

---

### Issues with Activity

<!-- Repeat this block for each issue where has_activity: true. Order by most activity first. -->

#### owner/repo#NUMBER — Title
| Field | Value |
|-------|-------|
| **State** | Open/Closed [changed: yes/no] |
| **Labels** | label1, label2 |
| **Your role** | Author / Commenter / Mentioned |

**What happened:**
<!-- Summarize new comments. Lead with the most important signal (maintainer/Anthropic responses). -->
- @username (DATE): summary of comment
- @username (DATE): summary of comment

**Duplicates & related:**
<!-- Only include if there are updates or new finds. Otherwise omit this sub-section. -->
- Known dupes — [updates or "No changes"]
- New finds — #NUMBER — @author, "Title" (DATE). Why related.

**Next steps:**
<!-- Concrete actions to take this check-in. Each should be actionable. -->
- [ ] Action description (target: owner/repo#NUMBER)

**Watch for:**
<!-- Lower-priority items to monitor on future check-ins. -->
- Signal to watch for

---

### No Activity

<!-- List all issues where has_activity: false. One line each. -->

| Issue | Last activity |
|-------|--------------|
| owner/repo#NUMBER — Title | DATE |
| owner/repo#NUMBER — Title | DATE |

---

### New Issues Not in Tracker

<!-- From general check agent. Issues involving the user that aren't tracked yet. -->

| Issue | Repo | Role | Recommendation |
|-------|------|------|----------------|
| #NUMBER — Title | owner/repo | author/commenter/mentioned | Track / Ignore (why) |

<!-- If none: "No new issues found involving @USERNAME since last check." -->

---

### Closed Issues Status

<!-- From general check agent. Confirm closed issues are still closed. -->

All [N] closed issues confirmed still closed.

<!-- OR if surprises: -->
<!-- **Reopened:** owner/repo#NUMBER — Title (was closed, now open again) -->

---

### Upstream Status

<!-- Only include if any tracked issues have upstream dependencies. -->

| Upstream issue | State | Impact |
|----------------|-------|--------|
| owner/repo#NUMBER | Open/Closed/Merged | Effect on downstream issue #NUMBER |

<!-- If no upstream issues tracked: omit this section entirely. -->

---

### Summary

**Action items:** [N] (listed above under "Next steps")
**Issues needing attention:** [list the most important 1-3 by owner/repo#NUMBER]
**All quiet:** [list repos/issues with no activity if notable]
