---
name: manage-e-stack
description: "MUST USE for any work on the e-stack repo — adding, editing, prepping, or publishing skills. Triggers: 'add a skill to e-stack', 'edit an estack skill', 'publish e-stack', 'release to npm', 'prep for release', 'get it ready to publish but don't publish', 'put this in e-stack', 'fix this skill', 'ship it', or any change to files under skills/ or package.json in this repo. Routes to the right step file based on intent."
---

# Working on E-Stack

This skill is the entry point for all e-stack work. Pick the route that matches the user's intent, then follow the matching step file exactly.

## Routes

| Intent | Step file |
|---|---|
| Add a new skill, migrate an existing skill into the repo | `steps/add.md` |
| Edit a skill that already exists in `skills/` (SKILL.md, scripts, references) | `steps/edit.md` |
| Add or edit a hook (anything in `hooks/`) | `steps/add-hook.md` |
| Prep for a later release — make finished work release-ready WITHOUT publishing ("get it ready to publish but don't publish", "don't publish yet", other work still in flight, another session will publish) | `steps/prep.md` |
| Publish to npm — push a release, ship it, verify a publish | `steps/publish.md` |

If the user's intent spans more than one route (e.g. "add a skill and publish"), run them in order: add → edit (if needed) → prep or publish. Each step file has its own approval gates — do not skip them.

## Universal Conventions

These apply to every route. Violating them breaks the install or publish.

