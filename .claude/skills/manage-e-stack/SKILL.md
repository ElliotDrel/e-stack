---
name: manage-e-stack
description: "MUST USE for any work on the e-stack repo — adding, editing, or publishing skills. Triggers: 'add a skill to e-stack', 'edit an estack skill', 'publish e-stack', 'release to npm', 'put this in e-stack', 'fix this skill', 'ship it', or any change to files under skills/ or package.json in this repo. Routes to the right step file based on intent."
---

# Working on E-Stack

This skill is the entry point for all e-stack work. Pick the route that matches the user's intent, then follow the matching step file exactly.

## Routes

| Intent | Step file |
|---|---|
| Add a new skill, migrate an existing skill into the repo | `steps/add.md` |
| Edit a skill that already exists in `skills/` (SKILL.md, scripts, references) | `steps/edit.md` |
| Add or edit a hook (anything in `hooks/`) | `steps/add-hook.md` |
| Publish to npm — push a release, ship it, verify a publish | `steps/publish.md` |

If the user's intent spans more than one route (e.g. "add a skill and publish"), run them in order: add → edit (if needed) → publish. Each step file has its own approval gates — do not skip them.

## Universal Conventions

These apply to every route. Violating them breaks the install or publish.

- **Skill folders** in `skills/` MUST be prefixed with `estack-` (e.g. `skills/estack-chris-voss/`)
- **`name` field** in frontmatter MUST match the folder name exactly
- **`description` field** MUST start with `(<short-name>)` where short-name is the folder name without the `estack-` prefix — e.g. `(chris-voss) Applies...`
- **Docs MUST list every skill and hook.** Adding, renaming, or removing a skill or hook requires updating the README.md Skills/Hooks tables AND the CLAUDE.md "Skills in the pack" / "Hooks in the pack" lines in the same change. `node scripts/check-docs.cjs` verifies both files against `skills/` and `hooks/` (missing AND stale entries); the publish workflow runs it as a hard gate, so out-of-date docs block the release.
- **`version` field** (semver, e.g. `version: 1.0.0`) MUST exist in every skill's frontmatter. New skills start at `1.0.0`. **Bump it on every content change** (patch = fix/tweak, minor = new capability, major = rewrite/breaking). Hooks carry a `// @version x.y.z` comment instead. `node scripts/check-versions.cjs` verifies every changed skill/hook bumped its version since the last release (`--fix` auto-bumps patch); the publish workflow runs it as a hard gate. Per-item versions are the human-readable label — the installer's content hashes remain the update-detection source of truth.
- **Publishing is tag-triggered.** `npm version patch && git push --follow-tags` bumps `package.json`, commits, creates a `v*` tag, and pushes — the tag triggers the npm publish workflow. Regular commits do NOT publish.
- **NEVER push a `v*` tag without intent to publish.** Any `v*` tag push runs a real npm release.
- **Only the repo owner can push to `main`.** Branch protection requires PRs from everyone else.
- **Live install location:** `~/.agents/skills/estack-*/` (symlinked from `~/.claude/skills/estack-*/`; the installer copies from `skills/` here)
- **Renaming/removing a skill** requires adding the old folder name to `DEPRECATED_SKILLS` in `bin/install.cjs` — the installer only adds/updates, never deletes, so without this users keep the old folder *and* the new one. See `steps/edit.md`.
- **Hooks** live in `hooks/<name>.js` at the repo root (flat — no subfolders). They are Claude Code-only: unlike skills, hooks cannot be installed into `~/.agents/` and discovered from there. The installer copies them to `~/.claude/hooks/` and registers each via a dedicated `setup<Name>Hook(dryRun)` function in `bin/install.cjs` that idempotently patches `~/.claude/settings.json` (and honors `dryRun` by returning before writing). Hook scripts MUST wrap their body in `try { ... } catch { /* never break the tool */ }` and exit 0 — a hook crash must never break the underlying tool call. See `docs/hook-authoring.md`.
- **Installer:** `node bin/install.cjs` from repo root **dry-runs by default** (previews changes, writes nothing); add `--install` to actually sync. `--dry-run` forces a preview even under `npx`.
- **Always `git pull --rebase origin main`** before committing or pushing. The user wants a linear commit history, so never plain `git pull` or `git merge` (those create merge commits).

## Skill Map

```
SKILL.md              # You are here — router + universal conventions
steps/
  add.md              # New skill / migrate an existing skill into the repo
  edit.md             # Edit an existing skill (uses scripts/preflight.sh)
  add-hook.md         # Add or edit a hook in hooks/ (uses scripts/preflight.sh)
  publish.md          # Cut a release: npm version + push tag
scripts/
  preflight.sh        # Read-only diagnostics — installed vs repo state, frontmatter check
```

Now read the matching step file and follow it.
