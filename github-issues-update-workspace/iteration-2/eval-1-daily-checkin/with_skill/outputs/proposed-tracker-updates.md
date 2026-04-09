# Proposed Tracker Updates -- 2026-04-05

These are the changes that WOULD be applied to `$HOME/OneDrive/Documents/github-tracker.md` if the user confirms.

---

## New Entry to Add

### ElliotDrel/Prompt-Vault#43 -- Fix prompt sharing: remove /dashboard/ from prompt URLs
- **Role:** Author (filed bug identifying /dashboard/ prefix breaks prompt sharing for recipients)
- **Filed:** 2026-04-03
- **Status as of 2026-04-05:** Open. No labels. 1 comment (bot only). Your own repo -- implement directly.
- **What to check:** Whether you've implemented the fix yet.
- **Related:** PRs #15, #20, #21, #22, #25 (all merged, all prompt navigation related)
- **Key technical data:**
  - Before: `/dashboard/prompts/{id}` (requires auth context)
  - After: `/prompts/{id}` (works for anyone)
  - Existing `/dashboard/prompts/...` URLs should redirect for backwards compatibility
  - No workaround exists currently
- **Next steps (now):** Implement the fix -- this is your own repo.
- **Future:** Simple routing change. Add redirect from old `/dashboard/prompts/` path.
- **History:**
  - **2026-04-03:** Filed issue
  - **2026-04-05:** Added to tracker. First analysis.

---

## History Entries to Append (all existing issues)

Each existing active issue would get one new history line appended:

### anthropics/claude-code#23146
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#29934
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#33165
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#35153
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#38227
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#38229
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#38715
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#39567
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#39952
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#39992
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#40346
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#40693
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#40781
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#40787
- **2026-04-05:** Checked -- no change

### anthropics/claude-code#40945
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#1
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#2
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#3
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#4
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#5
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#6
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#7
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#8
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#9
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#10
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#11
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#12
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#13
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#14
- **2026-04-05:** Checked -- no change

### karthikcsq/google-tools-mcp#15
- **2026-04-05:** Checked -- no change

### oven-sh/bun#28175
- **2026-04-05:** Checked -- no change

---

## Status-as-of Date Updates

All 31 existing issues would have their "Status as of" date updated from 2026-04-03 to 2026-04-05 with no other status changes (all remain open, same labels, same comment counts).

---

## No Changes to Closed/Resolved Section

The recently_closed issues (gsd-build/get-shit-done#1518, #1499, #1498; anthropics/claude-code#36318; gsd-build/get-shit-done#1126, #876; oven-sh/bun#28176) are already present in the tracker's Closed/Resolved section.
