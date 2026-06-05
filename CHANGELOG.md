# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `estack-claude-md-optimizer` skill for auditing and improving CLAUDE.md files — opens every run with a first-time-user welcome that teaches the format's why (letter over rulebook, short over bloated, router only when earned), and coaches through pushback instead of enforcing rules, routing skill-level suggestions to the feedback flow
- `check-skill-name.cjs` release gate — blocks publishing if any skill still carries a stale, un-prefixed self-reference
- `check-docs.cjs` release gate — blocks publishing if the README and CLAUDE.md skill lists drift out of sync
- `CHANGELOG.md` — full release history following Keep a Changelog format
- `docs/changelog-maintenance.md` — reference doc explaining when and how to write and promote changelog entries

### Fixed
- Stale un-prefixed self-references in four skills
- Broken `gary` reference pointer after file rename

### Changed
- CLAUDE.md rewritten with lean routing tables
- `manage-e-stack` add/edit/hook/publish flows now include explicit CHANGELOG update steps

---

## [1.0.27] - 2026-06-04

### Fixed
- Bumped all skills to v1.0.2 to pick up feedback section deduplication missed in v1.0.26

---

## [1.0.26] - 2026-06-04

### Fixed
- Removed duplicate feedback sections from all skills

---

## [1.0.25] - 2026-06-04

### Added
- Feedback section enforcement added to the `add` and `publish` flows
- Standardized feedback section added to all skills (individual skill versions bumped 1.0.0 → 1.0.1)

### Changed
- Broadened agent compatibility messaging; documented OpenClaw compatibility and Claude-only hook install path

---

## [1.0.24] - 2026-06-04

### Added
- Per-skill versioning: frontmatter `version` fields, installer version labels, and a release gate that enforces them

### Fixed
- Install directory corrected to `~/.agents/skills/` (was landing in `~/.agents/` root)
- `add.md` paths updated to match the corrected install layout

### Changed
- SessionStart rebase hook upgraded to a safer form

---

## [1.0.23] - 2026-06-04

### Changed
- Skills now install to `~/.agents/skills/` and are symlinked into `~/.claude/skills/` for Claude Code compatibility

---

## [1.0.22] - 2026-06-04

### Fixed
- `__pycache__` directories and Python bytecode excluded from skill hash computation (caused false-positive hash mismatches)

---

## [1.0.21] - 2026-06-04

### Changed
- Backup directory moved from `~/.claude/` to the user root; existing backups auto-migrate on install

---

## [1.0.20] - 2026-06-03

### Added
- Engagement mode in `estack-read-claude-session-history` for attention-time accounting

### Changed
- Simplified timeline totals output

---

## [1.0.19] - 2026-06-03

### Added
- `estack-read-claude-session-history` skill — modular library with 20+ analysis modes, timeline view, JSON output, project filter, timezone handling, and a test suite
- Cross-project session search with progress bar and improved error handling
- Dry-run mode for the installer (on by default for local runs)
- `DEPRECATED_SKILLS` cleanup step to the installer

### Fixed
- Installer hash false positives on Windows caused by CRLF vs LF line endings

---

## [1.0.18] - 2026-05-29

### Added
- Hook authoring docs and examples alongside the `repo-search-nudge` hook

### Changed
- `repo-search-nudge` hook simplified

---

## [1.0.17]

### Added
- `estack-prompt-builder-coach` skill: a three-part kit (builder, auditor, definition-of-done) for writing effective AI prompts

---

## [1.0.16]

### Added
- Standardized feedback section added to all skills via update script

---

## [1.0.15]

### Added
- `estack-flight-planner` skill

---

## [1.0.14]

### Added
- `estack-active-learning-tutor` skill with journal tracking and turn-type system (launched at v4)

---

## [1.0.13]

### Changed
- `estack-better-title` updated with improved titling guidance
- `add`, `edit`, and `publish` flows for `manage-e-stack` unified into a single router skill

---

## [1.0.12]

### Changed
- Hard read constraints added to `estack-customer-discovery` skill and step files
- CLAUDE.md refactored to resolver pattern (route, don't explain)

---

## [1.0.11]

### Added
- `publish-e-stack` skill split into separate `edit-e-stack` and `publish-e-stack` skills
- Skill authoring docs for the auto-run command pattern

### Changed
- Removed `estack-` prefix from skill description labels

---

## [1.0.10]

### Added
- `AGENTS.md` compatibility file
- `add-skill-to-e-stack` local contributor skill for the add workflow

### Changed
- `estack-` prefix added to all skill name descriptions

---

## [1.0.9]

### Fixed
- `estack-customer-discovery` name field corrected to include the `estack-` prefix

---

## [1.0.8]

### Added
- `estack-customer-discovery` skill with 4-step discovery workflow

---

## [1.0.7]

### Added
- `estack-` namespace prefix applied to all skill folder names and skill `name` fields

### Fixed
- Installer double-prefix bug when applying the skill name prefix

---

## [1.0.6]

### Changed
- `estack-repo-search` updated to pass the full repo path to subagents for accurate local search

---

## [1.0.5]

### Added
- SessionStart hook for auto-rebase on session start

### Changed
- Publish trigger changed: CI only publishes when commit message contains `[publish]`

---

## [1.0.4] — [1.0.3]

### Fixed
- npm OIDC trusted publishing stabilized: workflow YAML quoting, Node 24, correct OIDC config

---

## [1.0.2]

### Fixed
- Workflow YAML parse errors (quoting, `!` operator in `if` conditions)

---

## [1.0.1]

### Changed
- npm publishing switched to OIDC trusted publishing
- README updated with badges, `estack-repo-search` docs, and requirements

---

## [1.0.0]

### Added
- `estack-better-title` skill — generates and selects improved conversation titles
- `estack-chris-voss` skill — negotiation coaching using Chris Voss techniques
- `estack-github-issue-tracker` skill — parallel subagent-based GitHub issue review and tracker
- `estack-repo-search` skill — clones and greps a GitHub repo locally for accurate code search
- Initial installer (`bin/install.cjs`) and sync script
- GitHub Actions publish workflow

[Unreleased]: https://github.com/ElliotDrel/e-stack/compare/v1.0.27...HEAD
[1.0.27]: https://github.com/ElliotDrel/e-stack/compare/v1.0.26...v1.0.27
[1.0.26]: https://github.com/ElliotDrel/e-stack/compare/v1.0.25...v1.0.26
[1.0.25]: https://github.com/ElliotDrel/e-stack/compare/v1.0.24...v1.0.25
[1.0.24]: https://github.com/ElliotDrel/e-stack/compare/v1.0.23...v1.0.24
[1.0.23]: https://github.com/ElliotDrel/e-stack/compare/v1.0.22...v1.0.23
[1.0.22]: https://github.com/ElliotDrel/e-stack/compare/v1.0.21...v1.0.22
[1.0.21]: https://github.com/ElliotDrel/e-stack/compare/v1.0.20...v1.0.21
[1.0.20]: https://github.com/ElliotDrel/e-stack/compare/v1.0.19...v1.0.20
[1.0.19]: https://github.com/ElliotDrel/e-stack/compare/v1.0.18...v1.0.19
[1.0.18]: https://github.com/ElliotDrel/e-stack/compare/v1.0.17...v1.0.18
