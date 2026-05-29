# elliot-stack

[![npm version](https://img.shields.io/npm/v/elliot-stack)](https://www.npmjs.com/package/elliot-stack)
[![license](https://img.shields.io/npm/l/elliot-stack)](LICENSE)

A curated set of Claude Code skills by Elliot Drel. One command installs them all.

## Install

```bash
npx elliot-stack@latest
```

This copies skills to `~/.claude/skills/` and registers a `SessionStart` hook so your skills stay up to date automatically.

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **Active Learning Tutor** | `/estack-active-learning-tutor` | Tutors a student through exam preparation using active learning — questioning, gap diagnosis, and concept mastery tracking |
| **Better Title** | `/estack-better-title` | Renames Claude Code chat sessions with descriptive titles |
| **Chris Voss** | `/estack-chris-voss` | Applies negotiation principles from *Never Split the Difference* |
| **Customer Discovery** | `/estack-customer-discovery` | Guides through customer discovery — validating ideas, outreach, interviews, and analysis |
| **GitHub Issue Tracker** | `/estack-github-issue-tracker` | Tracks and manages GitHub issues across repos |
| **Repo Search** | `/estack-repo-search` | Clones and searches external GitHub repos to answer questions about their code |

## Hooks

| Hook | Purpose |
|------|---------|
| **repo-search-nudge** | Suggests `estack-repo-search` when WebFetch/WebSearch hits GitHub |

Hooks install to `~/.claude/hooks/` and are auto-registered in your `~/.claude/settings.json`.

## How it works

- Skills install to `~/.claude/skills/estack-*/`
- Hooks install to `~/.claude/hooks/` and are registered in `~/.claude/settings.json`
- A `SessionStart` hook auto-updates both each time you open Claude Code
- If you've made local edits to a skill or hook, the installer detects the conflict and lets you choose: overwrite, skip, or merge

## Updating

Skills update automatically on session start. To force an update manually:

```bash
npx elliot-stack@latest
```

## Requirements

- [Claude Code](https://claude.ai/code) CLI installed
- Node.js 18+

## Contributing

External contributions are welcome via pull request. Direct pushes to `main` are blocked — fork the repo, push your changes to a branch, and open a PR. Only the maintainer (Elliot) can merge to `main` and cut releases. This is intentional: `elliot-stack` is a security-sensitive npm package and the release tag can only be pushed by the maintainer.

See [`docs/publishing.md`](docs/publishing.md) for the release flow and security model.

## License

MIT
