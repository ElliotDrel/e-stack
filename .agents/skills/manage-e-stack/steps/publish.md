# Publish E-Stack to npm

Follow each phase in order. There is one approval gate.

## Phase 1: Pre-publish Checks

Verify the repo is ready to publish:

1. Run `git status --short` and `git diff --stat` to see what will be committed
2. Confirm everything intended for the release is committed and on `main` (or staged to be committed in this flow)
3. Do NOT include unrelated files (e.g. `Untitled-1.md`)
4. Run `node scripts/check-versions.cjs` — every skill/hook whose content changed since the last release must have a bumped version. If it reports FAILs, bump the versions (or run `node scripts/check-versions.cjs --fix` to auto-patch-bump) and commit before tagging. The publish workflow runs this same check as a hard gate, so a missed bump will fail the release in CI.
5. Run `node scripts/update-skill-feedback.cjs --check` — every skill must have a feedback section matching the current template. If it reports DIFFs, run `node scripts/update-skill-feedback.cjs` to sync, then commit (and re-run step 4 to pick up any version bumps needed for the changed skills).
6. Run `node scripts/check-docs.cjs` — README.md and AGENTS.md must list every skill and hook (and nothing that no longer exists). If it reports FAILs, update the README Skills/Hooks tables and the AGENTS.md "Skills in the pack" / "Hooks in the pack" lines and commit. The publish workflow runs this same check as a hard gate.
7. **Promote `CHANGELOG.md`** — move all entries from `[Unreleased]` into a new versioned section. Do this BEFORE `npm version` so the CHANGELOG commit is separate from the version-bump commit:
   - Determine the next version: read `"version"` in `package.json` and apply the planned bump (patch / minor / major).
   - Rename `## [Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD` (today's date).
   - Add a fresh empty `## [Unreleased]` block above the new section.
   - Update the comparison links at the bottom: change `[Unreleased]` to start from the new tag, and add `[X.Y.Z]: .../compare/vPREV...vX.Y.Z`.
   - Commit: `git add CHANGELOG.md && git commit -m "update CHANGELOG for X.Y.Z"`
   - If `[Unreleased]` was already empty (no user-visible changes since last release), still add the empty block and update the links — skip nothing.
   - See `docs/changelog-maintenance.md` for full format rules and a before/after example.

## Phase 2: Bump Version, Tag, and Push — APPROVAL GATE

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

## Phase 3: Post-publish Verification

After pushing, verify both GitHub Actions and npm:

1. **GitHub Actions** — check `gh run list` for the run. Watch with `gh run watch <id> --exit-status`. If it failed, read logs with `gh run view <id> --log-failed`.
2. **npm** — check `npm view elliot-stack version` bumped correctly.

Report the final status: GitHub Actions pass/fail and the new npm version number.

## Troubleshooting

If a publish fails or you need to debug the workflow, auth setup, or OIDC configuration, read `docs/publishing.md` — it has the full details including known gotchas and past learnings.
