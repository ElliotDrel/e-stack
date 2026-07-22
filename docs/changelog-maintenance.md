# Changelog Maintenance

`CHANGELOG.md` lives at the repo root and follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. This doc explains how to keep it accurate as skills and hooks move through the add → edit → publish flow.

## The Two-Phase Pattern

All CHANGELOG work splits into two phases:

| Phase | When | What |
|---|---|---|
| **Write** | During add / edit / hook work | Add entries to `[Unreleased]` |
| **Promote** | During publish (`steps/publish.md`) | Rename `[Unreleased]` → versioned section |

Never update CHANGELOG after the fact. Write entries as part of the same change that creates or modifies the skill/hook.

---

## Phase 1 — Writing Unreleased Entries

The `[Unreleased]` section sits at the very top of `CHANGELOG.md` and accumulates every user-visible change since the last release.

### Categories

Only include the categories that have entries for this change.

| Header | Use when |
|---|---|
| `### Added` | New skill, new hook, or new capability in an existing skill |
| `### Changed` | Behavior change, significant update, install path change |
| `### Fixed` | Bug fix or incorrect behavior corrected |
| `### Removed` | Skill or hook removed from the pack |
| `### Deprecated` | Skill or feature still present but being phased out |
| `### Security` | Security vulnerability patched |

### Entry format

Skills:
```
- `estack-<skill-name>` skill — <one-line user-facing description>
```

Hooks:
```
- `<hook-name>` hook — <one-line user-facing description>
```

Write from the **installer's perspective**: describe what the user gains or loses, not how the code changed.

| Good | Bad |
|---|---|
| `` `estack-read-claude-session-history` skill — 20+ analysis modes, timeline view, JSON output `` | `refactored read-claude-session-history: modular lib, 20+ modes, test suite, reference docs` |
| `` Fixed `estack-repo-search` path passed to subagent on Windows `` | `fix installer hash false positives on Windows (CRLF vs LF)` |

### What NOT to document

Skip these — they don't belong in a user-facing changelog:

- Internal refactors with no user-visible effect (splitting a file into modules, renaming a variable)
- Docs-only changes (README/CLAUDE.md edits that don't affect the installed skill pack)
- Version bump commits themselves (`1.0.27`, `bump to 1.0.17`)
- Changes that were reverted before release
- CI / workflow changes

When in doubt: would a user running `npx elliot-stack@latest` notice this change? If yes, document it. If no, skip it.

### Example `[Unreleased]` block

```markdown
## [Unreleased]

### Added
- `estack-foo-coach` skill — step-by-step coaching through Chris Voss negotiation techniques
- `estack-flight-planner` skill — builds a flight plan from a destination and travel constraints

### Fixed
- `estack-repo-search`: corrected full repo path passed to subagent on Windows
```

---

## Phase 2 — Promoting Unreleased on Publish

Run this BEFORE `npm version patch` so the version number is known and the CHANGELOG commit is separate from the npm version commit.

**Step 1.** Determine the next version: check `package.json` `"version"` field and apply the planned bump (patch / minor / major).

**Step 2.** In `CHANGELOG.md`, rename the top section:
```
## [Unreleased]
```
→
```
## [X.Y.Z] - YYYY-MM-DD
```
(Use today's date in `YYYY-MM-DD` format.)

**Step 3.** Add a fresh empty `[Unreleased]` block above the new versioned section:
```markdown
## [Unreleased]

---

## [X.Y.Z] - YYYY-MM-DD
```

**Step 4.** Update the comparison links at the bottom of the file:
- Change the `[Unreleased]` link to start from the new tag:
  ```
  [Unreleased]: https://github.com/ElliotDrel/e-stack/compare/vX.Y.Z...HEAD
  ```
- Add a new versioned link for the new release:
  ```
  [X.Y.Z]: https://github.com/ElliotDrel/e-stack/compare/vPREVIOUS...vX.Y.Z
  ```

**Step 5.** Commit just the CHANGELOG change before tagging:
```bash
git add CHANGELOG.md
git commit -m "update CHANGELOG for X.Y.Z"
```

Then proceed with `npm version patch && git push --follow-tags` as usual.

### Before and after example

Cutting `1.0.28` (previous was `1.0.27`):

**Before:**
```markdown
## [Unreleased]

### Added
- `estack-foo-coach` skill — ...

[Unreleased]: https://github.com/ElliotDrel/e-stack/compare/v1.0.27...HEAD
```

**After:**
```markdown
## [Unreleased]

---

## [1.0.28] - 2026-06-05

### Added
- `estack-foo-coach` skill — ...

[Unreleased]: https://github.com/ElliotDrel/e-stack/compare/v1.0.28...HEAD
[1.0.28]: https://github.com/ElliotDrel/e-stack/compare/v1.0.27...v1.0.28
```

---

## Quick Reference

```
ADD/EDIT/HOOK work  →  write to [Unreleased]
PREP (no publish)   →  verify [Unreleased] covers the work — never promote
PUBLISH             →  promote [Unreleased] → [X.Y.Z] - date, commit, then npm version + tag
```
