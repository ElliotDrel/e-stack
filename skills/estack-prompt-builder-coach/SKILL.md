---
name: prompt-builder
description: Use whenever you or the user need to write, draft, sharpen, or audit a prompt for an AI agent or model. Triggers when the user says "help me write a prompt", "build me a prompt", "I need a prompt for X", "audit this prompt", "make this prompt better", "why is the AI giving me generic output", or when you are about to hand a task to another agent, model, or API call and want it to land well. Use this even when the request is casual or the user did not say the word "prompt" but is clearly trying to get an AI to do consequential work. Do not use for quick factual lookups or for executing a task that is already well defined.
---

# Prompt Builder

A coaching skill that turns a vague ask into a real work brief an AI agent can run with.

## The core idea

The unit of useful AI work is not a prompt, it is a brief. A prompt is something typed into a box. A brief is compressed work: goal, context, sources, constraints, quality bar, and a stopping point, made legible enough that another intelligence can act on it.

Treat the AI on the other end as a senior director, not a junior. A junior needs every step spelled out. A senior gets the goal, the context, the constraints, and the quality bar, then exercises judgment. The leverage in modern models lives in that gap.

Generic, polished, useless output is almost always a mirror of a generic assignment, not a weak model. Your job in this skill is to make the missing definition visible before the work starts, then assemble it into a prompt.

## Workflow

Run these steps in order. Do not skip Step 0. Do not dump all questions at once: batch them into 1 to 2 rounds of focused questions.

### Step 0: Triage. Does this even need a full brief?

Match overhead to stakes. Read the user's request and decide which case applies, then state your read out loud and let the user override.

- **Quick or exploratory ask** (a fast question, a throwaway draft, open brainstorming): do NOT run the full machinery. Write a tight one or two line prompt, confirm it, save it, done. Over-specifying a small ask wastes everyone's time.
- **Consequential work** (recurring workflow, public-facing content, hiring or evaluation, customer communication, product spec, financial analysis, anything where a wrong assumption is expensive): run the full brief, Steps 1 to 4.
- **Not ready to brief yet (Shape mode):** if the user has not decided the goal, the audience, or the core angle, the task cannot be briefed. Say so. The first deliverable is shaping questions, not a prompt: map the options, surface the tensions, help them decide. Then return to Step 1.

### Step 1: Pick the path

- **Audit path:** the user already has a draft prompt or a request they have written. Go to Step 2B.
- **Build path:** the user is starting from scratch. Go to Step 2A.

### Step 2A: Build from scratch

Interview the user through the six fields below. Ask in 1 to 2 rounds of grouped questions, not six separate turns. Lead with Goal and Context, then Sources, Constraints, Quality bar, and Definition of done. Skip any field the user has already answered in the conversation. If the user does not know an answer, that is a finding: it usually means the task is not ready and you may need to drop to Shape mode.

### Step 2B: Audit a draft

Walk the draft against the six fields, one field at a time. For each field:
1. Quote or summarize what the draft currently says for that field.
2. If the field is missing or thin, state plainly **what the AI will most likely default to** if the prompt is sent as-is.
3. Ask one focused question to close the gap.

The default-prediction is the most valuable move here. It shows the user the concrete cost of the vagueness, not an abstract warning.

### Step 3: Assemble the prompt

Combine the answers into a finished prompt using the Output Template below. Then read it back with fresh eyes against three checks:
- **Flashlight check:** does it name both the center (intent, focus, what to dig into) AND the edges (what is out of scope, what to leave out)? Absence is never inferred. If the edges are not drawn, add them.
- **Vague-word check:** scan for "better", "cleaner", "sharper", "strategic", "good". Each one is a hole. Replace it with what it concretely means for this task.
- **Mode check:** does the prompt ask the AI to execute before the problem is ready? If the strategy or thesis is unresolved, the prompt should ask for thinking or options first, not a finished artifact.

### Step 4: Save and hand back

Show the finished prompt to the user in a copyable block. Then save it to a markdown file (descriptive snake_case name, `.md` extension; in this environment write it to `/mnt/user-data/outputs/`) and tell the user the path. If `present_files` is available, present the file.

## The six fields

Every consequential prompt names these. For each field: the question it answers, what a strong answer looks like, and the failure it prevents.

**1. Goal.** What outcome, not what activity. "Turn this rough deck into a board-ready document that supports a fund-or-kill decision on the pilot," not "help me with this deck." A board document is not a sales deck is not a brainstorm. If the goal is unnamed, the AI infers one, usually the average one.

**2. Context.** What a smart colleague joining late would need: who it is for, what already happened, why it matters now, what the audience already believes and worries about. Relevant background that changes the answer, not a data dump. Example: "this is the third delay and the relationship is strained" changes a customer email completely.

**3. Sources.** What materials to use and their role. Real work has a source hierarchy: authoritative, background, examples-only, do-not-use, outdated. "Treat this transcript as primary, use the call only for examples, check the archive for overlap, do not rely on memory if a document contradicts it." This turns the AI from a text generator into a worker operating against evidence.

**4. Constraints.** The boundaries that keep the work technically correct but practically right. Scope, tone, risk, voice, compliance, sensitive names, timing. "Do not draft yet. Do not invent numbers. Do not change my voice. Do not turn this into a generic guide." Constraints are not there to make the AI timid, they preserve the real conditions of the work.

**5. Quality bar.** What makes the output good, not just what it looks like. The AI optimizes for the visible shape of an artifact unless told otherwise. State the standard and the taste: "useful to a builder, not just interesting to an executive", "every claim tied to a source", "separates verified fact from interpretation", "no one-line slogans", "examples matter more than taxonomy". The AI cannot meet a bar it was never shown.

**6. Definition of done.** The exact deliverable and the stopping point. A draft? A research brief? A table? A redline? A ranked list? A recommendation? Open questions? Then where to stop: "return a revised outline first, then stop for review." A stopping point is not bureaucracy, it is what keeps the collaboration manageable and stops the AI racing ahead.

## The flashlight

A brief points a flashlight. The center of the beam is intent: the thesis, the point of view, where to dig in. The edges are scope: what is in and what is out. Strong prompts name both. Most people skip the edges, and the edges matter most: telling the AI what to leave out is often more useful than telling it what to include, because absence is never inferred.

## Output template

Default to labeled sections (clearest and reusable). Collapse to a single flowing paragraph only if the user prefers that or the task is small.

```
# Prompt: [short task name]

## Goal
[the outcome]

## Context
[background that changes the answer]

## Sources
[materials and their role; what is primary, what is examples-only, what is off-limits]

## Constraints
[scope, tone, voice, risk; what would make the output unusable]

## Quality bar
[what makes it good; the standard and the taste]

## Definition of done
[the exact deliverable, and where to stop]
```

For a quick ask from Step 0, skip the template. Just produce a tight, specific one or two line prompt.

## References

For a set of finished good prompts to model your output on, read `references/examples.md`. It pairs thin asks against well-defined prompts and breaks three full briefs down field by field. Consult it when assembling in Step 3 to check the shape and depth your output should reach.
