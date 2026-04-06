# GitHub Issue Tracker

GitHub username: **USERNAME_HERE**

## Config

<!-- Directives for the check-in skill. Write in plain English. Examples:
- "Skip issues on my own repos (ElliotDrel/*)"
- "Only track issues on anthropics/claude-code and oven-sh/bun"
- "Don't show me bot comments or auto-close spam"
-->

Tracked repos: all repos where I'm involved
Excluded repos: none

---

## Active Issues (watching for updates)

<!-- For each issue you're tracking, use this format:

### owner/repo#NUMBER — Title
- **Role:** Author | Commenter | Mentioned (brief description of involvement)
- **Filed:** YYYY-MM-DD (if authored by you)
- **Status as of YYYY-MM-DD:** Open/Closed. Labels: ... . Summary of current state.
- **What to check:** What signals matter for this issue?
- **Related:** #other, #issues (if any)
- **Upstream:** owner/repo#NUMBER (if tracking an upstream dependency)
- **Duplicates found (YYYY-MM-DD):**
  - **#NUMBER** — @author, "Title" (date). Why it's related.
- **Next steps (now):** Immediate actions to take this check-in.
- **Future:** Things to monitor or do later.
- **History:**
  - **YYYY-MM-DD:** Filed issue (or "Added to tracker for monitoring")
-->

## Closed / Resolved

<!-- For each resolved issue:

### owner/repo#NUMBER — Title
- Brief resolution note (merged, auto-closed as duplicate, etc.)
-->

---

## Morning Check-In Procedure

Run this to get a quick status update on all active issues:

```bash
gh api search/issues?q=involves:USERNAME_HERE+updated:>$(python3 -c "import datetime; print((datetime.datetime.now()-datetime.timedelta(days=7)).strftime('%Y-%m-%d'))")+is:open --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [updated: \(.updated_at)]"'
```

Then for each issue, check recent comments:
```bash
gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '.[-3:] | .[] | "[\(.created_at)] @\(.user.login): \(.body[0:200])"'
```
