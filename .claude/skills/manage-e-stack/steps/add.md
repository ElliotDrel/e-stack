# Adding a Skill to E-Stack

Follow these steps in order. Adding a skill is separate from releasing it — version bumps happen at release time (`steps/publish.md`), not while adding.

## 1. Create the skill folder

> **Migrating an existing skill?** Apply the universal "prefer deterministic changes" convention: copy the folder with `cp -r` / `xcopy /E /I` / `robocopy /E`, then use the Edit tool for targeted changes only (frontmatter `name:`, `description:` prefix, etc.).

```
skills/estack-<skill-name>/SKILL.md
```

The folder MUST be prefixed with `estack-`. The `SKILL.md` needs frontmatter with the name ALSO prefixed with `estack-`:

```markdown
---
name: estack-<skill-name>
version: 1.0.0
description: (<skill-name>) <one-line description — this shows up in the skill list>
---
```

Both the folder and the `name` field use the `estack-` prefix. The `description` MUST start with `(<skill-name>)` (the short name without the prefix). This namespaces the skill correctly when installed to `~/.agents/skills/` (symlinked into `~/.claude/skills/`). New skills always start at `version: 1.0.0` — this per-skill version is independent of the package version and gets bumped whenever the skill is later edited (see `steps/edit.md`).

Add any supporting files (references, steps, scripts) in subfolders as needed.

## 2. Stamp the feedback section

Run the feedback template script to add the standard `## Skill Feedback` section:

```bash
node scripts/update-skill-feedback.cjs
```

Every skill must have this section. The script writes it from `scripts/skill-feedback-template.md` — do not write or edit the feedback section manually.

## 3. List the skill in the docs

Add the new skill to both doc lists — the release gate (`node scripts/check-docs.cjs`) fails if either is missing it:

1. **README.md** — add a row to the Skills table (alphabetical order): `| **<Title>** | \`/estack-<skill-name>\` | <one-line description> |`
2. **CLAUDE.md** — add `estack-<skill-name>` to the "Skills in the pack" line (alphabetical order)

Verify:

```bash
node scripts/check-docs.cjs
```

## 4. Update the CHANGELOG

Add an entry to the `## [Unreleased]` section at the top of `CHANGELOG.md`:

```markdown
### Added
- `estack-<skill-name>` skill — <one-line user-facing description of what it does>
```

Write from the installer's perspective — what does the user gain? See `docs/changelog-maintenance.md` for format rules and examples. Do not write internal implementation details.

## 5. Show the diff (if migrating from an existing skill — optional)

If the skill already exists somewhere (e.g. `~/.agents/skills/` or `~/.claude/skills/`), diff it:

```bash
diff -ru ~/.agents/skills/<skill-name> skills/estack-<skill-name>
```

Show the output and ask for confirmation before proceeding.

## 6. Delete the old copy (if migrating)

Remove both the real files and the symlink (if either exists):

```bash
rm -rf ~/.agents/skills/<old-skill-name>
rm -rf ~/.claude/skills/<old-skill-name>
```

## 7. Run the installer

```bash
node bin/install.cjs            # dry run — preview what would change, writes nothing
node bin/install.cjs --install  # actually copy skills to ~/.agents/skills/ + symlink into ~/.claude/skills/
```

Run from the repo, the installer **dry-runs by default** — preview first, then pass `--install` to apply. The `--install` run copies all skills from `skills/` to `~/.agents/skills/` and symlinks each into `~/.claude/skills/`. Confirm the new skill appears in the output.

## 8. Confirm with the user before committing

NEVER commit or push without explicit confirmation from the user. Before touching git:

1. Show the user a summary of all files that will be committed
2. Show the proposed commit message
3. Ask for explicit confirmation (e.g. "Ready to commit and push?")
4. Only proceed after the user says yes

```bash
git pull --rebase origin main
git add skills/estack-<skill-name>/ README.md CLAUDE.md CHANGELOG.md
git commit -m "add <skill-name> skill"
git push
```

Committing alone does NOT publish. Publishing is triggered by pushing a `v*` git tag (see `steps/publish.md`).

## 9. Route to publish (optional)

If the user wants this change released to npm, follow `steps/publish.md`.
