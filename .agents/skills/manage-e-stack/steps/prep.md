# Prep for a Later Release

Use this route when the user wants release-ready work without an npm publication.
Do not run `npm version` or push a `v*` tag here; those actions publish.

## Verify release-relevant work

Run the repository's release checks that apply to the changed items:

1. `node scripts/check-versions.cjs` verifies changed skill and hook versions.
2. `node scripts/update-skill-feedback.cjs --check` verifies feedback sections
   after the shared template has been intentionally regenerated.
3. `node scripts/check-docs.cjs` verifies skill and hook inventories.
4. `node scripts/check-skill-name.cjs --all` verifies names and frontmatter.
5. `node scripts/check-paths.cjs` verifies E-Stack state and credential paths.
6. Run the test and migration commands required by `.github/workflows/publish.yml`
   when the changed code or release workflow calls for them.

Use failures as evidence: fix the affected item, rerun the relevant checks, and
avoid broad tests that cannot add confidence for the change. Review each touched
skill or hook for clear triggering, scoped instructions, valid links, and claims
grounded in its source material. The authoring guidance in `docs/skill-authoring.md`
covers the shared prompting principles.

## Prepare delivery

Add or update `[Unreleased]` entries when the work is intended to appear in the
release notes. Check the active branch, intended files, and remote state. If the
user's request covers commit and push, commit only the scoped work and publish it
through the requested branch or PR path. Otherwise report the release-ready
state without creating external repository changes.

Report the checks run, the skill or hook versions changed, and that publication
still requires the separate publish route.
