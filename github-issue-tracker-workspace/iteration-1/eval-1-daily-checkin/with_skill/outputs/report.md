# GitHub Issues Check-In -- 2026-04-06

**Tracking 32 active issues across 4 repos** | Last check: 2026-04-03

---

## New Issues Discovered

### ElliotDrel/Prompt-Vault#43 -- Fix prompt sharing: remove /dashboard/ from prompt URLs
- **Role:** Author (filed issue about broken sharing URLs that include /dashboard/ prefix)
- **State:** Open. No labels. 1 comment (CodeRabbit bot auto-plan).
- **Filed:** 2026-04-03
- **Summary:** You filed this on Apr 3 about broken prompt sharing URLs. When users copy the URL from their browser to share a prompt, it includes `/dashboard/` in the path, which requires authentication. Recipients clicking the link get an error instead of seeing the prompt. Even public prompts can't be shared. CodeRabbit bot posted an auto-generated plan linking related PRs (#15, #20, #21, #22).
- **Next Steps:** Fix the URL generation to use `/prompts/abc123` instead of `/dashboard/prompts/abc123` for sharing. This is your own repo -- you can implement the fix directly.

---

## Issues With Activity Since 2026-04-03

**None.** All 31 tracked issues are quiet.

---

## All Tracked Issues -- Status Summary

### anthropics/claude-code (15 issues)

| # | Issue | State | Last Activity | Next Step |
|---|-------|-------|---------------|-----------|
| 23146 | Ctrl+V in /resume conflicts with Windows paste | Open | 2026-03-24 | Monitoring -- no Anthropic response |
| 29934 | MCP OAuth fails with HTTPS redirect URIs | Open | 2026-03-24 | Waiting on Anthropic -- watch for @yash27-lab's patch |
| 33165 | Programmatic session rename API | Open | 2026-03-24 | Waiting on title registry implementation |
| 35153 | Bun segfault on Windows after long idle | Open | 2026-03-31 | Waiting on upstream oven-sh/bun#28175 |
| 38227 | Stash input to park half-written prompt | Open | 2026-04-03 | Monitoring |
| 38229 | MCP registry broken Slack setup command | Open | 2026-03-24 | Waiting on Anthropic docs/registry team |
| 38715 | Windows 11 legacy CLI missing standard keys | Open | 2026-03-31 | Monitoring -- defers to #23146 |
| 39567 | Slack plugin OAuth bug | Open | 2026-03-31 | Depends on #38229 fix |
| 39952 | Per-project OAuth tokens for MCP servers | Open | 2026-03-28 | Waiting on Anthropic design |
| 39992 | /btw clipboard copy support | Open | 2026-03-30 | Waiting on Anthropic triage |
| 40346 | Programmatic session rename via hooks/tools | Open | 2026-03-31 | Track alongside #33165 |
| 40693 | Bun crash + remote control lost (Windows) | Open | 2026-03-31 | Check if @brunomaida added data to upstream |
| 40781 | VS Code session name reverts after rename | Open | 2026-03-31 | Expect auto-closure as duplicate |
| 40787 | VS Code auto-title overwrites manual renames | Open | 2026-03-31 | Primary issue for rename race condition |
| 40945 | Chat rename reverts after switching chats | Open | 2026-03-31 | Should close as duplicate of #40787 |

### karthikcsq/google-tools-mcp (15 issues)

| # | Issue | State | Last Activity | Next Step |
|---|-------|-------|---------------|-----------|
| 1 | MCP server disconnects silently | Open | No comments | Waiting on maintainer |
| 2 | Add logging for disconnect/error causes | Open | No comments | Waiting on maintainer |
| 3 | Discourage delete+recreate pattern | Open | No comments | Waiting on maintainer |
| 4 | Add /feedback and /troubleshoot commands | Open | 2026-04-01 | Waiting on maintainer |
| 5 | Attendees don't receive email invites | Open | No comments | Waiting on maintainer |
| 6 | get_events only returns future events | Open | No comments | Waiting on maintainer |
| 7 | Unclear error for wrong param name format | Open | No comments | Waiting on maintainer |
| 8 | Return doc URLs in mutating Drive ops | Open | 2026-04-01 | Waiting on maintainer |
| 9 | modifyText inserts literal \\n | Open | No comments | Waiting on maintainer |
| 10 | modifyText matches wrong instance silently | Open | No comments | Waiting on maintainer |
| 11 | Encoding mismatch readDocument vs modifyText | Open | No comments | Waiting on maintainer |
| 12 | Editing tools should cross-reference descriptions | Open | No comments | Waiting on maintainer |
| 13 | modifyText no-ops on empty replacement | Open | No comments | Waiting on maintainer |
| 14 | Text has no explicit font color | Open | No comments | Waiting on maintainer |
| 15 | Upload local files to Google Drive | Open | No comments | Waiting on maintainer |

### oven-sh/bun (1 issue)

| # | Issue | State | Last Activity | Next Step |
|---|-------|-------|---------------|-----------|
| 28175 | Segfault after ~24h idle on Windows 11 | Open | 2026-03-31 | Waiting on Bun team |

### ElliotDrel/Prompt-Vault (1 issue -- NEW)

| # | Issue | State | Last Activity | Next Step |
|---|-------|-------|---------------|-----------|
| 43 | Fix prompt sharing: remove /dashboard/ from URLs | Open | 2026-04-03 | Fix URL routing (own repo) |

---

## Duplicate / Related Issue State Check

All known duplicates and related issues remain in their previously observed states:
- **anthropics/claude-code#38715** (dup of #23146): Still open
- **anthropics/claude-code#39567** (dup of #38229): Still open
- **All Bun segfault duplicates** (#21875, #22632, #36132, #40693, #30137, #21469): All still open
- **Upstream oven-sh/bun#28175**: Still open, no maintainer engagement

---

## Action Items

1. **ElliotDrel/Prompt-Vault#43** -- This is your own repo. Fix the URL routing to remove `/dashboard/` from shareable prompt URLs. This is the only actionable item today.

2. **karthikcsq/google-tools-mcp** -- 15 open issues with zero maintainer response. Consider whether to ping the maintainer or accept these may not get attention.

3. **anthropics/claude-code#40781 and #40945** -- Expected to be auto-closed as duplicates of #40787. Monitor for closure.

---

## Recently Closed (since last check)

All 7 recently closed issues were already tracked in the Closed section:
- gsd-build/get-shit-done#1518 (merged)
- gsd-build/get-shit-done#1499 (superseded)
- gsd-build/get-shit-done#1498 (implemented)
- anthropics/claude-code#36318 (duplicate)
- gsd-build/get-shit-done#1126 (merged)
- oven-sh/bun#28176 (duplicate)
- gsd-build/get-shit-done#876 (superseded)

No newly closed issues to add.
