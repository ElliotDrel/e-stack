# CLAUDE.md

## What This Repo Is

**E-Stack** (`elliot-stack` on npm) is an open-source collection of Claude Code skills by Elliot Drel. It's a curated skill pack — users run `npx elliot-stack@latest` to install all skills to `~/.claude/skills/`. Skills cover negotiation (Chris Voss), customer discovery, GitHub issue tracking, and repo search. The repo is the source of truth; npm is the distribution channel.

---

**Before acting, match your task to the routing below. Follow the referenced path — do not invent workflows.**

---

## 1. Task Routing

| Task | Action |
|---|---|
| **Any change to e-stack** (add, edit, publish a skill) | Invoke `manage-e-stack` skill — it routes to the right step file |
| **Skill authoring reference** | Read `docs/skill-authoring.md` |
| **Publishing, OIDC, branch protection, or repo security settings** | Read `docs/publishing.md` |

## 2. Repo Structure

```
skills/<skill-name>/     # Each skill is a subfolder
  SKILL.md               # Frontmatter + instructions (the skill itself)
  scripts/               # Optional supporting shell/node scripts
  references/            # Optional reference markdown files
  steps/                 # Optional step-by-step guides
bin/install.cjs          # Installer: copies skills to ~/.claude/skills/
docs/                    # Reference docs (publishing, skill authoring)
```

- **Distribution:** `npx elliot-stack@latest` copies skills to `~/.claude/skills/`
- **Local sync:** `node bin/install.cjs` syncs repo skills to the live location
- **Skills in the pack:** `estack-better-title`, `estack-chris-voss`, `estack-customer-discovery`, `estack-github-issue-tracker`, `estack-repo-search`

## 3. Hard Rules

- **Publishing is tag-triggered.** To release: `npm version patch && git push --follow-tags`. The `v*` tag push triggers `publish.yml`. Regular commits to `main` do NOT publish.
- **Never push a `v*` tag without intent to publish.** Any `v*` tag push starts a real npm release.
- **Only the repo owner can push to `main`.** Branch protection requires PRs from everyone else. Don't bypass.
- **Always show diff and confirm** before syncing changed skills to the live location
