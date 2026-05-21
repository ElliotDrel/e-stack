---
name: prompt-builder
description: Use whenever you or the user need to write, sharpen, audit, or scope a prompt or work request for an AI agent or model. This is a three-part kit covering building a prompt from scratch, auditing a draft request that feels vague, and defining what "done" looks like when the task is fuzzy. Trigger when the user says "help me write a prompt", "build me a prompt", "audit this prompt", "make this request better", "why is the AI giving me generic output", "I don't know what I want", "what should done look like", or when handing a task to another agent and wanting it to land. Use it even when the user did not say the word "prompt" but is clearly trying to get an AI to do consequential work. Do not use for quick factual lookups or for executing an already well-defined task.
---

# Prompt Builder

A three-part prompt kit that turns thin asks into structured work briefs. This file is the router. It sets the mindset, picks the right part, and enforces the rules that hold the parts together.

## Mindset (applies to every part)

The unit of useful AI work is not a prompt, it is a brief. A prompt is something typed into a box. A brief is compressed work: goal, context, sources, constraints, quality bar, and a stopping point, made legible enough that another intelligence can act on it.

Treat the AI on the other end as a senior director, not a junior. A junior needs every step spelled out. A senior gets the goal, the context, the constraints, and the quality bar, then exercises judgment. The leverage in modern models lives in that gap.

Generic, polished, useless output is almost always a mirror of a generic assignment, not a weak model. Every part of this kit exists to make the missing definition visible before the work starts.

The six fields, named once here so the parts can refer to them:
1. **Goal** - the outcome, not the activity.
2. **Context** - the background a smart colleague joining cold would need.
3. **Sources** - what materials to use and their role.
4. **Constraints** - the boundaries that keep the work practically right.
5. **Quality bar** - what makes the output good, not just done-looking.
6. **Definition of done** - the exact deliverable and the stopping point.

The flashlight: a brief points a flashlight. The center of the beam is intent. The edges are scope, what is in and what is out. Name both. The edges get skipped most and matter most.

Match overhead to stakes. Not every ask needs the full kit. Quick or exploratory asks stay loose.

## The three parts

| Part | File | What it does |
|---|---|---|
| Useful Question Builder | `prompt-builder.md` | Builds a complete work brief from scratch by interviewing the user through the six fields. |
| Vague Ask Auditor | `vague-ask-auditor.md` | Diagnoses a draft request field by field, then rewrites it. |
| Definition-of-Done Generator | `definition-of-done-generator.md` | Articulates what "finished" looks like when the user cannot describe it. |

## Routing

Run this decision procedure when the skill triggers.

1. **Triage first.** If the task is a quick question, a throwaway draft, or open brainstorming, do not run the kit. Write a tight one or two line prompt, confirm it, save it, done. State this read so the user can override.
2. **Does the user already have a draft prompt or request?** If yes, go to the Vague Ask Auditor (`vague-ask-auditor.md`).
3. **Does the user not know what they want, or cannot say what a finished result looks like?** If yes, go to the Definition-of-Done Generator (`definition-of-done-generator.md`).
4. **Otherwise the user is building from scratch.** Go to the Useful Question Builder (`prompt-builder.md`).

Before working any part, read that part's file in full and follow it.

## Cross-part rules (critical)

These rules are what make the kit work as a system rather than three loose files.

### Rule 1: Re-read on every switch

Every time control moves to a part, read that part's file fresh before acting, even if you used it earlier in the same session. This applies to switching back. Stale instructions cause drift.

Worked sequence: the Useful Question Builder finishes a prompt, so control switches to the Vague Ask Auditor. Read `vague-ask-auditor.md` now. The auditor finds things to fix and needs to rebuild the prompt, so control switches back to the builder. Read `prompt-builder.md` again before rebuilding. Do not patch from memory.

### Rule 2: Builder hands off to the Auditor automatically

When the Useful Question Builder produces a finished prompt, do not stop there. Run the Vague Ask Auditor on the prompt that was just built.

- If you can spawn subagents, delegate the audit to a subagent: pass it the built prompt and the path to `vague-ask-auditor.md`, and have it run the audit and report back.
- If you cannot spawn subagents, run the audit inline yourself: read `vague-ask-auditor.md` and follow it.

Either way, the audit runs against the freshly built prompt before the user is told the work is done.

### Rule 3: The Definition-of-Done Generator can run alone or mid-flow

It runs standalone when the user does not know what they want. It also runs mid-flow: if, during the Useful Question Builder interview, the user cannot answer what "done" looks like or signals they do not know what they want, switch to `definition-of-done-generator.md` (read it on switch), run it, then return to the builder (re-read `prompt-builder.md`) and continue from where you paused.

## Output

Every finished prompt or brief gets saved to a markdown file with a descriptive snake_case name. In this environment, save to `/mnt/user-data/outputs/`. If `present_files` is available, present the file. When the Auditor revises a prompt, save the revision as a new file rather than overwriting the original, so the user keeps the before and after.
