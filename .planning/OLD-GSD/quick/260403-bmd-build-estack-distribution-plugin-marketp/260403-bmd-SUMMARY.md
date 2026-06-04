---
phase: 260403-bmd
plan: 01
subsystem: distribution
tags: [estack, npm, npx, claude-code, plugin-marketplace, skills]
provides:
  - skills/ directory with all 3 skills under estack: namespace
  - .claude-plugin/plugin.json and marketplace.json for Claude Code native plugin system
  - bin/install.cjs npx installer with checksum-based change detection
  - package.json npm package definition for npx estack@latest
affects: [sync.sh, CLAUDE.md, skills/]
tech-stack:
  added: [Node.js built-ins only (fs, path, crypto, readline, os)]
  patterns: [checksum-based idempotent installer, silent/interactive dual mode]
key-files:
  created:
    - .claude-plugin/plugin.json
    - .claude-plugin/marketplace.json
    - skills/better-title/ (moved from better-title/)
    - skills/chris-voss/ (moved from chris-voss/)
    - skills/github-issues-update/ (moved from github-issues-update/)
    - bin/install.cjs
    - package.json
  modified:
    - sync.sh (updated skill path from $REPO_DIR/$name to $REPO_DIR/skills/$name)
    - CLAUDE.md (updated layout docs)
    - skills/*/SKILL.md (added estack: prefix to name fields)
key-decisions:
  - Used git mv to preserve history when moving skills into skills/
  - Checksum approach: SHA-256 over sorted relativePath+fileContents for determinism
  - Auto-update via shell profile suggestion rather than fragile hooks
  - --silent mode auto-skips modified files (no prompt) for safe cron/profile use
  - Included tracker-tools.cjs and result-file-schema.md from main repo (uncommitted there)
duration: 5min
completed: 2026-04-03
---

# Phase 260403-bmd: Build estack Distribution Plugin + Marketplace Summary

**Restructured elliot-skills repo with skills/ directory, Claude Code plugin marketplace, and npx estack@latest installer with SHA-256 change detection.**

## Performance
- **Duration:** ~5 min
- **Tasks:** 2/3 complete (paused at human-verify checkpoint)
- **Files modified:** 21

## Accomplishments
- Moved all 3 skills into `skills/` using `git mv` (history preserved), added `estack:` prefix to all SKILL.md name fields
- Created `.claude-plugin/plugin.json` and `marketplace.json` for Claude Code native plugin system with `estack` namespace
- Built `bin/install.cjs`: zero-dependency Node installer that computes per-skill SHA-256 checksums, detects local modifications, prompts interactively (overwrite/skip/abort), supports `--silent` for auto-update use case
- Created `package.json` for `npx estack@latest` distribution
- Updated `sync.sh` and `CLAUDE.md` for new `skills/` layout

## Task Commits
1. **Task 1: Restructure repo and create plugin marketplace** - `f9179ef`
2. **Task 2: Build npx installer with change detection and auto-update hook** - `7a6055c`

## Files Created/Modified
- `skills/better-title/`, `skills/chris-voss/`, `skills/github-issues-update/` — relocated skill dirs
- `.claude-plugin/plugin.json` — plugin manifest with `"name": "estack"`
- `.claude-plugin/marketplace.json` — marketplace catalog with relative source paths
- `bin/install.cjs` — npx installer (~200 lines, zero dependencies)
- `package.json` — npm package definition, `"bin": { "estack": "bin/install.cjs" }`
- `sync.sh` — updated skill path to `skills/` subdirectory
- `CLAUDE.md` — updated layout docs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tracker-tools.cjs and result-file-schema.md missing from worktree**
- **Found during:** Task 1
- **Issue:** The worktree was on branch `worktree-agent-aa960e57` at commit `34ffefa`, but the main repo working directory had `github-issues-update/bin/tracker-tools.cjs` and `github-issues-update/references/result-file-schema.md` as uncommitted additions not yet pushed. The plan listed these as files to include in the skills/ move.
- **Fix:** Copied both files from the main repo working directory into the worktree's `skills/github-issues-update/` before committing.
- **Files modified:** `skills/github-issues-update/bin/tracker-tools.cjs`, `skills/github-issues-update/references/result-file-schema.md`
- **Commit:** f9179ef

**2. [Rule 1 - Bug] estack: prefix edits showed as unstaged after git mv commit**
- **Found during:** Task 2 staging
- **Issue:** After the Task 1 commit (which used `git mv` + content edits), git still showed the SKILL.md files as modified in the working tree due to Windows CRLF normalization. The estack: prefix was present in the committed objects but the working copy had LF vs CRLF divergence.
- **Fix:** Staged and committed the SKILL.md files again in Task 2 commit, which normalized them.
- **Files modified:** `skills/*/SKILL.md`
- **Commit:** 7a6055c

## Next Phase Readiness
Awaiting human verification (Task 3 checkpoint). User should test:
1. `node bin/install.cjs` — interactive install with summary output
2. `node bin/install.cjs --silent` — silent no-op (already up to date)
3. Edit a file in `~/.claude/skills/better-title/`, then re-run to test modification detection
4. `bash sync.sh better-title` — verify sync.sh still works

## Self-Check: PASSED
