# Quick Task 260403-hiu: Add history/audit trail section to tracker issues - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Task Boundary

Add a history/audit trail section to each issue in the tracker file that logs actions taken on the issue over time — from filing to sending comments, external events detected during check-ins, etc.

</domain>

<decisions>
## Implementation Decisions

### History Format
- Timestamped bullet list per issue: `- **YYYY-MM-DD:** Action description`
- Simple, scannable, chronological

### What Gets Logged
- Our actions: filing, commenting, posting workarounds, updating tracker entries
- Key external events detected during check-ins: maintainer replies, state changes, PRs merged
- Both types logged as history entries during the relevant workflow step

### Where It Lives
- Per-issue section in github-tracker.md itself
- New `**History:**` field on each issue entry, alongside existing fields like Status, Next steps, etc.

</decisions>

<specifics>
## Specific Ideas

- History entries should be appended chronologically (newest last)
- The section needs to be added to: tracker-schema.md (schema), tracker-template.md (template), result-file-schema.md (result files), and the CJS tooling that builds/updates the tracker
- Workflows (check-issues.md, save-issues.md) need to write history entries when actions occur

</specifics>

<canonical_refs>
## Canonical References

- `github-issues-update/references/tracker-schema.md` — current tracker format
- `github-issues-update/references/result-file-schema.md` — result file format consumed by build/update commands
- `github-issues-update/bin/tracker-tools.cjs` — data service layer (update-tracker, build-tracker commands)

</canonical_refs>
