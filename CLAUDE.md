# CLAUDE.md

## What This Repo Is

**E-Stack** (`elliot-stack` on npm) is an open-source collection of Claude Code skills by Elliot Drel. It's a curated skill pack — users run `npx elliot-stack@latest` to install all skills to `~/.agents/skills/` (symlinked into `~/.claude/skills/`). Skills cover negotiation (Chris Voss), customer discovery, GitHub issue tracking, and repo search. The repo is the source of truth; npm is the distribution channel.

---

**Before acting, match your task to the routing below. Follow the referenced path — do not invent workflows.**

---

## 1. Task Routing

| Task | Action |
|---|---|
| **Any change to e-stack** (add, edit, publish a skill) | Invoke `manage-e-stack` skill — it routes to the right step file |
| **Add or edit a hook** (anything in `hooks/`) | Invoke `manage-e-stack` skill — routes to `steps/add-hook.md` |
| **Skill authoring reference** | Read `docs/skill-authoring.md` |
| **Hook authoring reference** | Read `docs/hook-authoring.md` |
| **Publishing, OIDC, branch protection, or repo security settings** | Read `docs/publishing.md` |

## 2. Repo Structure

```
skills/<skill-name>/     # Each skill is a subfolder
  SKILL.md               # Frontmatter + instructions (the skill itself)
  scripts/               # Optional supporting shell/node scripts
  references/            # Optional reference markdown files
  steps/                 # Optional step-by-step guides
hooks/<name>.js          # Claude Code hooks (flat, no subfolders) — installed to ~/.claude/hooks/
bin/install.cjs          # Installer: copies skills to ~/.agents/skills/, symlinks into ~/.claude/skills/
scripts/                 # Repo maintenance scripts (check-versions, update-skill-feedback, install tests)
docs/                    # Reference docs (publishing, skill authoring, hook authoring)
```

- **Distribution:** `npx elliot-stack@latest` installs skills to `~/.agents/skills/` and symlinks them into `~/.claude/skills/`
- **What gets published to npm:** Only the directories listed in the `files` field of `package.json`: `bin/`, `skills/`, and `hooks/`. Everything else (docs, scripts, .claude, .planning, etc.) is excluded automatically — there is no `.npmignore`.
- **Local preview / sync:** `node bin/install.cjs` run from the repo defaults to a **dry run** — it previews what would change in `~/.claude/` and writes nothing. Add `--install` to actually sync repo skills to the live location.
- **Skills in the pack:** `estack-active-learning-tutor`, `estack-better-title`, `estack-chris-voss`, `estack-customer-discovery`, `estack-flight-planner`, `estack-github-issue-tracker`, `estack-prompt-builder-coach`, `estack-read-claude-session-history`, `estack-repo-search`
- **Hooks in the pack:** `repo-search-nudge.js`

## 3. Hard Rules

- **Publishing is tag-triggered.** To release: `npm version patch && git push --follow-tags`. The `v*` tag push triggers `publish.yml`. Regular commits to `main` do NOT publish.
- **Never push a `v*` tag without intent to publish.** Any `v*` tag push starts a real npm release.
- **Only the repo owner can push to `main`.** Branch protection requires PRs from everyone else. Don't bypass.
- **Always show diff and confirm** before syncing changed skills to the live location. The installer's default dry run (`node bin/install.cjs`, no flags) is the preferred way to produce that diff — only run `node bin/install.cjs --install` after the user confirms.
