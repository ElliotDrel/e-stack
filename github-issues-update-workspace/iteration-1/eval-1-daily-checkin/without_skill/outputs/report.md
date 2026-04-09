# GitHub Issues Check-In Report

**Date:** 2026-04-05
**User:** ElliotDrel
**Repos monitored:** anthropics/claude-code, karthikcsq/google-tools-mcp, oven-sh/bun

---

## Summary

- **Total open issues involving ElliotDrel:** 32
- **Issues authored by ElliotDrel:** 22
- **Issues where ElliotDrel is a commenter:** 10
- **Issues with new activity since last tracker update (2026-04-03):** 0
- **Anthropic team responses on any issue:** 0

**Bottom line:** No new activity across any tracked issue since the last check-in on 2026-04-03. None of your issues have received an Anthropic team response.

---

## By Repository

### anthropics/claude-code (12 issues)

#### Issues You Authored

| # | Title | Filed | Labels | Last Activity | Status |
|---|-------|-------|--------|---------------|--------|
| 35153 | Bun segfault on Windows after long idle sessions | 2026-03-17 | bug, platform:windows, area:core | 2026-03-31 (you added 3rd crash) | No response. Waiting on upstream Bun fix. |
| 38229 | MCP registry generates broken Slack setup command | 2026-03-24 | bug, platform:windows, area:mcp, area:docs | 2026-03-24 (defended against false dup) | No response. Survived auto-close. |
| 39952 | Per-project OAuth tokens for MCP servers | 2026-03-27 | enhancement, area:auth, area:mcp | 2026-03-28 (posted workaround) | No response. Survived auto-close. |
| 39992 | Clipboard copy for /btw output (C keybinding) | 2026-03-27 | enhancement, area:tui | 2026-03-30 (community workaround) | No response. Low traction. |

#### Issues You Commented On

| # | Title | Your Role | Last Activity | Status |
|---|-------|-----------|---------------|--------|
| 23146 | Ctrl+V in /resume conflicts with Windows paste | Broadened scope to all hardcoded shortcuts | 2026-03-24 (your comment) | 5 comments, no Anthropic response |
| 29934 | MCP OAuth fails with HTTPS redirect URIs | Confirmed bug, linked to #38229 | 2026-03-24 (your resolution comment) | @rajivpant confirmed working v2.1.81. Fork exists with fix. |
| 33165 | Programmatic session rename API | Shared /better-title skill workaround | 2026-03-24 (@interconnectedMe replied) | Hub issue for all title bugs. Labeled `duplicate` (possibly stale). |
| 38227 | Stash input to park half-written prompts | Flagged silent overwrite, proposed stack | 2026-04-03 (your comment) | Low activity. 2 community comments. |
| 38715 | Windows legacy CLI missing standard keys | Linked to #23146 | 2026-03-31 (your comment) | Re-report of auto-closed #26887. |
| 39567 | Slack plugin OAuth bug | Identified root cause as #38229 | 2026-03-31 (your comment) | Labeled `duplicate`. Should close with #38229 fix. |
| 40346 | Session rename via hooks/tools | Linked to #33165, shared workaround | 2026-03-31 (your comment) | 3 comments. Same request as #33165. |
| 40693 | Bun crash + remote control lost on Windows | Linked to #35153 | 2026-03-31 (brunomaida replied) | Different root cause (UI blocking). |
| 40781 | Session name reverts after manual rename (VS Code) | Linked to #40787 and #33165 | 2026-03-31 (your comment) | Duplicate cluster with #40787, #40945. |
| 40787 | Auto-title overwrites manual renames (VS Code) | Confirmed two separate root causes | 2026-03-31 (your comment) | Has race condition root cause analysis. |
| 40945 | Chat rename reverts after switching chats (VS Code) | Linked to #40787 and #33165 | 2026-03-31 (your comment) | Part of the same title-revert cluster. |

---

### karthikcsq/google-tools-mcp (15 issues -- all authored by you)

