# Publish E-Stack to npm

Follow each phase in order. There is one approval gate.

## Phase 1: Pre-publish Checks

Verify the repo is ready to publish:

1. Run `git status --short` and `git diff --stat` to see what will be committed
2. Confirm everything intended for the release is committed and on `main` (or staged to be committed in this flow)
3. Do NOT include unrelated files (e.g. `Untitled-1.md`)

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
