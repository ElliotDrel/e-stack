## Hook Authoring

A hook is a Node script in `hooks/<name>.js` that runs in response to a Claude Code lifecycle event (PostToolUse, PreToolUse, SessionStart, etc.). It reads a JSON payload from stdin, optionally writes JSON to stdout to inject context back to the model, and exits 0. The installer copies it to `~/.claude/hooks/<name>.js` and registers it in `~/.claude/settings.json`.

### Hook script shape

```js
#!/usr/bin/env node
// One-line purpose.
// Tunables at the top — change these to adjust behavior.

const TUNABLE_THING = 3;

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  try { run(input); } catch { /* never break the tool */ }
  process.exit(0);
});

function run(raw) {
  const payload = JSON.parse(raw);
  // ... logic ...
  if (shouldNudge) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "..."
      }
    }) + "\n");
  }
}
```

Key rules:

- Single-purpose, one file, stdlib only
- Stdin is JSON: `{ session_id, tool_name, tool_input, tool_response }` (PostToolUse) — fields vary by event type
- Always wrap the body in try/catch and exit 0 — a crash must NEVER break the underlying tool call
- Tunables (constants users might want to change) go at the top

### Output contract

To inject context into the conversation, write JSON to stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "..."
  }
}
```

`additionalContext` appears to the model as a system-reminder after the tool call. To stay silent, output nothing.

Other available fields: `systemMessage` (shown to the user in the terminal), `decision: "block"` (PostToolUse only, cancels the tool result) — see Claude Code docs for the full schema.

### Settings.json registration

Add a setup function in `bin/install.cjs` that idempotently patches `~/.claude/settings.json`. It MUST take a `dryRun` parameter and return before writing when previewing. Pattern (modeled on `setupStartupHook(dryRun)`):

1. Read `settings.json` (treat missing as `{}`).
2. Walk the relevant `hooks.<event>[]` array.
3. Look for an existing entry matching your hook by matcher string AND by command path containing your filename. If found, return `false`.
4. **If `dryRun` is true, return `true` now — before any write.** The read-only check in step 3 already ran, so the caller can still report "would add" vs "already configured" accurately.
5. Otherwise append a new group:

```js
{
  matcher: "WebFetch|WebSearch",  // tool name regex or "startup" for SessionStart
  hooks: [{
    type: "command",
    command: `node "${path.join(HOOKS_DIR, 'your-hook.js').replace(/\\/g, '/')}"`,
    timeout: 5
  }]
}
```

6. Write back. Return `true`.

Wire it into `main()` by passing the global `DRY_RUN` through: `const myHookInstalled = setupMyHook(DRY_RUN);`. This keeps the function honest during a preview — run locally from the repo (or with `--dry-run`), the installer reports what *would* change without touching `settings.json`.

The idempotency check is the entire point — `--startup` runs every session, so the same setup function fires repeatedly.

### Tunables convention

User-tunable values go as `const` at the top of the script. Example from `hooks/repo-search-nudge.js`:

```js
const SKILL_NAME = "estack-repo-search";
const NUDGE_EVERY = 3;
const STALE_DAYS = 7;
```

Users who clone the repo or install locally can edit these without touching the script's logic.

### Testing

Pipe-test with synthetic stdin before committing:

```bash
echo '{"session_id":"test-1","tool_name":"WebFetch","tool_input":{"url":"https://github.com/x/y"}}' \
  | node hooks/your-hook.js
```

Run multiple times to test stateful logic (counters, throttling, dedup files).

After installing, confirm `settings.json` is still valid JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/settings.json','utf8')); console.log('ok')"
```

### Canonical example

`hooks/repo-search-nudge.js` is the reference implementation. It demonstrates:

- Throttling via a JSON state file (`~/.claude/repo-search-nudge.json`) with atomic writes (write to `.tmp`, rename)
- Per-session counters keyed by `session_id`
- Stale entry sweeps
- Conditional nudge logic based on event type (always-fire for one tool, throttled for another)
