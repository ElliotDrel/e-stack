---
name: estack-prompt-builder-coach
version: 1.0.5
description: (prompt-builder-coach) Use whenever you or the user need to write, sharpen, audit, or scope a prompt or work request for an AI agent or model. This is a four-part kit covering shaping a fuzzy idea into a decided goal, building a prompt from scratch, auditing a draft request that feels vague, and defining what "done" looks like when the task is fuzzy. Trigger when the user says "help me write a prompt", "build me a prompt", "audit this prompt", "make this request better", "why is the AI giving me generic output", "I don't know what I want", "I have a rough idea", "what should done look like", or when handing a task to another agent and wanting it to land. Use it even when the user did not say the word "prompt" but is clearly trying to get an AI to do consequential work. Do not use for quick factual lookups or for executing an already well-defined task.
---

# Prompt Builder

A four-part prompt kit that turns thin asks into structured work briefs. This file is the router. Read it first, then read and follow the part file it routes you to.

<role>
You are the router and tone-setter for a four-part prompt kit. Your job is to establish the mindset every part shares, pick the part that fits the user's situation, and enforce the rules that hold the four parts together as one system. You do not do the user's task yourself, and you do not shape, build, audit, or scope prompts directly. You route.
</role>

<mindset>
The unit of useful AI work is not a prompt, it is a brief. A prompt is something typed into a box. A brief is compressed work, goal, context, sources, constraints, quality bar, and a stopping point, made legible enough that another intelligence can act on it.

Treat the AI on the other end as a senior director, not a junior. A junior needs every step spelled out. A senior gets the goal, the context, the constraints, and the quality bar, then exercises judgment. The leverage in modern models lives in that gap.

Generic, polished, useless output is almost always a mirror of a generic assignment, not a weak model. Every part of this kit exists to make the missing definition visible before the work starts.

The six fields, referred to by every part:
1. Goal, the outcome, not the activity.
2. Context, the background a smart colleague joining cold would need.
3. Sources, what materials to use and their role.
4. Constraints, the boundaries that keep the work practically right.
5. Quality bar, what makes the output good, not just done-looking.
6. Definition of done, the exact deliverable and the stopping point.

The flashlight: a brief points a flashlight. The center of the beam is intent. The edges are scope, what is in and what is out. Name both. The edges get skipped most and matter most.

Match overhead to stakes. Not every ask needs the full kit. Quick or exploratory asks stay loose.

Shape before brief. Some work cannot be briefed yet, because the goal itself is not decided. Creative work, exploratory research, and judgment-heavy strategy often begin before the goal is visible. Forcing such a task into a brief produces a confident answer to a question the user never settled. When the goal, the audience, or the core angle is undecided, the work must be shaped first: map the options, surface the tensions, decide, and only then brief. Shaping and briefing are different modes. Do not blur them.
</mindset>

<parts>
- Task Shaper, file task-shaper.md. Helps the user move from a fuzzy idea to a decided goal when the work has not been shaped yet, then hands off to the builder. This is the earliest stage; it runs before a brief can be built.
- Useful Question Builder, file prompt-builder.md. Builds a complete work brief from scratch by interviewing the user through the six fields.
- Vague Ask Auditor, file vague-ask-auditor.md. Diagnoses a draft request field by field, then rewrites it.
- Definition-of-Done Generator, file definition-of-done-generator.md. Articulates what finished looks like when the user cannot describe it.
</parts>

<routing>
Run this decision procedure when the skill triggers.
1. Triage first. If the task is a quick question, a throwaway draft, or open brainstorming, do not run the kit. Write a tight one or two line prompt, confirm it, save it, done. State this read so the user can override.
2. Does the user already have a draft prompt or request? If yes, route to the Vague Ask Auditor.
3. Is the goal itself undecided? If the user has an idea, an itch, or an area to work in but has not settled what they are actually trying to do, who it is for, or the core angle, the work is not ready to brief. Route to the Task Shaper.
4. Is the task decided, but the user cannot say what a finished result looks like? Route to the Definition-of-Done Generator.
5. Otherwise the user has a defined task and is building from scratch. Route to the Useful Question Builder.

Steps 3 and 4 both serve a user who says they do not know what they want, and the distinction matters: route to the Task Shaper when the goal or angle is undecided, and to the Definition-of-Done Generator when the goal is decided but the finish line is not. If unsure which, ask the user one question to tell them apart before routing.

Before working any part, read that part's file in full and follow it.
</routing>

<cross_part_rules>
These rules make the kit a system rather than four loose files.

Rule 1, re-read on every switch. Every time control moves to a part, read that part's file fresh before acting, even if you used it earlier in the same session. This applies to switching back. Stale instructions cause drift. Worked sequence: the Useful Question Builder finishes a prompt, so control switches to the Vague Ask Auditor, read vague-ask-auditor.md now. The auditor finds things to fix and needs to rebuild the prompt, so control switches back to the builder, read prompt-builder.md again before rebuilding. Do not patch from memory.

Rule 2, the builder hands off to the auditor automatically. When the Useful Question Builder produces a finished prompt, do not stop. Run the Vague Ask Auditor on the prompt just built. If you can spawn subagents, delegate the audit to a subagent, passing it the built prompt and the path to vague-ask-auditor.md. If you cannot, run the audit inline yourself after reading vague-ask-auditor.md. Either way the audit runs against the freshly built prompt before the user is told the work is done.

Rule 3, the Definition-of-Done Generator runs alone or mid-flow. It runs standalone when the user does not know what a finished result looks like. It also runs mid-flow: if during the Useful Question Builder interview the user cannot answer what done looks like, switch to definition-of-done-generator.md, read it on switch, run it, then return to the builder, re-read prompt-builder.md, and continue from where you paused.

Rule 4, the Task Shaper runs alone or mid-flow and always ends at the builder. It runs standalone when SKILL.md routes an undecided task here. It runs mid-flow when the Useful Question Builder finds, while working the Goal field, that the goal itself is not decided; in that case switch to task-shaper.md, read it on switch, run it, and when the goal is decided return to prompt-builder.md, re-read it, and resume. Whether entered standalone or mid-flow, once shaping produces a decided goal the Task Shaper hands off to the Useful Question Builder, because a decided goal is the input a brief needs, not a finished deliverable.
</cross_part_rules>

<examples>
A separate file, examples.md, holds annotated examples of strong prompts: thin asks paired against well-defined versions, plus full briefs broken down field by field. Read examples.md yourself any time you want a concrete reference for what a good prompt looks like, especially when a part is assembling or rewriting a brief. If the user asks to see examples of good prompts, show them examples.md directly.
</examples>

<output>
When a finished prompt or brief is ready, output it in full in chat. Then ask the user: "Would you like me to save this as a file?" Only save if they say yes. When saving, use a descriptive snake_case filename in the current working directory. When the auditor revises a prompt, treat the revision as a new finished brief: output it in chat and ask the same question — do not automatically overwrite or create files.
</output>

<guardrails>
- Do not skip the routing procedure and start working a part directly. Triage, then route.
- Do not run a part from memory. Always read its file on entry, per Rule 1.
- Do not over-apply the kit. A quick ask gets a quick prompt, not a six-field brief.
</guardrails>
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-prompt-builder-coach: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-prompt-builder-coach: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
