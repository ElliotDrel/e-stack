# Adding or Editing an E-Stack Hook

Hooks are single Node scripts in `hooks/` that the installer copies to `~/.claude/hooks/` and registers in `~/.claude/settings.json`. Hooks are Claude Code-only; do not install them into `~/.agents/` or try to expose them through skill symlinks. Follow each phase in order. Do not skip phases.

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
- A `// @version x.y.z` comment near the top (new hooks start at `1.0.0`; **bump it on every edit** — `scripts/check-versions.cjs` blocks the release otherwise)

Then register the hook in `bin/install.cjs`:
- Add a `setup<Name>Hook(dryRun)` function modeled on the existing `setupStartupHook(dryRun)` and `setupRepoSearchNudgeHook(dryRun)`
- The function MUST be idempotent — scan existing `hooks.<event>[]` entries and bail out if a matching command is already there
- The function MUST honor `dryRun` — do the read-only idempotency check, then `if (dryRun) return true;` BEFORE writing `settings.json`, so a preview never mutates the user's config
- Wire the new setup call into `main()` alongside the existing setup calls, passing the global `DRY_RUN` through: `setup<Name>Hook(DRY_RUN)`

See `hooks/repo-search-nudge.js` and `setupRepoSearchNudgeHook()` for the canonical example. See also `docs/hook-authoring.md` for deeper guidance.

**For a new hook, list it in the docs** — the release gate (`node scripts/check-docs.cjs`) fails if either is missing it:

1. **README.md** — add a row to the Hooks table: `| **<name>** | <one-line purpose> |`
2. **CLAUDE.md** — add `<name>.js` to the "Hooks in the pack" line

Verify with `node scripts/check-docs.cjs`.

**Update `CHANGELOG.md`** — add an entry under `## [Unreleased]`:

- New hook: `### Added` — `` `<hook-name>` hook — <one-line user-facing description> ``
- Hook edit: `### Changed` or `### Fixed` as appropriate

See `docs/changelog.md` for format rules. Skip only for changes with zero user-visible effect.

## Phase 3: Review — APPROVAL GATE

Show the user what will change:

1. Diff the hook file against any existing installed copy:
   ```bash
   diff -u ~/.claude/hooks/<name>.js hooks/<name>.js
   ```
2. Describe the settings.json changes the installer will make (which `setup*Hook` runs, which matcher/command it appends).
3. Re-run preflight.
4. Ask: **"Ready to run the installer? This will copy the hook to ~/.claude/hooks/ and patch settings.json."**

   You can run `node bin/install.cjs` (no flags) first for a read-only dry-run preview — it reports whether the hook *would be* copied and whether settings.json *would be* patched, without writing anything.

Only after they confirm, apply with `--install` (run from the repo, the installer dry-runs by default):
```bash
node bin/install.cjs --install
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
