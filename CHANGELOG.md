# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.0.41] - 2026-06-20

### Changed
- `estack-read-claude-session-history` (v1.3.1): the report modes (`session-report`, `engagement`, `timeline`) now render every clock time as 12-hour with the 24-hour value in parens — `7:00pm (19:00)` — deterministically in the script (computed by hand, identical on every platform), with the header advertising `12h (24h)`. JSON output is unchanged (ISO timestamps). `SKILL.md` adds a global directive to report times to the user in 12-hour format unless they ask otherwise, and the day-review presentation defaults now say 12-hour instead of 24-hour.

---

## [1.0.40] - 2026-06-20

### Added
- `estack-read-claude-session-history` (v1.3.0): new `session-report` mode — the one-call "what did I do, per session" day review. Renders one numbered, chronological block per session over the same windowed, overlap-safe attention engine as `engagement`, carrying both clocks (`ran` = the session's own first→last span, which can overlap others; `active` = deduped attention), honest you/assistant message counts, files edited, and the intent/last-message inputs for a one-sentence summary. Replaces the prior hand-stitched `timeline` + `lookup` + `engagement` + raw-message-count workflow for "break down my day" questions. Supports `--date` or `--since`/`--until` scoping (windowed metrics) and `--format json`.
- `estack-read-claude-session-history`: `engagement` now reports per-role message counts (`you`/`assistant` in text; `user_messages`/`assistant_messages` in JSON). Counts are honest — real typed prompts only (tool-result envelopes, `isMeta` hook/skill injections, and compact continuations excluded) and text-bearing assistant turns only (tool-only turns excluded) — so they no longer require error-prone hand-counting of raw `.jsonl` entries. Both are windowed to `[since, until)`.
- `estack-read-claude-session-history` (`SKILL.md`): new "Presentation defaults for a human day-review" section codifying the numbered/sectioned, UUID-free, one-sentence-per-session, both-clocks-with-overlap, 24-hour presentation contract for natural-language "review my day" answers.
- `docs/skill-authoring.md`: documented `check-skill-name.cjs` — the CI gate that verifies skill naming, frontmatter shape, and self-reference correctness. Previously only `check-docs.cjs` and `check-versions.cjs` were documented; `check-skill-name.cjs` ran silently as a hard gate without any author-facing guidance.
- `docs/publishing.md`: added `check-skill-name.cjs --all` to the publish workflow step description so the gate is discoverable alongside the other two.

### Fixed
- `estack-read-claude-session-history` (`recipes.md`): recipe 8 (tool-call forensics) now documents the wide-scope search default (per-session summary) and shows `--full` for expanding to match windows. Previously the recipe showed `--all-projects --mode search` without mentioning that the output is a summary by default, which could confuse users expecting match windows.
- `estack-read-claude-session-history` (`SKILL.md`): quick-reference tree now shows `--in tool_use|tool_result|thinking|all` instead of just `--in tool_use`, reflecting the `--in tool_result` and `--in all` options added in v1.2.1.

---

## [1.0.39] - 2026-06-19

### Changed
- `estack-read-claude-session-history`: wide-scope `--mode search` (`--cwd`/`--project`/`--all-projects`) now prints a per-session summary by default — one line per session (`mtime · uuid8 · project · hit-count · first snippet`), sorted newest first, headed by total hit and session counts. Previously it dumped a 1500-char window for every match across every session, which could exceed the harness's ~25k-token Read cap and force a write-then-can't-read round trip. Add `--full` to expand a wide search into match windows; the full view is bounded by a ~10k-token character budget and degrades back to the summary (with a note) if it would overflow. Sessions past the 200-line summary cap are counted in a footer, never silently dropped. Single-file searches (`--file`) are unchanged — always full windows. The full view (single-file or wide + `--full`) is bounded by the same budget, so even one huge session can't overflow the Read cap. JSON mirrors the same split.

  **Behavior change:** `--mode search --cwd` now matches **both user and assistant** messages (previously assistant-only), making it consistent with `--project`/`--all-projects`. This can increase match counts for existing `--cwd` searches; pass `--role assistant` to restore the old assistant-only behavior.

### Fixed
- `estack-read-claude-session-history`: `--until` is now exclusive across every mode, giving a consistent half-open `[since, until)` window. Previously `search` and `tool-usage` included messages stamped exactly at `--until` while `timeline` and `engagement` excluded them; a message at the exact `--until` instant is now uniformly excluded.
- `estack-read-claude-session-history`: search progress (`Searching i/N…`) is now suppressed when stderr is not an interactive terminal, so captured/piped runs no longer inflate the output with hundreds of literal `\r` progress lines.
- `estack-read-claude-session-history`: project/all-projects `search` no longer drops sessions whose file mtime is after `--until` — the `until` bound is now applied per message (as in `timeline`/`tool-usage`), so a session still being written can't hide its in-window matches.
- `estack-read-claude-session-history`: `--mode search` with no scope flag now prints an accurate error (`search requires --file, --cwd, --project, or --all-projects`) instead of the misleading `--file required`.

---

## [1.0.38] - 2026-06-18

### Added
- `estack-read-claude-session-history`: new `--mode tool-usage` tallies tool calls by name across a session, project, or all projects, with `Skill` calls sub-tallied by skill name. Counts real invocations (structural `tool_use` blocks), so it answers "which skills/tools do I actually use" without the substring false-positives that made `count`/`search` miscount skill usage. Supports `--tool` filtering (e.g. `--tool Skill`), `--file`/scope targeting, time bounds, `--exclude-current`, `--include-subagents` (fold subagent tool calls into the tally), and `--format json`. `--until` bounds calls by their own timestamp rather than file mtime, so a session modified after the bound still contributes its in-window calls.

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

[Unreleased]: https://github.com/ElliotDrel/e-stack/compare/v1.0.41...HEAD
[1.0.41]: https://github.com/ElliotDrel/e-stack/compare/v1.0.40...v1.0.41
[1.0.40]: https://github.com/ElliotDrel/e-stack/compare/v1.0.39...v1.0.40
[1.0.39]: https://github.com/ElliotDrel/e-stack/compare/v1.0.38...v1.0.39
[1.0.38]: https://github.com/ElliotDrel/e-stack/compare/v1.0.37...v1.0.38
[1.0.37]: https://github.com/ElliotDrel/e-stack/compare/v1.0.36...v1.0.37
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