| # | Title | Filed | Comments | Last Activity |
|---|-------|-------|----------|---------------|
| 1 | MCP server disconnects silently | 2026-03-31 | 0 | 2026-03-31 |
| 2 | Add logging for disconnect/error causes | 2026-03-31 | 0 | 2026-03-31 |
| 3 | Tool description should discourage delete+recreate for event edits | 2026-03-31 | 0 | 2026-03-31 |
| 4 | Add /feedback and /troubleshoot slash commands | 2026-03-31 | 1 (you) | 2026-04-01 |
| 5 | Attendees don't receive email invites (sendUpdates missing) | 2026-03-31 | 0 | 2026-03-31 |
| 6 | get_events only returns future events | 2026-03-31 | 0 | 2026-03-31 |
| 7 | Unclear error for wrong parameter name format | 2026-03-31 | 0 | 2026-03-31 |
| 8 | Return document URLs in mutating Drive responses | 2026-04-01 | 2 (you) | 2026-04-01 |
| 9 | modifyText inserts literal `\n` instead of newlines | 2026-04-01 | 0 | 2026-04-01 |
| 10 | modifyText silently matches first global instance | 2026-04-01 | 0 | 2026-04-01 |
| 11 | Text encoding mismatch between readDocument and modifyText | 2026-04-01 | 0 | 2026-04-01 |
| 12 | Editing tools should cross-reference each other | 2026-04-01 | 0 | 2026-04-01 |
| 13 | modifyText silently no-ops on empty replacement text | 2026-04-01 | 0 | 2026-04-01 |
| 14 | Inserted text has no explicit font color | 2026-04-01 | 0 | 2026-04-01 |
| 15 | Feature: Upload local files to Google Drive | 2026-04-02 | 0 | 2026-04-02 |

**Status:** Zero maintainer responses on any of the 15 issues. The repo owner (@karthikcsq) has not engaged with any of your bug reports or feature requests.

---

### oven-sh/bun (1 issue)

| # | Title | Filed | Comments | Last Activity |
|---|-------|-------|----------|---------------|
| 28175 | Segfault after ~24h idle on Windows 11 with sleep/wake | 2026-03-17 | 2 (both you) | 2026-03-31 (you added active-use crash) |

**Status:** No maintainer response. Bot flagged duplicates (#24804, #23399, #18352) -- all previously closed without fix. You noted the bug has been reported and closed repeatedly since Bun v1.2.5.

---

## Duplicate/Related Issue Clusters

### Session Title Bugs (claude-code)
A cluster of 5+ issues all about session titles reverting or disappearing:
- **#33165** -- hub issue, most comprehensive root cause analysis
- **#40787** -- race condition where webview sends stale cached title
- **#40781**, **#40945** -- same symptom, different reporters
- **#40346** -- feature request for programmatic rename (hooks/tools)
- You commented on all of these, linking them together and sharing your /better-title workaround.

### Slack MCP OAuth (claude-code)
- **#38229** (yours) -- root cause: registry generates broken setup command
- **#29934** -- HTTPS redirect URI issue
- **#39567** -- downstream symptom, labeled duplicate
- Workaround documented: `claude plugin install slack`

### Windows Keybinding Conflicts (claude-code)
- **#23146** -- canonical issue (Ctrl+V, Ctrl+W, Meta+P)
- **#38715** -- legacy CLI variant
- **#36318** (yours, closed) -- duplicate of #23146

### Bun Segfault on Windows
- **#35153** (yours, claude-code) and **#28175** (yours, oven-sh/bun)
- Related: #21875 (78 crashes), #40693, #36132 (mimalloc analysis)
- Upstream Bun issue has been closed repeatedly without fix since v1.2.5

---

## Recommended Next Steps

### No action needed (monitoring)
- All 12 anthropics/claude-code issues -- no new activity, no Anthropic responses. Continue monitoring.
- oven-sh/bun#28175 -- no upstream movement. Keep watching.

### Consider follow-up
1. **karthikcsq/google-tools-mcp**: You filed 15 issues with zero engagement from the maintainer. It has been 4-5 days since the first batch. Consider:
   - Checking if the repo is actively maintained (last commit date, other recent PRs)
   - Sending a single consolidated ping or reaching out to the maintainer directly
   - If unmaintained, consider forking or finding alternatives

2. **anthropics/claude-code#38229** (Slack MCP registry bug): This is the root cause behind multiple Slack OAuth issues. If Anthropic deploys a new Claude Code version, re-check whether the registry command was updated.

3. **anthropics/claude-code#33165** (session rename): The `duplicate` label on this issue seems incorrect -- it's the most comprehensive analysis. If auto-closure threatens it, consider commenting.

### Watch for
- New Claude Code releases that bump the Bun version (would affect #35153)
- Any Anthropic triage sweep that addresses the session title cluster
- karthikcsq/google-tools-mcp maintainer activity

---

## Other Open Issues (outside target repos)

| Repo | # | Title | Filed |
|------|---|-------|-------|
| ElliotDrel/Prompt-Vault | 43 | Fix prompt sharing: remove /dashboard/ from URLs | 2026-04-03 |
| dotnetfactory/fluid-calendar | 129 | End Time in Settings uses 24h when 12h is selected | 2025-06-11 |
| dotnetfactory/fluid-calendar | 130 | Working hours should sync between calendar and Auto Schedule | 2025-06-11 |

These are outside the three monitored repos. The fluid-calendar issues are nearly a year old with no updates.
