# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.0.61] - 2026-08-10

### Added
- `estack-flight-planner` — `scripts/load_flights.py`, a loader that normalizes every SerpAPI itinerary and filters nothing. Returns per-leg detail, layover airports and durations, delay and overnight flags, legroom, aircraft, operating carrier (a "UA 3443" is often flown by a regional partner), carbon figures, booking tokens, and per-route price insights, as JSON, a table, or CSV. This is the new entry point after fetching.
- `estack-flight-planner` — post-flight shuttle pairing. `pair_shuttles.py` previously understood only "home → departure airport", so flying *into* the town a shuttle serves had no representation at all and those searches silently dropped every flight. Both legs are now supported and can apply to the same itinerary, selected with `--legs auto|pre|post|both`.
- `estack-flight-planner` — trip presets (`config.trip_presets`). A saved slug carrying origins, destinations, aliases, and `shuttle_legs` lets a returning user say "flying home" and skip airport research entirely. A preset removes the research step, never the confirmation.
- `estack-flight-planner` — `shuttle_legs` per preset (`departure` / `arrival` / `both` / `none`), which is direction-specific and usually asymmetric. It is a default the skill proposes, never one it applies silently: the Phase 2 confirmation block breaks it out as its own line every run. A configured shuttle is not a needed shuttle, and a wrong guess here produces no error, just a ranking bent around a cost nobody was going to pay.
- `estack-flight-planner` — day-of-week shuttle schedules (`days`), a `--max-gap-min` ceiling so a run half a day away stops counting as a connection, reservation-cutoff warnings via `--now` and `--reservation-lead-hours`, plus `--include-unpaired` and `--format json`.
- 75 pytest cases under `tests/estack-flight-planner/`, covering buffer math in both directions, overnight rollover, the legacy shuttle schema, day filters, the ranking model, loader field preservation, and CLI behavior.

