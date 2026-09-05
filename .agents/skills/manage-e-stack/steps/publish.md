# Publish E-Stack to npm

Prep and publish are separate routes. `steps/prep.md` makes work release-ready without releasing; this file cuts the actual release and sweeps up everything already prepped — everything in `[Unreleased]` ships. If the user wants work staged but NOT released ("get it ready to publish, but don't publish yet"), stop — that's `steps/prep.md`.

Follow each phase in order. There is one approval gate.

## Phase 1: Verify Release-Ready

1. Run `git pull --rebase origin main` — pick up work prepped by other sessions. Then `git fetch --tags`: `check-versions.cjs` diffs against the newest local `v*` tag, and a stale tag list makes it compare against an older release and pass a skill that CI will fail (v1.0.75, 2026-09-05: local check said v1.0.73, CI said v1.0.74, productivity coach needed 1.3.1).
2. Run `git status --short` and `git diff --stat`. Everything intended for this release must be committed on `main`. Uncommitted and untracked files do NOT ship (the tag only captures commits) — leave other sessions' in-flight work alone, but flag anything that looks like it was meant for this release and ask the user.
3. Re-run the deterministic gates from `steps/prep.md` Phase 1 — always re-run them even if a prep pass already did. Any FAIL means the repo is not release-ready — fix per prep.md Phase 1 and commit before continuing.
4. **Judgment reviews.** Every skill changed since the last release needs the skill-flow/UX review and prompting-rules audit in `steps/prep.md` Phase 2. Confirmation requires evidence: this session ran prep for that skill, or the user says it was prepped. Without either, treat the skill as unprepped and run that phase for it now.

## Phase 2: Promote CHANGELOG

Promote `[Unreleased]` into a versioned section, BEFORE `npm version` so the CHANGELOG commit stays separate from the version-bump commit. Follow the full procedure in `docs/changelog-maintenance.md` → "Promoting Unreleased on Publish" (rename the section, fresh empty `[Unreleased]` block, comparison links, commit as `"update CHANGELOG for X.Y.Z"`). If `[Unreleased]` is empty, still do all of it — skip nothing.

## Phase 3: Bump Version, Tag, and Push — APPROVAL GATE

Key rules:
- **Sync first** — run `git pull --rebase origin main` so the version bump lands on top of latest `main`.
- **`npm version patch` does three things**: updates `package.json`, makes a commit (e.g. `1.0.16`), and creates a matching `v1.0.16` tag locally. Use `minor` or `major` for non-patch bumps.
- **Tags trigger publishing.** Pushing a `v*` tag runs the npm publish workflow. Never push a `v*` tag unless you intend to release.
- **Only the repo owner can push to `main`.** Branch protection requires PRs from everyone else.

Show the user the planned bump (current → next version) and ask: **"Ready to bump to vX.Y.Z and push the tag (this publishes)?"**

After they confirm:
```bash
npm version patch        # or minor / major
git push --follow-tags   # pushes commit + tag, tag triggers publish
```

If `npm version` refuses with "Git working directory not clean" because of unrelated in-flight work from another session: confirm with the user that none of it belongs in this release, then use `npm version patch --force` — it only commits `package.json`, so the dirty files stay uncommitted and unshipped.

## Phase 4: Post-publish Verification

After pushing, verify both GitHub Actions and npm:

1. **GitHub Actions** — check `gh run list` for the run. Watch with `gh run watch <id> --exit-status`. If it failed, read logs with `gh run view <id> --log-failed`.
2. **npm** — check `npm view elliot-stack version` bumped correctly.

Report the final status: GitHub Actions pass/fail and the new npm version number.

## Troubleshooting

If a publish fails or you need to debug the workflow, auth setup, or OIDC configuration, read `docs/publishing.md` — it has the full details including known gotchas and past learnings.
