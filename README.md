# elliot-stack

[![npm version](https://img.shields.io/npm/v/elliot-stack)](https://www.npmjs.com/package/elliot-stack)
[![license](https://img.shields.io/npm/l/elliot-stack)](LICENSE)

A curated set of Claude Code skills by Elliot Drel. One command installs them all.

## Install

```bash
npx elliot-stack@latest
```

This installs skills to `~/.agents/skills/` and symlinks them into `~/.claude/skills/`, then registers a `SessionStart` hook so your skills stay up to date automatically. Any agent that reads from `~/.agents/skills/` (OpenClaw, Codex, ChatGPT, Cursor, and others) will pick them up automatically with no extra config.

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **Active Learning Tutor** | `/estack-active-learning-tutor` | Tutors a student through exam preparation using active learning — questioning, gap diagnosis, and concept mastery tracking |
| **Better Title** | `/estack-better-title` | Renames Claude Code chat sessions with descriptive titles |
| **Chris Voss** | `/estack-chris-voss` | Applies negotiation principles from *Never Split the Difference* |
| **CLAUDE.md Optimizer** | `/estack-claude-md-optimizer` | Creates, refines, and maintains CLAUDE.md / AGENTS.md files as short hand-authored letters of intent — welcomes first-time users with the why behind the format and coaches through pushback instead of enforcing rules |
| **Customer Discovery** | `/estack-customer-discovery` | Guides through customer discovery — validating ideas, outreach, interviews, and analysis |
| **Flight Planner** | `/estack-flight-planner` | Finds and ranks flights between two airports with config-driven preferences and optional ground-shuttle pairing |
| **GitHub Issue Tracker** | `/estack-github-issue-tracker` | Tracks and manages GitHub issues across repos |
| **Prompt Builder Coach** | `/estack-prompt-builder-coach` | Four-part kit for shaping, building, auditing, and scoping prompts for AI agents |
| **Read Claude Session History** | `/estack-read-claude-session-history` | Searches, reads, recovers, and compares Claude Code session history across sessions, projects, and backups |
| **Repo Search** | `/estack-repo-search` | Clones and searches external GitHub repos to answer questions about their code |
| **VS Code File Recovery** | `/estack-vscode-file-recovery` | Recovers permanently deleted files from VS Code or Cursor Local History, Claude session transcripts, or Windows Shadow Copies |

## Hooks

| Hook | Purpose |
|------|---------|
| **repo-search-nudge** | Suggests `estack-repo-search` when WebFetch/WebSearch hits GitHub |

Hooks install to `~/.claude/hooks/` and are auto-registered in your `~/.claude/settings.json`.

Important: hooks are a Claude Code feature. Skills are stored in `~/.agents/skills/`
and linked into Claude, but hook scripts and hook registration can only be installed
in Claude's config (`~/.claude/hooks/` and `~/.claude/settings.json`).

## How it works

- Skills install to `~/.agents/skills/estack-*/` (symlinked from `~/.claude/skills/estack-*/`; auto-detected by any agent that reads `~/.agents/skills/`, including OpenClaw, Codex, ChatGPT, and Cursor)
- Hooks are Claude Code-only: they install to `~/.claude/hooks/` and are registered in `~/.claude/settings.json`
- A `SessionStart` hook auto-updates skills each time you open Claude Code
- If you've made local edits to a skill or hook, the installer detects the conflict and lets you choose: overwrite, skip, or merge
- Every skill carries its own semver (`version:` in SKILL.md frontmatter; hooks use a `// @version` comment), independent of the package version — update messages show exactly what moved, e.g. `estack-chris-voss (1.0.0 → 1.1.0)`. Under the hood, updates are detected by content hash, so a change can never be missed; a release-time check (`scripts/check-versions.cjs`) guarantees every content change ships with a version bump.

## Updating

Skills update automatically on session start. To force an update manually:

```bash
npx elliot-stack@latest
```

## Requirements

- [Claude Code](https://claude.ai/code) CLI installed (other agents that read `~/.agents/skills/` work too)
- Node.js 18+

## Contributing

External contributions are welcome via pull request. Direct pushes to `main` are blocked — fork the repo, push your changes to a branch, and open a PR. Only the maintainer (Elliot) can merge to `main` and cut releases. This is intentional: `elliot-stack` is a security-sensitive npm package and the release tag can only be pushed by the maintainer.

### Testing locally

Run the installer straight from your checkout to preview what a real install would do to your `~/.claude/`:

```bash
node bin/install.cjs            # dry run — previews changes, writes nothing
node bin/install.cjs --install  # actually sync your local edits to ~/.agents/skills/ + ~/.claude/skills/
```

Run from the repo, the installer **dry-runs by default** so testing never clobbers your live install. Pass `--install` once the preview looks right. (`--dry-run` forces a preview even under `npx`.)

See [`docs/publishing.md`](docs/publishing.md) for the release flow and security model.

## License

MIT
