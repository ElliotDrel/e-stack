# Check-In -- 2026-04-05

## What Changed

No new activity across 32 tracked issues since last check on 2026-04-03. All issues remain open with the same status.

## New Issues Found

- **ElliotDrel/Prompt-Vault#43** -- Fix prompt sharing: remove /dashboard/ from prompt URLs. You filed this Apr 3. Sharing is broken because /dashboard/ prefix requires auth context. This is your own repo -- you can implement the routing fix directly.

## Recommended Actions

### Do Today
- **Prompt-Vault#43**: Implement the URL routing fix in your own repo -- move prompt routes from `/dashboard/prompts/{id}` to `/prompts/{id}` and add redirect for backwards compatibility. No external dependencies, no one to wait on.

### Watch For
- **anthropics/claude-code#29934**: Whether @yash27-lab's OAuth redirect patch gets merged upstream
- **oven-sh/bun#28175**: Any Bun team response or new release with Windows memory fixes (affects your #35153 and #40693)
- **anthropics/claude-code#40781, #40945**: May get auto-closed as duplicates of #40787 (3-day bot timer was set 2026-03-30)

### No Action Needed
- 15 anthropics/claude-code issues -- no maintainer response on any, all waiting on Anthropic
- 15 karthikcsq/google-tools-mcp issues -- no maintainer response on any, all waiting on maintainer
- 1 oven-sh/bun issue -- no Bun team engagement, recurring pattern of close-without-fix
