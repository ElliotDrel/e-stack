---
name: estack-customer-discovery
version: 1.0.5
description: >-
  (customer-discovery) Validate a business idea through customer interviews:
  pick target customers, write outreach and interview guides, analyze results.
  Use when the user is planning or debriefing customer discovery.
---

# Customer Discovery

This skill guides users through the full customer discovery process, or any specific part of it. Customer discovery is a detective exercise — you're confirming or denying assumptions, not selling or pitching.

## The flow

There are 4 steps. Each builds on the last, but the user can jump to any step directly.

1. **Strategy & Targeting** — Define who you're talking to, what you're testing, and why. Map assumptions, define customer segments, frame the job-to-be-done.
2. **Outreach** — Craft messages that get people to say yes to a conversation. Warm intros first, then cold outreach using proven formulas.
3. **Interview Execution** — Build a tailored interview guide with the right questions (behavioral, story-eliciting) and avoid the wrong ones (speculative, leading). Prepare to run great interviews.
4. **Analysis & Signals** — Make sense of what you heard. Spot patterns, rank problems, identify progression signals, and decide what to do next.

## How to use this skill

### Step 1: Infer the useful step

Use the request and context to identify the useful step. If the request could reasonably mean two
different steps, ask one focused question; otherwise start the relevant work.

When the user describes their situation without naming a step, route based on where they are:
- Have an idea but haven't talked to anyone yet → Start at **Step 1: Strategy & Targeting**
- Know who to talk to but need help reaching out → **Step 2: Outreach**
- Have interviews scheduled but need questions → **Step 3: Interview Execution**
- Have done interviews and need to make sense of them → **Step 4: Analysis & Signals**

### Step 2: Read the right step file

Consult the step file and relevant reference material before giving guidance or creating an
artifact. Use the source material needed for the request; do not make the user wait through an
orientation for steps they did not ask for.

| Step | Step file (read first) | Reference file (read second) |
|---|---|---|
| 1. Strategy & Targeting | `steps/step-1-strategy.md` | `references/01-strategy-and-targeting.md` |
| 2. Outreach | `steps/step-2-outreach.md` | `references/02-outreach.md` |
| 3. Interview Execution | `steps/step-3-interviews.md` | `references/03-interview-execution.md` |
| 4. Analysis & Signals | `steps/step-4-analysis.md` | `references/04-analysis-and-signals.md` |

The reference docs are the source of truth — they contain the principles and frameworks. The step files tell you how to work through them with the user.

### Step 3: Be adaptive

Read the room. If the user clearly knows what they're doing, don't over-explain. If they're new to this, coach them. Adjust your depth and pacing based on how they talk about their idea.

### Step 4: Offer deliverables

Deliver a written summary when the user asks for one or when a durable plan, guide, or findings
report is the natural result of the work. Do not turn a conversational request into an unrequested document.

### Step 5: Continue the flow

When the current request is complete, state the most relevant next discovery move if it is useful.
Continue directly when the user has already asked for the broader flow; otherwise let the user
choose what to do next.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-customer-discovery:` and a body. File an
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
