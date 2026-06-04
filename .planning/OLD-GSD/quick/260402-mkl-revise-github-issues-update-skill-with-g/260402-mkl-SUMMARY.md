---
phase: quick
plan: 01
subsystem: github-issues-update
tags: [skill-revision, agent-orchestration, api-optimization]
dependency_graph:
  requires: []
  provides: [startup-command, fetch-issues-command, build-tracker-command, result-file-schema, batched-analysis, cross-issue-synthesis]
  affects: [github-issues-update/SKILL.md, github-issues-update/bin/tracker-tools.cjs, github-issues-update/workflows/check-issues.md, github-issues-update/setup.md, github-issues-update/workflows/save-issues.md]
tech_stack:
  added: []
  patterns: [batched-agent-analysis, cross-issue-synthesis, verification-agent, quality-flags]
key_files:
  created:
    - github-issues-update/references/result-file-schema.md
  modified:
    - github-issues-update/bin/tracker-tools.cjs
    - github-issues-update/SKILL.md
    - github-issues-update/workflows/check-issues.md
    - github-issues-update/setup.md
    - github-issues-update/workflows/save-issues.md
decisions:
  - "Unified result file schema for both setup and check-in workflows"
  - "Batched analysis agents (~5 issues per batch) instead of 1 agent per issue"
  - "Startup command consolidates auth + parse + discovery into single call"
  - "Setup runs compile-report at end instead of redirecting to check-in workflow"
metrics:
  duration: 534s
  completed: 2026-04-03T12:27:44Z
  tasks: 6
  files: 6
---

# Phase Quick Plan 01: Revise github-issues-update Skill Summary

Consolidated skill from 5-command script to 8-command script with single `startup` entry point, parallel `fetch-issues`, and `build-tracker` composition. Batched analysis agents replace per-issue subagents. Cross-issue synthesis and verification agents added with quality flags.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Define standardized result file format | 38c885a | references/result-file-schema.md (new) |
| 2 | Add startup, fetch-issues, build-tracker commands | f74b474 | bin/tracker-tools.cjs |
| 3 | Revise SKILL.md router to use startup | 9b452f5 | SKILL.md |
| 4 | Revise check-issues.md workflow | f004b14 | workflows/check-issues.md |
| 5 | Revise setup.md workflow | b23edb9 | setup.md |
| 6 | Revise save-issues.md to use startup data | 2ebb56c | workflows/save-issues.md |

## Key Changes

### tracker-tools.cjs (3 new commands)
- **startup**: Auth check via `gh auth status`, tracker parse, parallel gh api search for new/reopened/recently-closed issues. Defaults null `last_check_date` to 30 days ago.
- **fetch-issues**: Reads issues JSON, runs all gh api calls in parallel (max 15 concurrent via `batchRun`), extracts `cross_references` and `urls` from body/comments, writes `raw-OWNER-REPO-NUMBER.json` per issue.
- **build-tracker**: Reads result files + template, maps all fields from schema, composes complete tracker file.

### SKILL.md Router
- Single `startup` call replaces `resolve_paths` + `parse-tracker` two-step process.
- Routes based on startup response: auth status, tracker existence, issue count.
- Passes `$STARTUP` (not `$TRACKER_DATA`) to all workflows.

### check-issues.md
- Removed general check subagent entirely (startup covers new issue discovery).
- Added `fetch-issues` script call for all API data fetching.
- Batched analysis agents (~5 issues per batch) with QUALITY REQUIREMENTS block.
- Cross-issue synthesis agent (clusters, contradictions, gaps, priority, untracked cross-refs).
- Verification agent with Quality Flags check for shallow-output patterns.
- Completion checklist (8 items) replaces simple validate step.
- Duplicate search runs for ALL issues, not just authored.

### setup.md
- Uses startup data directly (no auth check, no username prompt, no discovery subagent).
- Summary-based confirmation for >10 issues.
- Uses `fetch-issues` for parallel API data.
- Uses `build-tracker` command instead of manual composition.
- Runs `compile-report` at end for immediate overview (no auto check-in redirect).

### save-issues.md
- All `$TRACKER_DATA` references replaced with `$STARTUP` equivalents.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Self-Check: PASSED

All 6 created/modified files verified present. All 6 commit hashes verified in git log.
