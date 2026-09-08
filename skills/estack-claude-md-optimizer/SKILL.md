---
name: estack-claude-md-optimizer
version: 2.0.0
description: >-
  (claude-md-optimizer) Create, audit, or maintain concise project instructions
  in CLAUDE.md or AGENTS.md. Use when a user asks to improve those files or
  capture durable project guidance from a session.
---

# Project Instruction Optimizer

Help the user keep project instructions useful, accurate, and proportionate to
the work. Good instruction files transfer durable intent and project knowledge;
they do not replace the codebase, current documentation, or the user's request.

## Respect the existing instruction architecture

Inspect the relevant project files before recommending a structural change. Keep
the user's chosen canonical file and import direction unless they ask to change
it. In particular, when `AGENTS.md` is canonical and `CLAUDE.md` imports it,
preserve that arrangement. A pointer file can be useful, but do not force either
direction or collapse two files merely for uniformity.

Choose the smallest helpful route:

- `routes/create.md` for new project instructions.
- `routes/refine.md` for an existing file.
- `routes/session-capture.md` for durable guidance surfaced during work.
- `routes/scale-check.md` when the user asks whether routing or supporting
  instructions would help.

Read a route only when its guidance is needed. The reference files are optional
background for a user who wants the underlying context-file philosophy.

## Authoring principles

- The user's request and stated preferences set the scope. Use their words and
  verified project facts; do not substitute a generic template.
- Keep instructions concise enough to be useful, without applying a fixed line
  limit, required footer, or universal section order.
- Include paths, commands, or implementation detail when they are stable and
  materially help a future agent. Verify details before preserving or adding
  them, and remove only when the user wants that change or evidence shows they
  mislead.
- Separate durable project guidance from task-specific plans and historical
  notes. Point to a maintained source when that better preserves accuracy.
- Keep factual claims traceable to supplied materials or current inspection.
  Do not invent a project convention because a generic instruction file would
  look more complete.

## Apply the requested change

For an audit, explain the material changes and their reasons. For a create,
refine, or capture request, make the authorized file edits after the relevant
inspection. Ask a focused question only when the answer changes the canonical
file, the meaning of an instruction, or another material outcome. Do not add
onboarding, status displays, recurring maintenance prompts, or approval steps
that the user's request has already covered.

Use targeted edits and verify the affected file or links. For a broader
reorganization or instruction-architecture change, apply the requested scope
after inspection; otherwise present a concrete, reviewable proposal.

## References

- `references/theo_claude_md_mentality.md` summarizes a letter-style approach
  to intent and recurring corrections.
- `references/gary_tan_router_claude_md_mentality.md` summarizes routing for
  larger instruction systems.
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-claude-md-optimizer:` and a body. File an
issue only when the user explicitly asks you to do so. If they have not asked,
offer the draft and issue page for their review; do not post or open anything
automatically.

When the user explicitly authorizes filing and `gh` is installed (`gh --version` succeeds), create the issue with structured arguments. Put the reviewed body in a UTF-8 temporary file and pass its literal path with `--body-file`; do not interpolate feedback into shell code.

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "<reviewed title>" \
  --body-file "<path-to-reviewed-UTF-8-body-file>"
```

If `gh` is unavailable, give the user the reviewed title and body to paste into a
new issue at `https://github.com/ElliotDrel/e-stack/issues/new`.
