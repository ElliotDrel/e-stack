# Editing E-Stack Skills

Follow each phase in order. Do not skip phases.

## Phase 1: Pre-flight Diagnostics

Run the preflight script. It shows installed vs repo state, diffs, and frontmatter validation. Read-only — does not modify anything.

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"
```

(The script lives at `.claude/skills/e-stack/scripts/preflight.sh` if `CLAUDE_SKILL_DIR` is not set.)

Present the diagnostics to the user. If there are frontmatter issues, fix them before continuing.

## Phase 2: Make Changes

Edit the skill files in `skills/estack-*/` as needed. Conventions are in the main `SKILL.md`. Reminders:

- Skill folders prefixed with `estack-`
- `name` field matches the folder name
- `description` starts with `(<short-name>)`
- **Bump the skill's `version:` field** as part of the edit — patch (`1.0.0` → `1.0.1`) for fixes/tweaks, minor (`1.0.0` → `1.1.0`) for new capabilities, major for rewrites/breaking changes. Every content change needs a bump; `scripts/check-versions.cjs` blocks the release otherwise.
- Do NOT bump `package.json` version as part of an edit — the PACKAGE version bumps during release (`npm version`), not while editing skills. Only the per-SKILL version bumps here.

### Renaming or removing a skill

If this edit **renames** a skill (e.g. `estack-foo` → `estack-foo-coach`) or **removes** one entirely, the new/renamed folder alone is not enough — the installer only adds and updates, it never deletes. Without the step below, every existing user keeps the old folder *and* gets the new one (a duplicate).

Add the old folder name to the `DEPRECATED_SKILLS` array in `bin/install.cjs`:

```js
const DEPRECATED_SKILLS = [
  'estack-prompt-builder', // renamed to estack-prompt-builder-coach
  'estack-foo',            // renamed to estack-foo-coach   ← your new entry
];
```

On the next install (any mode), the installer deletes each listed folder from `~/.claude/skills/` and drops its checksum entry. Leave entries in the list permanently — they're cheap and protect users who update infrequently.

## Phase 3: Review — APPROVAL GATE

After all edits are complete, show the user what will change:

1. Run the diff for each changed skill:
   ```bash
   diff -ru ~/.agents/skills/<name> skills/<name>
   ```
2. Re-run preflight to verify frontmatter is valid and version bumps are in place (it runs `scripts/check-versions.cjs` — fix any `FAIL` lines, or run `node scripts/check-versions.cjs --fix` to auto-bump):
   ```bash
   bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"
   ```
3. Ask: **"Ready to run the installer? This will update your local skills in ~/.agents/skills/ and ~/.claude/skills/."**

Only after they confirm, run the installer with `--install` (run from the repo it dry-runs by default and writes nothing):
```bash
node bin/install.cjs --install
```

Tip: you can run `node bin/install.cjs` (no flags) first for a read-only preview of exactly what would change — that preview is itself the diff to show before confirming.

Then re-run preflight to verify everything installed correctly. If anything fails, stop and fix.

## Phase 4: Route to Publish

After successful install, ask: **"Want to publish to npm?"**

If yes, follow `steps/publish.md`.