- **Skill folders** in `skills/` MUST be prefixed with `estack-` (e.g. `skills/estack-chris-voss/`)
- **`name` field** in frontmatter MUST match the folder name exactly
- **`description` field** MUST start with `(<short-name>)` where short-name is the folder name without the `estack-` prefix — e.g. `(chris-voss) Applies...`
- **Docs MUST list every skill and hook — and must be accurate.** Adding, renaming, or removing a skill or hook requires updating the README.md Skills/Hooks tables AND the AGENTS.md "Skills in the pack" / "Hooks in the pack" lines in the same change (project instructions live in AGENTS.md; CLAUDE.md just imports it). If a skill's behavior or description changes, update the README description and any relevant `docs/` reference files before publishing. `node scripts/check-docs.cjs` verifies both files against `skills/` and `hooks/` (missing AND stale entries); the publish workflow runs it as a hard gate, so out-of-date docs block the release.
- **`version` field** (semver, e.g. `version: 1.0.0`) MUST exist in every skill's frontmatter. New skills start at `1.0.0`. **Bump it on every content change** (patch = fix/tweak, minor = new capability, major = rewrite/breaking). Hooks carry a `// @version x.y.z` comment instead. `node scripts/check-versions.cjs` verifies every changed skill/hook bumped its version since the last release (`--fix` auto-bumps patch); the publish workflow runs it as a hard gate. Per-item versions are the human-readable label — the installer's content hashes remain the update-detection source of truth.
- **A skill's files go in one place.** State belongs in `~/.e-stack/<skill-folder>/`, never a new home-directory dotfile, a bare home folder, or anything under `~/.claude/`. Every API key in the pack lives in the single shared `~/.e-stack/.env` — never a per-skill `.env`, never inside the installed skill folder (the installer overwrites it on every sync), and never persisted into the OS environment via `setx` or a shell profile, which hides it from every other skill and loses it on a new machine. `node scripts/check-paths.cjs` enforces both and the publish workflow runs it as a hard gate. A read-only path into another tool's data goes in that script's `ALLOWED_PREFIXES`; a deliberate legacy-compatibility line gets an `estack-path-ok` comment. Full rules in `docs/skill-authoring.md`.
- **Publishing is tag-triggered.** `npm version patch && git push --follow-tags` bumps `package.json`, commits, creates a `v*` tag, and pushes — the tag triggers the npm publish workflow. Regular commits do NOT publish.
- **NEVER push a `v*` tag without intent to publish.** Any `v*` tag push runs a real npm release.
- **Prep ≠ publish.** `steps/prep.md` leaves work release-ready (gates green, versions bumped, `[Unreleased]` entries written, committed and pushed) without releasing anything; the next `steps/publish.md` run sweeps up everything prepped. When the user says "don't publish yet" or other work is in flight, route to prep.
- **Only the repo owner can push to `main`.** Branch protection requires PRs from everyone else.
- **Live install location:** `~/.agents/skills/estack-*/` (symlinked from `~/.claude/skills/estack-*/`; the installer copies from `skills/` here)
- **Renaming/removing a skill** needs no installer edit. Deleting the folder from `skills/` is enough: the installer compares its checksum manifest against what the package ships and retires anything it recorded installing that is gone, both on disk and in the manifest. `DEPRECATED_SKILLS` in `bin/install.cjs` is legacy-only — do NOT add to it. It covers two names removed before that existed, where an old install may have no manifest entry to prune.
- **Hooks** live in `hooks/<name>.js` at the repo root (flat — no subfolders). They are Claude Code-only: unlike skills, hooks cannot be installed into `~/.agents/` and discovered from there. The installer copies them to `~/.claude/hooks/` and registers each via a dedicated `setup<Name>Hook(dryRun)` function in `bin/install.cjs` that idempotently patches `~/.claude/settings.json` (and honors `dryRun` by returning before writing). Hook scripts MUST wrap their body in `try { ... } catch { /* never break the tool */ }` and exit 0 — a hook crash must never break the underlying tool call. See `docs/hook-authoring.md`.
- **Installer:** `node bin/install.cjs` from repo root **dry-runs by default** (previews changes, writes nothing); add `--install` to actually sync. `--dry-run` forces a preview even under `npx`. Always pass `--yes` alongside `--install` when running it from an agent or a script: locally modified items trigger an interactive prompt that reads EOF on a non-TTY stdin and aborts the entire install. `--yes` answers it with "back up local changes, install the latest"; `--skip-modified` answers it with "keep local versions". Add `--no-statusline` to remove the statusline (`--statusline` restores it, `ESTACK_NO_STATUSLINE=1` skips it for one run).
- **Installer settings:** there is exactly ONE settings file, `~/.e-stack/.env`, the same one skills read API keys from. Installer settings are env vars in it: `ESTACK_SKILLS_DIR`, `ESTACK_HOOKS_DIR`, `ESTACK_BACKUP_DIR`, `ESTACK_NO_STATUSLINE`, plus `ESTACK_HOME` for the file's own location. Resolution is live environment first, then the file, matching every skill. Never add a second config file, a JSON sidecar, or a marker file — put the new setting in `.env` under an `ESTACK_*` name and write it with `writeSetting()`, which replaces or appends only that one line so shared credentials survive. Installer *state* is a different thing from settings: derive it from the existing checksum manifest (`~/.claude/.estack-checksums.json`) the way the statusline claim does, rather than persisting a new field.
- **Testing the installer:** `os.homedir()` follows `USERPROFILE`, so the whole installer runs against a throwaway home — `USERPROFILE=<tmp> node bin/install.cjs --install --yes`. Use it for anything touching settings, paths, or `settings.json` wiring instead of experimenting on a real setup.
- **Prefer deterministic changes.** Any time a change can be made exactly and reproducibly — via a shell command, an existing repo script, or a targeted diff (Edit tool) — use that instead of reading content and regenerating it. AI-generated output is never byte-for-byte identical to the source; transcription errors accumulate even on "trivial" tasks. Apply this to everything:
  - **File copies**: `cp -r` / `xcopy /E /I` / `robocopy /E`, not Read+Write
  - **File moves/renames**: `mv` / `Rename-Item`, not Read+Write+Delete
  - **Small edits to existing files**: Edit tool (diff patch), not Read+full Write
  - **Structured data changes**: `jq`, `yq`, `sed`, or a repo script, not manual reconstruction
  - **Anything a repo script already handles**: run it (`node scripts/check-versions.cjs --fix`, `node scripts/update-skill-feedback.cjs`, etc.) — don't reproduce its output by hand
  Reserve AI-generated content for what genuinely requires judgment: writing new prose, synthesizing information, making decisions.
- **Always `git pull --rebase origin main`** before committing or pushing. The user wants a linear commit history, so never plain `git pull` or `git merge` (those create merge commits).
- **`CHANGELOG.md` must stay in sync.** Every add/edit/hook step writes an entry to `[Unreleased]`; publish promotes that section to a versioned block. See `docs/changelog-maintenance.md` for the full format and before/after examples.

## Skill Map

```
SKILL.md              # You are here — router + universal conventions
steps/
  add.md              # New skill / migrate an existing skill into the repo
  edit.md             # Edit an existing skill (uses scripts/preflight.sh)
  add-hook.md         # Add or edit a hook in hooks/ (uses scripts/preflight.sh)
  prep.md             # Make work release-ready WITHOUT publishing (gates, reviews, changelog, commit+push)
  publish.md          # Cut a release: verify release-ready, promote CHANGELOG, npm version + push tag
scripts/
  preflight.sh        # Read-only diagnostics — installed vs repo state, frontmatter check
```

Now read the matching step file and follow it.
