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
- Do NOT bump `package.json` version as part of an edit — version bumps happen during release (`npm version`), not while editing skills

## Phase 3: Review — APPROVAL GATE

After all edits are complete, show the user what will change:

1. Run the diff for each changed skill:
   ```bash
   diff -ru ~/.claude/skills/<name> skills/<name>
   ```
2. Re-run preflight to verify frontmatter is valid:
   ```bash
   bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"
   ```
3. Ask: **"Ready to run the installer? This will overwrite your local skills in ~/.claude/skills/."**

Only after they confirm, run:
```bash
node bin/install.cjs
```

Then re-run preflight to verify everything installed correctly. If anything fails, stop and fix.

## Phase 4: Route to Publish

After successful install, ask: **"Want to publish to npm?"**

If yes, follow `steps/publish.md`.
