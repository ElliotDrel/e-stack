# Editing E-Stack Skills

Follow each phase in order. Do not skip phases.

## Phase 1: Pre-flight Diagnostics

Run the preflight script. It shows installed vs repo state, diffs, and frontmatter validation. Read-only — does not modify anything.

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"
```

(The script lives at `.agents/skills/manage-e-stack/scripts/preflight.sh` if `CLAUDE_SKILL_DIR` is not set.)

Present the diagnostics to the user. If there are frontmatter issues, fix them before continuing.

## Phase 2: Make Changes

Edit the skill files in `skills/estack-*/` as needed. Conventions are in the main `SKILL.md`. Reminders:

- Skill folders prefixed with `estack-`
- `name` field matches the folder name
- `description` starts with `(<short-name>)`
- **Bump the skill's `version:` field** as part of the edit — patch (`1.0.0` → `1.0.1`) for fixes/tweaks, minor (`1.0.0` → `1.1.0`) for new capabilities, major for rewrites/breaking changes. Every content change needs a bump; `scripts/check-versions.cjs` blocks the release otherwise.
- **If the edit changes what the skill is or does**, update its row in the README.md Skills table and (for renames) the AGENTS.md "Skills in the pack" line. `node scripts/check-docs.cjs` catches missing/stale names but not stale descriptions — keep those honest manually.
- Do NOT bump `package.json` version as part of an edit — the PACKAGE version bumps during release (`npm version`), not while editing skills. Only the per-SKILL version bumps here.
- **Update `CHANGELOG.md`** — add an entry under `## [Unreleased]` describing the user-visible change. Use `### Changed` for behavior updates, `### Fixed` for bug fixes, `### Removed` for anything removed. See `docs/changelog-maintenance.md` for format rules. Skip this only for changes with zero user-visible effect (e.g. fixing a comment or internal refactor).

### Renaming or removing a skill

If this edit **renames** a skill (e.g. `estack-foo` → `estack-foo-coach`) or **removes** one entirely, deleting the old folder from `skills/` is all the installer needs. On the next install (any mode) it compares its checksum manifest against what the package ships and retires anything it recorded installing that is gone — removing the folder from both `~/.agents/skills/` and `~/.claude/skills/` (real dir or symlink) and dropping the manifest entry. Because the manifest lists only what the installer itself put on disk, a skill the user added never matches.

**Do NOT add to `DEPRECATED_SKILLS` in `bin/install.cjs`.** That array is legacy-only. It holds two names retired before manifest pruning existed, where an install old enough may have no manifest entry to prune. A hand-maintained list is exactly how `read-transcript-v1` stayed orphaned in every user's manifest unnoticed.

A rename/remove also requires updating the docs: fix the skill's row in the README.md Skills table and the AGENTS.md "Skills in the pack" line, then verify with `node scripts/check-docs.cjs` — it flags both missing and stale entries, and the publish workflow runs it as a hard gate.

## Phase 3: Review — APPROVAL GATE

After all edits are complete, show the user what will change:

1. Run the diff for each changed skill:
   ```bash
   diff -ru ~/.agents/skills/<name> skills/<name>
   ```
2. Re-run preflight to verify frontmatter is valid, version bumps are in place, and the docs are in sync (it runs `scripts/check-versions.cjs` and `scripts/check-docs.cjs` — fix any `FAIL` lines, or run `node scripts/check-versions.cjs --fix` to auto-bump versions):
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

## Phase 4: Route to Prep or Publish

After successful install, ask: **"Publish to npm now, or just prep for a later release?"**

- **Publish now** → follow `steps/publish.md`
- **Prep only** (other work in flight; a later session publishes) → follow `steps/prep.md`
- **Neither** → done, but note the work still needs a prep or publish pass before it ships
