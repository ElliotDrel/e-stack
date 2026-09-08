---
name: manage-e-stack
version: 1.0.0
description: >-
  (manage-e-stack) Manage changes to E-Stack skills, hooks, installation, and
  releases. Use for work in `skills/`, `hooks/`, or the matching release flow.
---

# Working on E-Stack

Use the route that matches the user's requested outcome, then read its step file
for the task-specific details.

| Requested outcome | Step file |
|---|---|
| Add or migrate a skill | `steps/add.md` |
| Edit an existing skill | `steps/edit.md` |
| Add or edit a hook | `steps/add-hook.md` |
| Make completed work release-ready without publishing | `steps/prep.md` |
| Publish a release to npm | `steps/publish.md` |

## Shared rules

- The user's request sets the scope. Complete authorized repository edits and
  use routine judgment without adding an approval pause. Ask only when a choice
  changes the intended result or an action has not been authorized.
- Work in the tracked source directories. `.agents/skills/` is this repository's
  source for its development skill; `.claude/skills/` is a local convenience
  link and is not edited directly.
- Keep skill names and frontmatter valid. Bump a changed skill or hook version
  according to the repository's release check. Update the README and AGENTS
  inventories when adding, removing, or renaming an item, and update
  descriptions when their user-facing purpose materially changes.
- Keep durable skill state under `~/.e-stack/<skill-folder>/` and shared secrets
  in `~/.e-stack/.env`. Do not expose or persist credentials elsewhere.
- Use targeted edits and verification that match the change. The release gates
  are useful evidence, but do not turn a small documentation revision into an
  unrelated full-suite exercise.
- Before a requested push, rebase onto the relevant remote branch when the
  repository workflow requires it, preserve scoped work, and push only the
  intended branch and tag references.

Detailed contracts live in [`docs/skill-authoring.md`](../../../docs/skill-authoring.md),
[`docs/hook-authoring.md`](../../../docs/hook-authoring.md),
[`docs/changelog-maintenance.md`](../../../docs/changelog-maintenance.md), and
[`docs/publishing.md`](../../../docs/publishing.md).

## Install and release boundaries

`node bin/install.cjs` is a read-only preview by default. A live install changes
the user's installed skills and host configuration: run the preview, show the
actual diff, and wait for the user's approval before `--install`.

Publishing is tag-triggered. A pushed `v*` tag starts a real npm release, so do
not run `npm version` or push such a tag without explicit publication approval.
The prep route does not publish.

Commit and push only as the requested delivery path requires. Preserve unrelated
work and verify the intended files, branch, and remote state before a publication
step.
