# GitHub Issues Check-In Report

**Date:** 2026-04-05
**User:** ElliotDrel
**Repos monitored:** anthropics/claude-code, karthikcsq/google-tools-mcp, oven-sh/bun

---

## Summary

**Total open issues involving ElliotDrel:** 31 (across all repos)
- anthropics/claude-code: 15 issues
- karthikcsq/google-tools-mcp: 15 issues
- oven-sh/bun: 1 issue

**Changes since last check-in (April 3):** No new comments or state changes on any tracked issue. All issues remain open with no maintainer responses since the last update.

---

## Issues By Repo

### anthropics/claude-code (15 open issues)

#### Issues You Authored (5)

| # | Title | Filed | Last Updated | Comments | Status |
|---|-------|-------|-------------|----------|--------|
| [#35153](https://github.com/anthropics/claude-code/issues/35153) | Bun segfault on Windows after long idle sessions | Mar 17 | Mar 31 | 3 | No maintainer response. Upstream at oven-sh/bun#28175. |
| [#38229](https://github.com/anthropics/claude-code/issues/38229) | MCP registry generates broken Slack setup command | Mar 24 | Mar 24 | 2 | Survived auto-close bot. No maintainer response. |
| [#39952](https://github.com/anthropics/claude-code/issues/39952) | Per-project OAuth tokens for MCP servers | Mar 27 | Mar 28 | 3 | Survived auto-close bot. No maintainer response. |
| [#39992](https://github.com/anthropics/claude-code/issues/39992) | Add clipboard copy for /btw output | Mar 27 | Mar 30 | 1 | 1 community workaround (tmux). No maintainer response. |
| [#38227](https://github.com/anthropics/claude-code/issues/38227) | Stash input to park half-written prompts | Mar 24 | **Apr 3** | 2 | You commented Apr 3 about silent overwrite. No maintainer response. |

#### Issues You Commented On (10)

| # | Title | Filed | Last Updated | Comments | Status |
|---|-------|-------|-------------|----------|--------|
| [#23146](https://github.com/anthropics/claude-code/issues/23146) | Ctrl+V in /resume conflicts with Windows paste | Feb 4 | Apr 1 | 5 | No maintainer response. Canonical keybinding issue. |
| [#29934](https://github.com/anthropics/claude-code/issues/29934) | MCP OAuth fails with HTTPS redirect URIs | Mar 1 | Mar 24 | 9 | Community workarounds exist. No official fix. |
| [#33165](https://github.com/anthropics/claude-code/issues/33165) | Allow Claude to rename its own session | Mar 11 | Mar 24 | 7 | Hub issue for all session rename problems. Labeled `duplicate` (possibly stale). |
| [#38715](https://github.com/anthropics/claude-code/issues/38715) | Windows legacy CLI missing standard keys | Mar 25 | Mar 31 | 3 | Defers to #23146 for broader fix. |
| [#39567](https://github.com/anthropics/claude-code/issues/39567) | Slack plugin OAuth flow bug | Mar 26 | Mar 31 | 2 | Labeled `duplicate`. Depends on #38229 fix. |
| [#40346](https://github.com/anthropics/claude-code/issues/40346) | Programmatic session renaming via hooks | Mar 28 | Mar 31 | 3 | Related to #33165. No maintainer response. |
| [#40693](https://github.com/anthropics/claude-code/issues/40693) | Remote control lost + Bun crash on Windows | Mar 29 | Mar 31 | 3 | Same Bun segfault pattern as #35153. Reporter confirmed VS Code UI blocking as secondary trigger. |
| [#40781](https://github.com/anthropics/claude-code/issues/40781) | Session name reverts after manual rename (VSCode) | Mar 30 | Mar 31 | 3 | Likely duplicate of #40787. May auto-close. |
| [#40787](https://github.com/anthropics/claude-code/issues/40787) | Auto-title overwrites manually renamed sessions | Mar 30 | Mar 31 | 2 | Best root cause analysis (78 JSONL entries). Primary issue for rename race condition. |
| [#40945](https://github.com/anthropics/claude-code/issues/40945) | Chat rename reverts after switching chats | Mar 30 | Mar 31 | 3 | Duplicate of #40787. Should auto-close. |

---

### karthikcsq/google-tools-mcp (15 open issues)

All authored by ElliotDrel. **Zero maintainer responses on any issue.** The repo appears to have low maintainer activity.

| # | Title | Filed | Last Updated | Comments |
|---|-------|-------|-------------|----------|
| [#1](https://github.com/karthikcsq/google-tools-mcp/issues/1) | MCP server disconnects silently during active session | Mar 31 | Mar 31 | 0 |
| [#2](https://github.com/karthikcsq/google-tools-mcp/issues/2) | Add logging for disconnect/error causes | Mar 31 | Mar 31 | 0 |
| [#3](https://github.com/karthikcsq/google-tools-mcp/issues/3) | Tool description should discourage delete+recreate for event edits | Mar 31 | Mar 31 | 0 |
| [#4](https://github.com/karthikcsq/google-tools-mcp/issues/4) | Add /feedback and /troubleshoot slash commands | Mar 31 | Apr 1 | 1 (you) |
| [#5](https://github.com/karthikcsq/google-tools-mcp/issues/5) | Attendees don't receive email invites (missing sendUpdates) | Mar 31 | Mar 31 | 0 |
| [#6](https://github.com/karthikcsq/google-tools-mcp/issues/6) | get_events only returns future events | Mar 31 | Mar 31 | 0 |
| [#7](https://github.com/karthikcsq/google-tools-mcp/issues/7) | Unclear error for wrong parameter name format | Mar 31 | Mar 31 | 0 |
| [#8](https://github.com/karthikcsq/google-tools-mcp/issues/8) | Return document URLs in mutating Drive responses | Mar 31 | Apr 1 | 1 (you) |
| [#9](https://github.com/karthikcsq/google-tools-mcp/issues/9) | modifyText inserts literal \n instead of newlines | Apr 1 | Apr 1 | 0 |
| [#10](https://github.com/karthikcsq/google-tools-mcp/issues/10) | modifyText silently matches first global instance | Apr 1 | Apr 1 | 0 |
| [#11](https://github.com/karthikcsq/google-tools-mcp/issues/11) | Text encoding mismatch between readDocument and modifyText | Apr 1 | Apr 1 | 0 |
| [#12](https://github.com/karthikcsq/google-tools-mcp/issues/12) | Document editing tools should cross-reference each other | Apr 1 | Apr 1 | 0 |
| [#13](https://github.com/karthikcsq/google-tools-mcp/issues/13) | modifyText silently no-ops when replacement text is empty | Apr 1 | Apr 1 | 0 |
| [#14](https://github.com/karthikcsq/google-tools-mcp/issues/14) | Text inserted by editing tools has no explicit font color | Apr 1 | Apr 1 | 0 |
| [#15](https://github.com/karthikcsq/google-tools-mcp/issues/15) | Feature: Upload local files to Google Drive | Apr 2 | Apr 2 | 0 |

---

### oven-sh/bun (1 open issue)

| # | Title | Filed | Last Updated | Comments | Status |
|---|-------|-------|-------------|----------|--------|
| [#28175](https://github.com/oven-sh/bun/issues/28175) | Segfault after ~24h idle on Windows 11 | Mar 17 | Mar 31 | 3 | @dylan-conway was subscribed/mentioned (Mar 18) but hasn't commented. You added 3rd crash instance (active use, not idle). No fix. |

---

### Other Repos (not in scope but found open)

| Repo | # | Title | Filed |
|------|---|-------|-------|
| ElliotDrel/Prompt-Vault | [#43](https://github.com/ElliotDrel/Prompt-Vault/issues/43) | Fix prompt sharing: remove /dashboard/ from URLs | Apr 3 |
| dotnetfactory/fluid-calendar | [#129](https://github.com/dotnetfactory/fluid-calendar/issues/129) | End Time in Auto Schedule uses 24h clock | Jun 2025 |
| dotnetfactory/fluid-calendar | [#130](https://github.com/dotnetfactory/fluid-calendar/issues/130) | Working hours should sync between calendar and auto-schedule | Jun 2025 |

---

## What Changed Since Last Check-In (April 3)

**Nothing significant.** No new comments from maintainers or other users on any tracked issue. No state changes. No new labels added.

The only activity was:
- **#38227** (stash input): Your comment was posted on Apr 3 about silent overwrite behavior -- this was already captured in the last check-in.
- **Prompt-Vault#43**: CodeRabbit bot auto-generated a plan comment on Apr 3. This is your own repo.

---

## Issue Clusters & Relationships

### Cluster 1: Bun Segfault on Windows
- **Primary:** #35153 (your issue) + oven-sh/bun#28175 (upstream)
- **Duplicates:** #21875, #22632, #36132, #40693, #30137, #21469
- **Status:** No upstream fix. @dylan-conway subscribed but silent. Multiple reports confirm mimalloc memory growth as root cause.

### Cluster 2: Session Rename/Title Persistence
- **Primary:** #33165 (comprehensive analysis), #40787 (race condition proof)
- **Duplicates/Related:** #40781, #40945, #40346, #32150
- **Status:** No maintainer response. Two distinct root causes identified (race condition + 64KB tail-scan).

### Cluster 3: MCP/OAuth/Slack
- **Primary:** #38229 (broken registry command), #29934 (HTTPS redirect)
- **Related:** #39567 (labeled duplicate), #39952 (per-project tokens)
- **Status:** No maintainer response. Workaround: `claude plugin install slack`.

### Cluster 4: Windows Keybinding Conflicts
- **Primary:** #23146
- **Related:** #38715, #36318 (closed duplicate)
- **Status:** No maintainer response. No configurable keybinding support.

---

## Recommended Next Steps

1. **No action needed today.** All issues are stable with no new activity requiring response.

2. **google-tools-mcp: Consider pinging maintainer.** 15 issues filed over 5 days with zero maintainer responses. Worth checking if the maintainer is active -- look at recent commits or reach out directly.

3. **oven-sh/bun#28175: Monitor for Bun releases.** @dylan-conway (Bun core team) was auto-subscribed Mar 18 but hasn't responded. A new Bun release could silently fix this. Check `bun --version` periodically.

4. **Session rename cluster (#40781, #40945): Expected to auto-close** as duplicates of #40787. No action needed -- the analysis is already posted.

5. **Prompt-Vault#43: This is your repo.** If the fix is straightforward, implement it. CodeRabbit already generated a plan.
