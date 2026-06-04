# Quick Task 260403-bmd: Build estack distribution - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Task Boundary

Build dual distribution for elliot-skills repo:
1. Plugin marketplace (`.claude-plugin/`) with `estack` namespace → `/estack:better-title`
2. npx installer (`npx estack@latest`) that copies skills to `~/.claude/skills/` with auto-update via Claude Code startup hook
3. Local change detection on update — prompt user before overwriting modified files

</domain>

<decisions>
## Implementation Decisions

### npm Package Naming
- Package name: `estack` (unscoped)
- Install command: `npx estack@latest`

### Local Change Detection UX
- Prompt once for all modified files (not per-file)
- List all modified skills, ask: overwrite all / skip all / abort
- Detection via checksum comparison (hash installed files vs package files)

### Repo Structure
- Claude's Discretion — user said "anything you need"
- Decision: Move skills into `skills/` directory (plugin marketplace requires this, clean structure)
- `skills/better-title/`, `skills/chris-voss/`, `skills/github-issues-update/`

### Skill Naming
- Plugin marketplace prefix: `estack` → `/estack:better-title`
- npx standalone install: same `estack:` prefix in SKILL.md `name` field for consistency

</decisions>

<specifics>
## Specific Ideas

- npx installer should also set up a Claude Code startup hook for auto-updates
- Checksum file (`.estack-checksums.json`) stored alongside installed skills to detect local modifications
- Both distribution paths serve the same skill content from the same repo
- SKILL.md frontmatter `name` fields need updating to include `estack:` prefix

</specifics>

<canonical_refs>
## Canonical References

- Claude Code plugin docs: https://code.claude.com/docs/en/plugins
- Claude Code marketplace docs: https://code.claude.com/docs/en/plugin-marketplaces
- Claude Code skills docs: https://code.claude.com/docs/en/skills
- google-tools-mcp (npx pattern reference): https://github.com/karthikcsq/google-tools-mcp
- GSD (npx installer reference): https://github.com/gsd-build/get-shit-done

</canonical_refs>
