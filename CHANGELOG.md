# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.0.37] - 2026-06-18

### Added
- Active learning Exam 3 walkthrough review archive with cleaned transcript artifacts, user corrections, and iteration notes.

### Fixed
- `estack-migrate-claude-session-history` and `estack-read-claude-session-history` now use folded YAML descriptions so trigger text containing colons does not break skill loading.
- `estack-leadership-coach` reference-authoring docs now point at the installed `estack-` skill path.
- `estack-pdf-to-md` no longer includes a redundant Markdown title after frontmatter.
- `check-skill-name.cjs` now catches unsafe one-line frontmatter values while allowing intentional prose references and legacy compatibility paths.

---

## [1.0.36] - 2026-06-12

### Changed
- `estack-repo-search`: subagent results now treated as navigation aids only — the skill explicitly instructs the main agent to read key files itself rather than trusting subagent summaries verbatim

---

## [1.0.35] - 2026-06-12

### Changed
- `estack-prompt-builder-coach`: finished prompts and briefs are now output in chat first; the skill then asks "Would you like me to save this as a file?" and only saves if the user confirms (previously auto-saved to a markdown file without asking)

---

## [1.0.34] - 2026-06-12

### Fixed
- `estack-prompt-builder-coach`: output save path was hardcoded to `/mnt/user-data/outputs/` (a non-existent Linux sandbox path) in all four part files; changed to the current working directory throughout

---

## [1.0.33] - 2026-06-08

### Added
- `estack-migrate-claude-session-history` skill — moves a Claude Code session (transcript + subagent sidecars) from one project to another, rewriting all 9 path-encoding variants so `/resume` works correctly under the new project
- `estack-pdf-to-md` skill — converts PDFs to Markdown or plain text using the RunPulse API; parallel page batching, cost-saving blank-page filter, scanned-PDF OCR support (`--no-skip`), high-quality mode for tables/math/charts, and transparent encrypted-PDF handling
- `estack-productivity-prioritization-coach` skill — coaches you through outcome-focused planning using RPM (Result, Purpose, Massive Action Plan) and leverage filters to cut your task list to what actually matters

---

## [1.0.32] - 2026-06-07

### Added
- **`estack-leadership-coach`** — A structured leadership coaching skill that walks through real decisions and produces a concrete artifact every session — a delegation brief, feedback script, or gap diagnosis — that you can act on immediately. Not a brainstorm partner; a coach that teaches proven principles (Grove, SDT, Gallup, delegation frameworks) in the moment your situation calls for them, then applies them to your actual people and context.

  **Delegation** is live now with two flows:

  - **Pre-delegation** (6 phases) — Intake → Task scoping → TRM calibration (right person for this task?) → Enrollment coaching (convert assignment into ownership) → Brief-writing → Monitoring plan. Ends with a formatted, shareable delegation brief. Supports flat teams: negotiated authority levels (1–5 scale), accountability diffusion diagnosis, and flat-team-aware coaching notes throughout.
  - **Post-mortem** — Diagnoses a delegation that already went wrong. Surfaces which phase broke down and maps each gap to a re-entry point so you can correct the handoff, not just understand it.

  Compressed path available for low-stakes handoffs with a trusted peer. Knowledge vault with 11 curated reference files across four frameworks. Per-turn progress header (`Pre-delegation — Phase N of M: Name`) keeps you oriented at every phase. Three explicit question modes (single question / numbered list / structured choice) mean you always know exactly what you're being asked.

  Feedback, hiring, OKRs, conflict resolution, and performance reviews are on the roadmap.

---

## [1.0.31] - 2026-06-07

### Added
- `estack-leadership-coach` skill — delegation coaching that walks through a complete structured handoff: the right person, brief, authority level, and monitoring plan, while catching common failure patterns in real time

---

## [1.0.30] - 2026-06-07

### Added
- `estack-vscode-file-recovery` skill — recover permanently deleted files from VS Code Local History snapshots when git and the Recycle Bin can't help

### Changed
- `estack-vscode-file-recovery` 1.1.0 — extended to also search Cursor editor history, recover from Claude session transcripts via `/read-transcript`, and fall back to Windows Shadow Copies as a last resort
- `estack-vscode-file-recovery` 1.2.0 — replaced `-match` with `-like` to avoid regex metacharacter issues in filenames; added Cursor Linux history path; documented URL-encoding scheme and `mklink` trailing-backslash requirement for Shadow Copy mounting

---

## [1.0.29] - 2026-06-07

### Added
- `estack-claude-md-optimizer` skill for auditing and improving CLAUDE.md files — opens every run with a first-time-user welcome that teaches the format's why (letter over rulebook, short over bloated, router only when earned), and coaches through pushback instead of enforcing rules, routing skill-level suggestions to the feedback flow; per-turn progress headers render in a drawn box so status reads as separate from the message; opening welcome is a personal letter addressed to the user followed by a session routing table showing every step and why
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

[Unreleased]: https://github.com/ElliotDrel/e-stack/compare/v1.0.36...HEAD
[1.0.36]: https://github.com/ElliotDrel/e-stack/compare/v1.0.35...v1.0.36
[1.0.35]: https://github.com/ElliotDrel/e-stack/compare/v1.0.34...v1.0.35
[1.0.34]: https://github.com/ElliotDrel/e-stack/compare/v1.0.33...v1.0.34
[1.0.33]: https://github.com/ElliotDrel/e-stack/compare/v1.0.32...v1.0.33
[1.0.32]: https://github.com/ElliotDrel/e-stack/compare/v1.0.31...v1.0.32
[1.0.31]: https://github.com/ElliotDrel/e-stack/compare/v1.0.30...v1.0.31
[1.0.30]: https://github.com/ElliotDrel/e-stack/compare/v1.0.29...v1.0.30
[1.0.29]: https://github.com/ElliotDrel/e-stack/compare/v1.0.28...v1.0.29
[1.0.28]: https://github.com/ElliotDrel/e-stack/compare/v1.0.27...v1.0.28
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
