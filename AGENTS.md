# AGENTS.md

This is my personal skill pack for Claude Code — skills I use every day that I want to share with the world so others can do the same things I do. The goal is always to benefit the users as much as possible.

When you're working in this repo, you're doing one of two things: improving an existing skill, or improving the experience of using the skills (install flow, skill UX). Hold both in mind.

One naming note: "the skill folder" means `~/.agents/skills/` — that's where Codex and OpenClaw read from. Claude reads from `~/.claude/skills/`, which is just a symlink into the agents folder. The agents folder is the source of truth; don't edit the claude copy directly.

The same split applies inside this repo, one level down: this repo's own dev-tooling skill lives at `.agents/skills/manage-e-stack/` (source of truth, tracked in git). `.claude/skills/` is a local directory junction pointing at `.agents/skills/` — untracked, gitignored, regenerated per machine. Don't edit anything under `.claude/skills/` directly; edit `.agents/skills/manage-e-stack/` instead. `.claude/settings.json` is the one exception — it's Claude Code-only config, not agent-agnostic, so it stays a real file directly under `.claude/` rather than moving under `.agents/`.

Two things I care enough about to name explicitly: publishing and syncing. Publishing is tag-triggered — any version tag kicks off a real npm release, so never push one without intent. Syncing skills to the live location is destructive — always show me the diff and wait for my go-ahead before running the install. Before any publish, update all relevant docs to reflect what changed — README descriptions, AGENTS.md listing, and any docs/ reference files.

| Task | Action |
|---|---|
| Any change to a skill or hook | Invoke `manage-e-stack` (project-local skill at `.agents/skills/manage-e-stack/`, symlinked into `.claude/skills/manage-e-stack/`) |
| Skill authoring reference | Read `docs/skill-authoring.md` |
| Hook authoring reference | Read `docs/hook-authoring.md` |
| Publishing, OIDC, or repo security | Read `docs/publishing.md` |

| Doc | Read when… |
|---|---|
| `docs/skill-authoring.md` | Creating or editing a skill — versioning rules, feedback section, auto-run commands, doc listing requirements |
| `docs/hook-authoring.md` | Creating or editing a hook — script shape, stdin/stdout contract, settings.json registration, testing |
| `docs/publishing.md` | Releasing to npm or auditing repo security — publish flow, branch protection, OIDC configuration |
| `docs/manual-publish.md` | Publishing manually from the CLI when GitHub Actions are unavailable — prerequisite settings to re-enable, token bypass, cleanup checklist |
| `docs/changelog-maintenance.md` | Updating `CHANGELOG.md` — when and how to write unreleased entries, how to promote them on publish |
| `docs/research/codex-claude-cli-orchestration-findings.md` | Editing `estack-drive-cli-agent` — the full research record behind it (CLI flag semantics, sourced footguns, openai-codex plugin failure autopsy, prior art) |

- **Skills in the pack:** `estack-active-learning-tutor`, `estack-better-title`, `estack-chris-voss`, `estack-claude-md-optimizer`, `estack-cold-message-writer`, `estack-customer-discovery`, `estack-drive-cli-agent`, `estack-flight-planner`, `estack-github-issue-tracker`, `estack-leadership-coach`, `estack-migrate-claude-session-history`, `estack-pdf-to-md`, `estack-pr-description`, `estack-productivity-prioritization-coach`, `estack-prompt-builder-coach`, `estack-read-agent-history`, `estack-repo-search`, `estack-vscode-file-recovery`
- **Hooks in the pack:** `repo-search-nudge.js`
