# E-Stack - elliot-stack

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
| **Cold Message Writer** | `/estack-cold-message-writer` | Writes cold outreach messages — LinkedIn, email, or X DMs — that read as hand-typed for one person and actually get replies |
| **Customer Discovery** | `/estack-customer-discovery` | Guides through customer discovery — validating ideas, outreach, interviews, and analysis |
| **Drive CLI Agent** | `/estack-drive-cli-agent` | Drives another AI coding agent CLI programmatically — Codex (`codex exec`) and Claude Code headless (`claude -p`) — under existing subscriptions, with the invocation templates, structured-output parsing, and documented footguns (stdin hangs, timeout gaps, sandbox traps, false-success signals) needed to do it reliably |
| **Flight Planner** | `/estack-flight-planner` | Finds and ranks flights between two airports with config-driven preferences and optional ground-shuttle pairing |
| **GitHub Issue Tracker** | `/estack-github-issue-tracker` | Tracks and manages GitHub issues across repos |
| **Leadership Coach** | `/estack-leadership-coach` | Coaches real leadership decisions through the lens of responsibility-centered leadership (Lencioni's *The Motive*): reads the motive behind every request, catches abdication dressed up as delegation, and coaches six areas — delegation, developing your team, managing your people, difficult conversations, running meetings, and repetitive communication — each ending in a concrete artifact |
| **Migrate Claude Session History** | `/estack-migrate-claude-session-history` | Moves a Claude Code session (transcript + subagent sidecars) from one project to another with full path-encoding rewrite, migration note, and end-to-end verification so `/resume` works under the new project |
| **PR Description Writer** | `/estack-pr-description` | Rewrites a PR description for a maintainer who reviews product logic and risk — decisions with tradeoffs, real verification, and DB/migration/operational status, sourced from the actual diff, not the old description |
| **Productivity Prioritization Coach** | `/estack-productivity-prioritization-coach` | Coaches you through outcome-focused planning using RPM (Result, Purpose, Massive Action Plan) and five leverage filters — including an MVP anchor and a speed-to-outcome cut — to find the fastest path to a shippable result, plus a high-agency momentum engine for when you're stuck on execution, not choice |
| **PDF to Markdown** | `/estack-pdf-to-md` | Converts PDFs to Markdown or plain text using the RunPulse API — parallel page batching, cost-saving blank-page filter, scanned-PDF OCR support, and encrypted-PDF handling |
| **Prompt Builder Coach** | `/estack-prompt-builder-coach` | Four-part kit for shaping, building, auditing, and scoping prompts for AI agents |
| **Read Agent Session History** | `/estack-read-agent-history` | Searches, reads, recovers, and analyzes local AI coding-agent session history — Claude Code **and** Codex (OpenAI codex-cli) — across sessions, projects, and backups. A CLI for common lookups and reports (timeline, engagement, and other cross-session modes merge both agents by default via `--agent`), plus a Python library the agent builds custom queries on when no mode fits |
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

Adding or editing a skill? Authoring conventions (versioning, doc listings, feedback section) are in [`docs/skill-authoring.md`](docs/skill-authoring.md), and coaching-style skills can start from the scaffold in [`templates/`](templates/README.md).

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
