# Publish E-Stack to npm

Use this route only when the user explicitly asks to release. A pushed `v*` tag
triggers the npm publication workflow.

First inspect the current branch, tags, working tree, and release notes. Fetch
the relevant remote state, run the release checks in `prep.md`, and confirm that
the intended changes are committed through the repository's approved delivery
path. Review unresolved release-relevant failures before continuing.

Promote `[Unreleased]` according to `docs/changelog-maintenance.md`, then show
the concrete version change, release notes, and tag that would be published.
This is the approval point: wait for explicit confirmation before running
`npm version` or pushing a `v*` tag.

After approval, run the selected `npm version` command and push the resulting
commit and the intended tag reference. Prefer an explicit tag ref such as
`refs/tags/vX.Y.Z` over `--follow-tags` when other local tags may exist. Verify
the resulting GitHub Actions run and published npm version. Report the evidence
and any external failure separately from local checks.
