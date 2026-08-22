# Prep for Release (No Publish)

Makes finished work release-ready without cutting a release. Use when the current work should ship in the NEXT release but the actual publish happens later — often in another session, while other work is still in flight. A later run of `steps/publish.md` sweeps up everything prepped here; nothing more is needed from this session.

Hard boundary — these three actions ARE the publish and belong to `steps/publish.md` only. Never do them here:

- Do NOT promote `CHANGELOG.md` (`[Unreleased]` stays `[Unreleased]`)
- Do NOT run `npm version`
- Do NOT push any `v*` tag

## Phase 1: Deterministic Gates

Run all six. CI (`.github/workflows/publish.yml`) runs gates 1, 3, 4, 5, and 6 as hard blocks on the release — anything missed here fails the publish later. Gate 2 is a repo convention, not a CI check.

Gate 5 exists because these conventions drifted badly before it did: skills had scattered into a dotfile each, a bare home folder, a OneDrive folder, an API key stored inside the installed skill folder that the installer wiped on every update, and a key told to live in a Windows user env var, where it shadowed the shared file and no other skill could see it. No diff review catches that, so it is enforced.

1. `node scripts/check-versions.cjs` — every skill/hook whose content changed since the last release must have a bumped version. If it reports FAILs, bump the versions (or run with `--fix` to auto-patch-bump).
2. `node scripts/update-skill-feedback.cjs --check` — every skill must have a feedback section matching the current template. If it reports DIFFs, run `node scripts/update-skill-feedback.cjs` to sync, then re-run gate 1 (syncing changes content, which may need version bumps).
3. `node scripts/check-docs.cjs` — README.md and AGENTS.md must list every skill and hook (and nothing that no longer exists). If it reports FAILs, update the README Skills/Hooks tables and the AGENTS.md "Skills in the pack" / "Hooks in the pack" lines.
4. `node scripts/check-skill-name.cjs --all` — skill names, frontmatter, and self-references must be correct (see `docs/skill-authoring.md` → "Skill Name Validation").
5. `node scripts/check-paths.cjs` — every skill must keep its state under `~/.e-stack/<skill-folder>/` and read credentials from the one shared `~/.e-stack/.env`. Catches a new dotfile in the home directory, a bare home folder, state parked under `~/.claude/`, a per-skill `.env`, a credential file inside the installed skill folder (which the installer overwrites on every sync), and any instruction telling a user to persist a key in the OS environment instead of the shared file. A path that is only *read* — another tool's data — gets its prefix added to `ALLOWED_PREFIXES` in the script; a deliberate legacy-compatibility line gets an `estack-path-ok` comment on that line. See `docs/skill-authoring.md` → "Where a Skill Puts the Files It Creates" and "Credentials and Environment Variables".
6. `pytest -q`, then the migrate smoke tests (exact commands in `.github/workflows/publish.yml`) — the test suite must pass.

## Phase 2: Judgment Reviews

These are judgment checks, not scripts. Run them for each skill touched by the work being prepped — leave skills that other in-flight sessions are editing to their own prep pass.

**Skill-flow / UX review.** The pack is a product; a released skill must be a seamless guided experience, not a pile of files. Especially for multi-file skills (routers, phases, sub-flows):

- **Every cross-reference resolves.** Sweep the skill for `.md` links and routing pointers; confirm each target file exists at that relative path. A dead route strands the user mid-session. (`grep -rn '\.md' skills/<name>` then check each path.)
- **The router covers every territory and every entry point routes somewhere.** No orphaned flow (a file nothing routes to) and no dangling promise (a route to a file that doesn't exist). Ambiguous openings have a disambiguating question.
- **No two flows do the same job.** Prefer one optimized flow over several that overlap. Where two flows legitimately border each other, each names the seam and routes across it, rather than duplicating the coaching. If two flows substantially overlap, merge them before release.
- **The whole thing reads as one guided experience** — a user dropped at the entry point is carried to a concrete outcome without hitting a dead end, a duplicate, or a "now what?".

**Prompting-rules audit.** Audit against `anthropic-prompting-best-practices.md` at the repo root:

- **No aggressive legacy emphasis.** Sweep for `CRITICAL` / `MUST` / `ALWAYS` / `NEVER` / `ABSOLUTELY` and stray all-caps emphasis added to force behavior — current models overtrigger on it. Downgrade to normal imperatives; keep emphasis only on genuine hard rules (destructive-action gates, never-fabricate-citations). (`grep -rnoE '\b(CRITICAL|MUST|ALWAYS|NEVER|ABSOLUTELY)\b' skills/<name>`.)
- **The `description` leads with real trigger phrases** and stays within the 1,536-char combined `description` + `when_to_use` cap.
- **Cross-session guidance is written as standing instructions**, not one-time steps ("apply every turn," not "do this now"), and scope is stated explicitly wherever literalism could narrow an instruction to the first case only.
- **Acceptance bars are binary and concrete**, not unmeasurable adjectives ("polished," "thorough").
- **Warmth is prompted** where the skill needs a warm voice — it is no longer the model default.

## Phase 3: CHANGELOG Entries

The add/edit/hook routes each write `[Unreleased]` entries as they go — verify entries exist and cover every user-visible change in this work; close any gaps now (format rules: `docs/changelog-maintenance.md`). Leave the section named `[Unreleased]` — promotion happens at publish.

## Phase 4: Commit and Push — APPROVAL GATE

Uncommitted work does not ship — the release tag only captures commits. Everything prepped must be committed and pushed to `main`.

1. Show the user the files to commit and the proposed commit message(s)
2. Ask: **"Ready to commit and push? (This does not publish — no tag is pushed.)"**
3. Only after they confirm:
   ```bash
   git pull --rebase origin main
   git add <only the files belonging to this work>
   git commit -m "<message>"
   git push
   ```

Stage only files belonging to this work — other sessions' in-flight changes stay untouched.

## Phase 5: Report Release-Ready

Tell the user, briefly:

- What this work added to `[Unreleased]`
- Which skill/hook versions were bumped
- All six gates green (or what was fixed)
- What remains for whoever publishes: just run `steps/publish.md` (promote CHANGELOG → `npm version` → push tag). This work gets swept into that release automatically.
