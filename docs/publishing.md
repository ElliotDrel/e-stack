# Publishing

E-Stack publishes through `.github/workflows/publish.yml` when a `v*` tag is
pushed. A regular commit or PR does not publish a package.

```bash
npm version patch
git push origin HEAD refs/tags/vX.Y.Z
```

Use `minor` or `major` when the release warrants it. `npm version` changes
`package.json`, creates a commit, and creates the tag; pushing the intended tag
starts the release. Replace `vX.Y.Z` with the created version. Do not run either
command until the release is ready and the user has explicitly approved
publication.

## Release checks

The publish workflow checks that the tag matches `package.json` and runs the
repository's version, inventory, name, path, and test gates. Run the applicable
checks during release preparation so failures are found before the tag exists.
See `.agents/skills/manage-e-stack/steps/prep.md` for the current preparation
workflow.

## Installation architecture

Packaged skills install under `~/.agents/skills/estack-*/`; Claude may consume
them through its linked skill location. Most hooks are Claude Code integrations
registered through `~/.claude/settings.json`. The shared startup updater uses
host-specific adapters and registrations, including the Codex adapter. Follow
the installer and the relevant hook code for the actual host path; do not assume
every hook has the same installation location.

`node bin/install.cjs` previews installation by default. A live install can
replace local files and edit host settings, so show its real diff and obtain
approval before using `--install`.

## Configuration baseline and live verification

The settings below are the intended security baseline, recorded from prior
repository audits. They are not proof of the current GitHub or npm configuration.
Before relying on one, inspect it with an authorized, read-only query and report
whether it was verified, unavailable, or differs from the baseline. Do not change
repository, npm, or security settings as part of a health check.

- `main` is expected to require pull requests for non-admin contributors, retain
  linear history, and block force pushes and deletion.
- GitHub Actions is expected to use read-only repository contents plus the OIDC
  permission required for npm Trusted Publishing.
- The publish workflow is expected to avoid persisted checkout credentials.
- npm is expected to use Trusted Publishing and to keep token-based publishing
  disabled outside the documented manual fallback.

Useful read-only checks include the workflow file in the checked-out repository,
`gh run list --workflow publish.yml`, and authenticated `gh api` reads of the
relevant repository settings. A failed read is not evidence that the setting has
its documented value.

Do not use `gh workflow run publish.yml` as an Actions health check. It creates a
workflow dispatch attempt and does not test the tag-triggered release path.

## Failure handling

If the tagged release fails, inspect the specific run and its failed logs. Keep
the local checks and the remote publication result separate in the report. For a
manual publish only when Actions are unavailable, read
[`manual-publish.md`](manual-publish.md); it has additional authorization and
cleanup requirements.