### Changed
- `estack-flight-planner` skill (1.2.0) — the scripts now own data collection rather than judgment. They keep what is repetitive, unavoidable, and expensive to get subtly wrong (fetching every route, parsing SerpAPI's nested shape, timezone and overnight shuttle math) and hand back everything else untouched. `filter_flights.py` is demoted to an optional convenience for the common shape, with an explicit instruction to abandon it the moment a request does not fit rather than contorting "nothing connecting through Charlotte" or "I'll pay $60 to land before 6pm" into `--max-price` and `--soft-filters`. SKILL.md tells the agent to write that pass in its scratchpad, never into the skill folder and never by editing the shipped scripts.
- `estack-flight-planner` — ranking is now one dollar-equivalent scale instead of a violation count. Soft preferences previously acted as trumps, so a $400 flight matching every preference outranked a $189 flight that missed one. `rank_score` is `price + a penalty per missed soft preference` (defaults: nonstop $60, route $50, airlines $40, duration $40, time-priority $30, and max-price $0 because the overage is already in the price), overridable with `--soft-penalties`, and `rank_explanation` shows the arithmetic. `pair_shuttles.py` sorts on the same scale, adding real shuttle cost plus what an awkward connection is worth avoiding.
- `estack-flight-planner` — shuttle times are now understood as local to wherever each event happens, which means the buffer math needs no timezone conversion at all: flight times and airport-side shuttle times are already in the same zone. `--tz-offsets` is accepted and ignored, since it applied the same offset to both sides of the subtraction and always cancelled to zero. Overnight runs are handled by testing the adjacent calendar day, so a 23:40 landing pairs with a 01:00 departure.
- `estack-flight-planner` — added a `--max-duration-min` filter and `max_duration_min` config field. Useful when nonstop is a soft preference: it lets one-stops through without letting a 14-hour triple-connection through with them.
- `estack-flight-planner` — the booking-link step now hands over two links (the airline's own search page plus a Google Flights fallback) and names the three ways an airline deep link fails silently: an inverted trip-type flag that quietly returns round-trip prices, a booking path moved between site versions that redirects instead of 404ing, and base-fare-only pricing that undercuts what the user actually pays. Airline sites are client-rendered and bot-protected, so the agent cannot load one to check its own URL, and is told to verify parameters against a current source or lead with the fallback and say the airline link is unverified. Carries a verified united.com deep link (`/en/us/fsr/choose-flights`, where `tt=0` is one-way and `tt=1` is round-trip, and `taxng=1` is needed for all-in pricing). Also adds a step to flag restricted fare brands before purchase — baggage limits, no seat selection, and especially no changes or refunds when the trip is pinned to a fixed date like a lease start — without asserting any airline's current baggage rule from memory.

### Fixed
- `estack-flight-planner` — `check_setup.sh` printed `ERROR reading config` for every Windows user. Under Git Bash `$HOME` is a POSIX path (`/c/Users/...`) that a native Windows Python cannot open, so passing it as an argument silently failed. The config is now piped in on stdin.
- `estack-flight-planner` — `often_delayed_by_over_30_min` is a per-leg flag but was read off the itinerary, so the delay warning never fired.
- `estack-flight-planner` — the airline filter only checked the first leg, so a UA → AA connection passed a United-only filter. An itinerary now counts as matching only if every leg does.
- `estack-flight-planner` — multi-leg flight numbers and carriers were dropped, leaving a two-carrier connection labeled with only the first leg's flight number.
- `estack-flight-planner` — an itinerary SerpAPI returned without a price sorted first rather than last. A missing price is not a free flight.

---

## [1.0.60] - 2026-07-26

### Added
- Codex `SessionStart` updater — E-Stack now checks for and installs skill updates when Codex starts, alongside the existing Claude Code startup updater. The updater has one shared source in `~/.agents/hooks/` with small host-specific adapters.

---

## [1.0.59] - 2026-07-24

### Added
- `estack-email-writer` skill — general-purpose email writing, editing, and review for any email where the recipient already knows the sender (partner outreach, event invitations, scheduling, replies, coaching someone else's draft). Covers the whole craft: subject lines that put the reason to open in the first ~40 characters and never lead with the recipient's own name, openers built on genuine shared context instead of pleasantries, bodies that persuade with specifics and plain words, why-them lines grounded in something true about the reader, one small time-boxed no-oriented ask, scheduling that closes in one reply (concrete slots plus a scheduling-link fallback), and the sound-like-a-human voice guide with the read-aloud test. Works in tandem with `estack-cold-message-writer` — that skill owns first-touch psychology, this one owns the craft.

### Changed
- `estack-cold-message-writer` skill (1.1.0) — now pairs explicitly with the new `estack-email-writer`: the general-purpose voice guide (sender's real voice, AI tells, read-aloud test) moved there so it's shared by all email writing, and the cold skill keeps a pointer plus its cold-specific voice notes (lowercase DM register, roughing up drafts that read too clean). Load both for a cold email; use `estack-email-writer` alone when the recipient already knows the sender.

---

## [1.0.58] - 2026-07-22

### Added
- `estack-drive-cli-agent` skill — teaches the agent to drive another AI coding agent CLI programmatically: Codex (`codex exec`) and Claude Code headless (`claude -p`), both under existing logged-in subscriptions (never API-key billing). Ships a simple foreground template for quick calls and a backgrounded template for long/write-capable runs on each CLI, five hard rules distilled from documented failure modes (close stdin on Codex calls or they hang on Windows, enforce your own timeout, read results from output never exit codes, verify claimed effects against git/filesystem ground truth, set sandbox/approval/cwd explicitly per call), and two sourced reference files (`references/codex-exec.md`, `references/claude-headless.md`) where every claim carries the official doc or GitHub issue URL so the agent can fetch current truth when either CLI changes.

### Changed
- `estack-better-title` skill — `allowed-tools` now lists scoped permission rules for every command the skill runs (`rename.sh`, `current-title.sh`, `gh --version`, `gh issue create`, the `python3 -c` issue-URL fallback) instead of bare `Bash`, so they're all pre-approved on skill invocation without granting blanket Bash approval. Verified empirically (headless `claude -p` test) that the rename rule matches the real heredoc invocation. SKILL.md documents that the grant only covers the invoking turn; the optional `settings.json` rule remains the fix for later-turn renames.
- `estack-better-title` skill — the current-title lookup moved from inline shell in the auto-run block into `scripts/current-title.sh`. The auto-run block now just calls the script (with env-var and install-path fallbacks in case template substitution doesn't reach auto-run blocks), and the same one-line command is documented for manual re-runs — so when a user pauses mid-flow and asks the agent to finish the rename turns later, the re-check hits the pre-approved `Bash(bash */scripts/current-title.sh*)` rule instead of an unmatched ad-hoc pipeline.
- `estack-read-agent-history` skill (4.0.0) — KISS pass over the whole skill, guided by an independent review. Docs deduplicated: the attention-dedup and tool-usage rationales now live once in `references/modes.md` with pointers elsewhere; stale claims fixed (dump `-n` docs, `decode_project_name` docstring, jsonl-schema timezone note, module docstring, scratch boilerplate now imports `codex`).
- `estack-pr-description` skill (2.0.0) — rewritten around a real worked case study instead of prose rules alone, kept as a canonical example at `reference/example-pr.md`. "What changed and why" is now one merged numbered list instead of separate "Key decisions" and "What changed" sections, governed by two named checks: the alternative test (a Key decision line must name a credible rejected alternative or it is not a decision) and the deletion test (every fact appears exactly once in the whole body). Verification is manual-only and scoped to exactly what the author says they tested by hand, with everything else pushed into a numbered post-merge checklist; gate, lint, build, and test commands and status-code catalogs are barred outright. A mandatory final self-check (11-item checklist) runs before any draft is delivered.

### Removed
- `estack-read-agent-history` skill — the v1 legacy compatibility surface (`--list` / `--list-subagents` alias flags, byte-identical v1 list output) and the `--json` alias for `--format json`; use `--mode list`, `--mode subagent-list`, and `--format json`. Also removed dead library code (`subagents.group_by_parent`, unused `agent_tools`/`agent_files` wrappers, an unreachable `load_meta` fallback branch, the unused `stream_events` engagement field) and 8 redundant tests (suite 110 → 102, no coverage lost).

### Fixed
- `estack-read-agent-history` skill — `--mode dump -n <N>` below 80 was silently clamped up to 80 (while a recipe explicitly suggested `-n 20`); `-n` is now honored as given. `--mode engagement`/`session-report --file <codex-rollout>` no longer drops Claude prompts from the global attention stream — the always-global dedup invariant now holds for Codex files exactly as for Claude files. `--mode count` no longer misses sessions whose file was last written after `--until` (now uses the same since-only mtime prefilter as `search`, with the window applied per message).

---

## [1.0.57] - 2026-07-20

### Added
- `estack-pr-description` skill — rewrites a PR description for a maintainer who reviews product logic and risk, not implementation detail. Reads the actual diff, commits, tests, and PR state (never trusting the old description or commit titles as proof of behavior) and produces a short, decision-led writeup: key decisions with the why and tradeoff, verification that says what failure each check rules out, a high-level change summary, database/Supabase/migration status, operational behavior, and open calls for the reviewer. Scales down to Root cause / Fix / Verification for small changes. Ships with the same writing-style rules as the user's global CLAUDE.md baked in, so the output holds to them even outside that context.
- `estack-read-agent-history` skill — now reads **Codex** (OpenAI codex-cli) session history alongside Claude Code. A new `lib/codex.py` adapter discovers Codex rollouts under `~/.codex/sessions/YYYY/MM/DD/` and normalizes each into the same entry shape Claude emits, so every single-`--file` mode (brief, dump, last, tool-calls, file-edits, search, …) works on a Codex rollout with no flag — the type is auto-detected. Cross-session modes (`timeline`, `engagement`, `session-report`, `list`, `journal`, `count`, `tool-usage`, `lookup`, `find`, `search`) take a new `--agent claude|codex|both` flag (default `both`) and merge both agents into one deduped attention stream, so a day timeline or active-time total covers Claude + Codex and parallel chats split the clock instead of double-counting. JSON output tags each session `source: "claude"|"codex"`; text output prefixes Codex rows with `codex ▹`. New `references/codex-history.md` documents the Codex schema and traps.
- `estack-better-title` skill — an auto-run (`` ```! ``) block now looks up the session's existing custom title (if any) on skill load, same as `estack-repo-search` auto-refreshes its repo list, so the model always sees the current title before drafting suggestions instead of proposing titles blind.

### Changed
- Renamed `estack-read-claude-session-history` → `estack-read-agent-history` to reflect that it now reads both Claude Code and Codex history. The installer removes the old folder automatically (added to `DEPRECATED_SKILLS`); the invoke command is now `/estack-read-agent-history`.

### Fixed
- `estack-better-title` skill — `rename.sh`'s Windows file-lock retry now uses exponential backoff (0.3/0.6/1/1.5/2/3/4/4s, ~16s total) instead of a flat 6 × 0.3s (~1.8s total). The live CLI writes to the session's own `.jsonl` on nearly every turn/tool call, so in busy sessions the transient exclusive lock recurred faster than the old window could reliably outlast, causing the rename to fail repeatedly even though the underlying lock was genuinely transient.
- `estack-read-agent-history` skill — `files_touched()` now parses a Codex-recorded Windows path (`C:\Users\...`) with `PureWindowsPath` instead of the host OS's native `Path`, so basename extraction (`.name`) works correctly when the script runs on a different OS than the one the session was recorded on — e.g. reading a Windows-recorded Codex session from a Linux/macOS machine, where a bare `Path()` silently treated the whole backslash-separated string as one filename component.

---

## [1.0.55] - 2026-07-15

### Fixed
- `estack-vscode-file-recovery` skill — all `Get-Content` commands in the recovery instructions now pass `-Encoding UTF8`. Windows PowerShell 5.1 decodes BOM-less UTF-8 files as ANSI (Windows-1252) by default, so any non-ASCII character in a recovered snapshot (curly quotes, em dashes, accents) came through as mojibake like `â€™` — and because the restore step writes that content back to disk, the corruption became permanent in the restored file. Step 4 now also recommends the Read tool as the primary way to read snapshots.

---

## [1.0.54] - 2026-07-15

### Added
- `estack-read-claude-session-history` skill — `--mode last` now takes `--role user|assistant|both` (default `assistant`, unchanged), so "what was the last thing I said" is one deterministic command instead of a `--mode dump` + grep bridge; `--role user` excludes compact continuations and hook/skill `isMeta` injections.

### Changed
- `estack-read-claude-session-history` skill — SKILL.md rewritten (2.0.0) around an escalation ladder: use a CLI mode when one fits, post-process its `--format json` output when one almost fits, write a scratchpad script on `scripts/lib/` when none does, and fold a recurring gap back into the CLI as a small deterministic mode. Pitfalls (UTC timestamps, dishonest raw entry counts, lossy path encoding, truncated trailing lines, Windows path/BOM traps) now live front and center, and a standing mandate tells the agent to update the skill at the source repo with techniques that work or fail in the field. Day-review presentation defaults moved into `references/modes.md`.

---

## [1.0.53] - 2026-07-13

### Changed
- `estack-repo-search` skill — the "Available repos" listing now force-syncs every cached repo to its remote's current default-branch tip (`git fetch` + `git reset --hard FETCH_HEAD` + `git clean -fdx`) instead of a plain `git pull --ff-only`, so a repo with local edits or one that fell behind (fast-forward would've failed silently) is always brought to a clean, current state before you search it. Also added an explicit read-only note: the sandbox is for `Read`/`Grep`/`Explore` only, never for editing.

---

## [1.0.52] - 2026-07-13

### Added
- `estack-read-claude-session-history` skill — new `--mode whoami` resolves the current live session (via `CLAUDE_CODE_SESSION_ID`) straight to its `.jsonl` path, and SKILL.md now surfaces the session ID directly (`${CLAUDE_SESSION_ID}`) so you don't have to run `--mode list` and eyeball timestamps to find "this" conversation.

### Fixed
- `estack-better-title` skill — `rename.sh` now retries the session-file append with backoff instead of failing outright on a transient Windows file lock ("Device or resource busy"), and correctly surfaces the real error (instead of a misleading "transient lock" message) when the failure is permanent (bad path, permissions). SKILL.md documents an optional permission allow-rule for the sanctioned rename command.
- `estack-read-claude-session-history` skill — `current_session_id()` now reads `CLAUDE_CODE_SESSION_ID`, the actual OS env var Claude Code sets in a live session (`CLAUDE_SESSION_ID` is a different thing — a SKILL.md text substitution, never a real env var — kept as a fallback). This was silently broken since it shipped, affecting `--exclude-current`/`is_current` detection across `list`/`journal`/`search`/`count`/`timeline` in addition to the new `whoami` mode.

---

## [1.0.51] - 2026-07-12

### Added
- `estack-cold-message-writer` skill — writes cold outreach messages (LinkedIn, email, X DMs) that read as hand-typed for one recipient instead of a templated blast, with channel-specific mechanics, an anti-pattern self-check, and follow-up/situation templates for when the first message gets ghosted.

---

## [1.0.50] - 2026-07-06

### Fixed
- `check-docs.cjs` now reads the "Skills in the pack" / "Hooks in the pack" lines from `AGENTS.md` instead of `CLAUDE.md`, matching the move of the project instructions into `AGENTS.md` (CLAUDE.md now just imports it). Updated the matching instructions across `manage-e-stack` step files, `docs/skill-authoring.md`, `docs/publishing.md`, `templates/README.md`, and `AGENTS.md` so contributors register skills/hooks in the right file.

### Changed
- `estack-leadership-coach` (v5.0.0): rebuilt on **responsibility-centered leadership** (Patrick Lencioni's *The Motive*) as the new top-level spine. The coach now reads every request through the motive — *"are you doing this because it's your job, or avoiding it because it isn't rewarding?"* — anchored on two load-bearing lines embodied throughout: Grove's "delegation without follow-through is abdication" and Lencioni's definition of management. Added a **motive gate** at the front door (and in delegation intake) that can halt or redirect a handoff when the task is one of the five omissions or the motive is reward-centered. The five omissions became five new routable coaching flows, each ending in a concrete artifact and each posing Lencioni's verbatim "Leader Reflection" self-check questions to call the user out: developing the leadership team (Team Development Plan), managing subordinates (Management Cadence), difficult conversations (Conversation Script), running meetings (Meeting Redesign), repetitive communication (Communication Plan). Added a `motive-check` diagnosis flow built on the root question "why do you want to be a leader?", a new `references/lencioni_the-motive.md` synthesis (from the user-provided full book text), and wired the motive into delegation Phase 1 (intake) and Phase 7 (diagnose). Router expanded from delegation-only to six territories.
- `estack-leadership-coach` (v4.0.0): restructured SKILL.md onto the `templates/coaching-skill` scaffold's standard component order (identity → primary outcome → voice → calibrate depth → framework → coaching protocol → acceptance bar → shortcuts → handling resources → references → feedback). New "References — the knowledge vault" section links all 12 reference files directly from SKILL.md (one-hop rule), and the framework router now links each of the 7 delegation phase files directly instead of only through the flow files. Dissolved the "Standing instructions" block into the matching template components, removed the model-specific "Claude Opus 4.7 follows literally" line, and paired every pre-empted shortcut's *don't* with its *do*. Coaching behavior, flows, and phase files are unchanged.

---

## [1.0.49] - 2026-06-25

### Fixed
- `estack-productivity-prioritization-coach` (v1.2.1): corrected "four lenses" to "five lenses" in the MAP filtering section after adding the speed-to-MVP cut. Updated README description to reflect the MVP anchor and speed-to-outcome framing.

---

## [1.0.48] - 2026-06-25

### Changed
- `estack-productivity-prioritization-coach` (v1.2.0): ingrained two core lenses that now frame every coaching session. (1) Decreasing time to outcome is the most impactful skill — every session actively coaches speed, asking "what's slowing you down?" and "what would you cut to get there twice as fast?" (2) The target is the MVP outcome, not the perfect outcome — the Result step now includes an MVP anchor ("what's the version that ships in half the time?"), the MAP gains a speed-to-MVP cut as a fifth filter, and the coaching directives explicitly call out perfection-seeking and redirect to shippable.

---

## [1.0.47] - 2026-06-23

### Added
- `estack-github-issue-tracker` (v1.2.0): fetch PR merge-readiness signals during analysis (closes #2). `fetch-issues` now detects PRs and pulls `mergeStateStatus`, `mergeable`, `reviewDecision`, `statusCheckRollup`, and reviews via `gh pr view`; the result-file schema gains an `is_pr` flag and a conditional `## PR Health` section; Step 2b now always re-fetches and overwrites API-observable fields (state, labels, comment count, merge/review/CI status) instead of only filling blanks, and distinguishes bot reviews from human reviews (`COMMENTED` ≠ `APPROVED`).
- `estack-github-issue-tracker` (v1.2.0): new `append-history` command for atomic, dedup'd, interrupt-safe incremental tracker persistence (closes #3). Writes a single history entry to one issue section without a full temp-dir sweep, via a split-based section finder. Step 5c and subagents now persist each action immediately (via the `TRACKER_UPDATE:` return convention) rather than batching writes at session end.

### Fixed
- `estack-github-issue-tracker` (v1.2.0): removed the `'m'` regex flag from the two section-extracting patterns (`extractSection`, `sectionRe`) that caused `$` to match end-of-every-line and truncate every extracted section to a single line (closes #1, #5, #6). This silently broke `update-tracker` (no changes applied), `compile-report` (truncated sections), and left orphaned heading-less body blocks in Active Issues when moving an issue to Closed.
- `estack-github-issue-tracker` (v1.2.0): validate `owner`/`repo`/`number` before interpolating them into the `gh pr view` shell command in `fetch-issues`, closing a command-injection vector from a poisoned tracker/config entry.

### Changed
- `estack-github-issue-tracker` (v1.2.0): rewrote Step 5 into a persistent action queue plus a post-check-in execution framework (closes #4 and #7). Recommended "Do Today" actions now persist to a new `## Pending Actions` section in the tracker file — the authoritative cross-session queue (the harness task list is an optional within-session mirror, never the source of truth). Startup (Step 0) reads this section so unfinished `- [ ]` items surface as a "Carried Over" block at the top of the report. New Step 5c execution framework specifies the operational *how*: mark-before-acting, one parallel subagent per approved action, an action-type routing table (post comment / rebase PR / fix PR blockers / watch), temp-dir-only git clones (`mktemp -d` → work → `rm -rf`, never the working dir), blanket-approval force-push auth, a Sonnet model floor for complex code fixes, and immediate per-action persistence via `append-history` before flipping the queue item to `- [x]` (pruned after 7 days). Renumbered the former 5b/5c/5d into 5d (collect Goals) and 5e (cleanup).

---

## [1.0.46] - 2026-06-23

### Changed
- `estack-leadership-coach` (v3.1.2): surfaced two design rationales into `SKILL.md` that were previously only enforced implicitly. Added a "The line everything flows from" framing block establishing Grove's *"delegation without follow-through is abdication"* as the founding principle the whole coach protects (transfer of execution, not accountability; monitoring as the line between delegation and dumping; Gerber's management-by-abdication). Added the "why this is a conversation and never a form" rationale to the question-modes rule — a form produces fill-in-the-blank answers, a conversation produces thinking — explaining *why* questions come a few at a time rather than as a dumped questionnaire.

---

## [1.0.43] - 2026-06-23

### Changed
- `estack-productivity-prioritization-coach` (v1.1.0): added a high-agency execution layer alongside RPM and the leverage filters. New "Building momentum (high agency)" section coaches the *how-to-do-it* side when the user is stuck on execution rather than choice — top-down decomposition until each step is trivially startable, the small-wins → momentum → upward-spiral engine (motivation and discipline as outputs of visible results, not prerequisites), failure-as-data iteration, and outsourcing the learning curve under time pressure. Added an ambition gut-check at the Result stage. Broadened the trigger description to cover stuck-on-execution, lost-momentum, and "high agency" asks. Synthesized from a new source (`sources/03-nick-tarmossin-high-agency.md`).

---

## [1.0.42] - 2026-06-20

### Fixed
- Packaging: `npm publish` no longer ships Python bytecode. The publish workflow runs the test suite before `npm publish`, which compiled `.pyc` files into `skills/**/__pycache__/` that the `"files": ["skills/"]` allowlist then bundled (`.gitignore`/`.npmignore` do not override a directory entry in `files`). Added negation globs (`!**/__pycache__`, `!**/*.pyc`, `!**/*.pyo`) to `package.json` `files` so bytecode is excluded at pack time regardless of tree state, and set `PYTHONDONTWRITEBYTECODE=1` on the CI test steps so it is never generated. Affected 1.0.40 and 1.0.41, which shipped with bytecode included.
- `estack-read-claude-session-history` docs: the `session-report` mode (added in 1.0.40) was missing from several global-flag lists that it actually honors. Added it to the `--project` applies-to lists (SKILL.md + modes.md), the `--exclude-current` list (SKILL.md), the half-open `--since/--until` message-level mode list (modes.md), and the JSON shapes table (modes.md). No behavior change — the mode already shared the engagement code path and respected these flags; only the docs lagged.

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

[Unreleased]: https://github.com/ElliotDrel/e-stack/compare/v1.0.61...HEAD
[1.0.61]: https://github.com/ElliotDrel/e-stack/compare/v1.0.60...v1.0.61
[1.0.60]: https://github.com/ElliotDrel/e-stack/compare/v1.0.59...v1.0.60
[1.0.59]: https://github.com/ElliotDrel/e-stack/compare/v1.0.58...v1.0.59
[1.0.58]: https://github.com/ElliotDrel/e-stack/compare/v1.0.57...v1.0.58
[1.0.57]: https://github.com/ElliotDrel/e-stack/compare/v1.0.55...v1.0.57
[1.0.55]: https://github.com/ElliotDrel/e-stack/compare/v1.0.54...v1.0.55
[1.0.54]: https://github.com/ElliotDrel/e-stack/compare/v1.0.53...v1.0.54
[1.0.53]: https://github.com/ElliotDrel/e-stack/compare/v1.0.52...v1.0.53
[1.0.52]: https://github.com/ElliotDrel/e-stack/compare/v1.0.51...v1.0.52
[1.0.51]: https://github.com/ElliotDrel/e-stack/compare/v1.0.50...v1.0.51
[1.0.50]: https://github.com/ElliotDrel/e-stack/compare/v1.0.49...v1.0.50
[1.0.49]: https://github.com/ElliotDrel/e-stack/compare/v1.0.48...v1.0.49
[1.0.48]: https://github.com/ElliotDrel/e-stack/compare/v1.0.47...v1.0.48
[1.0.47]: https://github.com/ElliotDrel/e-stack/compare/v1.0.46...v1.0.47
[1.0.46]: https://github.com/ElliotDrel/e-stack/compare/v1.0.45...v1.0.46
[1.0.45]: https://github.com/ElliotDrel/e-stack/compare/v1.0.44...v1.0.45
[1.0.44]: https://github.com/ElliotDrel/e-stack/compare/v1.0.43...v1.0.44
[1.0.43]: https://github.com/ElliotDrel/e-stack/compare/v1.0.42...v1.0.43
[1.0.42]: https://github.com/ElliotDrel/e-stack/compare/v1.0.41...v1.0.42
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
