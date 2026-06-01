# Adding a Skill to E-Stack

Follow these steps in order. Adding a skill is separate from releasing it — version bumps happen at release time (`steps/publish.md`), not while adding.

## 1. Create the skill folder

```
skills/estack-<skill-name>/SKILL.md
```

The folder MUST be prefixed with `estack-`. The `SKILL.md` needs frontmatter with the name ALSO prefixed with `estack-`:

```markdown
---
name: estack-<skill-name>
description: (<skill-name>) <one-line description — this shows up in the skill list>
---
```

Both the folder and the `name` field use the `estack-` prefix. The `description` MUST start with `(<skill-name>)` (the short name without the prefix). This namespaces the skill correctly when installed to `~/.claude/skills/`.

Add any supporting files (references, steps, scripts) in subfolders as needed.

## 2. Show the diff (if migrating from an existing skill)

If the skill already exists somewhere (e.g. `~/.claude/skills/`), diff it:

```bash
diff -ru ~/.claude/skills/<skill-name> skills/estack-<skill-name>
```

Show the output and ask for confirmation before proceeding.

## 3. Delete the old copy (if migrating)

```bash
rm -rf ~/.claude/skills/<old-skill-name>
```

## 4. Run the installer

```bash
node bin/install.cjs            # dry run — preview what would change, writes nothing
node bin/install.cjs --install  # actually copy skills to ~/.claude/skills/
```

Run from the repo, the installer **dry-runs by default** — preview first, then pass `--install` to apply. The `--install` run copies all skills from `skills/` to `~/.claude/skills/`. Confirm the new skill appears in the output.

## 5. Confirm with the user before committing

NEVER commit or push without explicit confirmation from the user. Before touching git:

1. Show the user a summary of all files that will be committed
2. Show the proposed commit message
3. Ask for explicit confirmation (e.g. "Ready to commit and push?")
4. Only proceed after the user says yes

```bash
git pull --rebase origin main
git add skills/estack-<skill-name>/
git commit -m "add <skill-name> skill"
git push
```

Committing alone does NOT publish. Publishing is triggered by pushing a `v*` git tag (see `steps/publish.md`).

## 6. Route to publish (optional)

If the user wants this change released to npm, follow `steps/publish.md`.
