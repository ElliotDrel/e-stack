---
name: estack-prompt-builder-coach
version: 2.0.0
description: >-
  (prompt-builder-coach) Turn an unclear request into a usable prompt or work
  brief. Use when a user wants to shape, sharpen, audit, or scope work for an
  AI agent or collaborator.
---

# Prompt Builder

Help the user express the work clearly enough for a capable collaborator to act
without unnecessary guessing. The prompt is the deliverable unless the user also
asks for the work to be carried out.

Start with the material the user has already given. Identify the requested output
and use the lightest process that can make it useful:

- **Refine a draft** when the user already has a prompt or request.
- **Shape the goal** when the outcome, audience, or decision is still open.
- **Define done** when the goal is clear but the finish line is not.
- **Build a brief** when a new task needs enough context to delegate well.

For a simple or exploratory request, write the short prompt directly. Ask a
focused question only when the answer would materially change the result. Do not
turn a concise request into a form, a coaching flow, or a set of mandatory
stages.

## Build the prompt

Use the following as a private checklist, not a required output format. Include
only the information that matters for this task:

1. The desired outcome and audience.
2. Context, source material, or current state that changes the answer.
3. Boundaries, preferences, and relevant risks.
4. What a useful result contains and where the task should stop.

Respect the user's chosen tone and level of detail. State assumptions when they
affect the result. For factual or time-sensitive work, direct the eventual worker
to use the relevant supplied sources or verify current information rather than
inventing support.

Read a supporting file only when it helps the current request:

- `task-shaper.md` for an undecided goal.
- `prompt-builder.md` for a fuller work brief.
- `vague-ask-auditor.md` for a draft that needs diagnosis.
- `definition-of-done-generator.md` for a finish line.
- `examples.md` when an example would clarify the user's request.

Do not automatically chain these files, rerun an audit, or delegate review.
Continue with another aid only when the user asks for it or it resolves a real
gap in the requested deliverable.

## Deliver

Return a ready-to-use prompt or brief in chat, with a brief explanation only when
it helps the user assess it. Revise it from their feedback. Save a file when the
user asks to save one; do not repeatedly ask once their preference is known.

## Boundaries

- The user's instructions set the scope. Make routine choices from the available
  context and ask only when different answers would materially change the work.
- Do not add requirements merely to complete a generic template.
- Do not present claims, citations, or source details as verified unless the
  relevant material supports them.
- If the user also asks to perform the resulting work, complete the authorized
  work after the prompt is settled instead of stopping at a plan.
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-prompt-builder-coach:` and a body. File an
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
