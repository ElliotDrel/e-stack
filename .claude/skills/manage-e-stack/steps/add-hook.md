# Adding or Editing an E-Stack Hook

Hooks are single Node scripts in `hooks/` that the installer copies to `~/.claude/hooks/` and registers in `~/.claude/settings.json`. Follow each phase in order. Do not skip phases.

## Phase 1: Pre-flight Diagnostics

Run the preflight script. It reports installed-vs-repo state for both skills and hooks. Read-only.

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"
```

(The script lives at `.claude/skills/manage-e-stack/scripts/preflight.sh` if `CLAUDE_SKILL_DIR` is not set.)

Present the diagnostics. If the hook you intend to edit shows as STALE or modified, decide before continuing whether to keep local edits or overwrite.

## Phase 2: Author the Hook

A hook lives at `hooks/<name>.js` (flat, no subfolders). It is a single self-contained Node script using only stdlib.

Required shape:
- Read JSON from stdin (event payload, e.g. `{ session_id, tool_name, tool_input, tool_response }`)
- Optionally write a JSON object to stdout to inject `additionalContext` back to the model
- Wrap the body in `try { ... } catch { /* never break the tool */ }` and exit 0 — a hook crash MUST NOT break the underlying tool call
- Tunables (skill name, thresholds, timeouts) go as `const` at the top

Then register the hook in `bin/install.cjs`:
- Add a `setup<Name>Hook()` function modeled on the existing `setupStartupHook()` and `setupRepoSearchNudgeHook()`
- The function MUST be idempotent — scan existing `hooks.<event>[]` entries and bail out if a matching command is already there
- Wire the new setup call into `main()` alongside the existing setup calls

See `hooks/repo-search-nudge.js` and `setupRepoSearchNudgeHook()` for the canonical example. See also `docs/hook-authoring.md` for deeper guidance.

## Phase 3: Review — APPROVAL GATE

Show the user what will change:

1. Diff the hook file against any existing installed copy:
   ```bash
   diff -u ~/.claude/hooks/<name>.js hooks/<name>.js
   ```
2. Describe the settings.json changes the installer will make (which `setup*Hook` runs, which matcher/command it appends).
3. Re-run preflight.
4. Ask: **"Ready to run the installer? This will copy the hook to ~/.claude/hooks/ and patch settings.json."**

Only after they confirm:
```bash
node bin/install.cjs
```

Then re-run preflight to verify the install landed.

## Phase 4: Verify

Pipe-test the installed hook with a synthetic stdin payload:

```bash
echo '{"tool_name":"WebFetch","tool_input":{"url":"https://example.com"},"session_id":"test-1"}' \
  | node ~/.claude/hooks/<name>.js
```

(Adjust the payload for your hook's event type.)

Confirm settings.json is still valid JSON:
```bash
node -e "JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/settings.json','utf8')); console.log('ok')"
```

Confirm the hook entry is present in settings.json under the expected event.

## Phase 5: Route to Publish

Ask: **"Want to publish to npm?"**

If yes, follow `steps/publish.md`. Publishing is triggered by pushing a `v*` tag, not by a commit message.
