## Repo layout

This repo contains Claude Code skills distributed as **e-stack**. Each skill is a subfolder inside `skills/`, with a `SKILL.md` and optional supporting files.

**Distribution:** `npx e-stack@latest` → copies skills to `~/.claude/skills/`

Skills live under `skills/<skill-name>/` in this repo (e.g. `skills/better-title/`, `skills/chris-voss/`).

## After making changes

Follow this process for each skill you changed:

1. **Show the diff** between the repo version and the live version:
   ```bash
   diff -ru ~/.claude/skills/<skill-name> skills/<skill-name>
   ```
   Show the output to the user so they can see exactly what will change.

2. **Ask for confirmation** using `AskUserQuestion` before syncing. List which skill(s) will be overwritten.

3. **Run the installer** only after the user confirms:
   ```bash
   node bin/install.cjs
   ```

## Adding a new skill

When creating a new skill in this repo:

1. Create the skill folder with a `SKILL.md` (e.g. `skills/my-skill/SKILL.md`)
2. Run `node bin/install.cjs` to copy it to the live location
4. Bump the version in `package.json` before publishing to npm
