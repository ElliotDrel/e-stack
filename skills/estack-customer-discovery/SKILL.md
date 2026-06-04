---
name: estack-customer-discovery
version: 1.0.2
description: (customer-discovery) Guide users through customer discovery — validating business ideas, identifying target customers, crafting outreach, preparing interview questions, and analyzing interview results. Use this skill whenever the user mentions customer discovery, customer interviews, validating an idea, market research, finding product-market fit, talking to customers, outreach messages, interview guides, or analyzing customer feedback. Also use when someone says they have a business idea and want to test it, or when they're preparing to talk to potential customers.
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

### Step 1: Figure out what the user needs

Ask the user: do they want to go through the full flow, or do they need help with a specific step?

If they describe their situation without picking a step, route them based on where they are:
- Have an idea but haven't talked to anyone yet → Start at **Step 1: Strategy & Targeting**
- Know who to talk to but need help reaching out → **Step 2: Outreach**
- Have interviews scheduled but need questions → **Step 3: Interview Execution**
- Have done interviews and need to make sense of them → **Step 4: Analysis & Signals**

### Step 2: Read the right step file — MANDATORY

<CRITICAL>
You MUST read the step file AND its corresponding reference file BEFORE responding to the user. Do NOT skip this. These files contain the actual frameworks and instructions — without reading them, your output will be generic and wrong.
</CRITICAL>

Each step has its own workflow file with detailed instructions. **Read the step file first, then read the reference file it points to.** Both reads are required — not optional, not "if you have time."

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

At the end of each step, offer to produce a written summary the user can reference later. Don't force it — some users just want the conversation.

### Step 5: Continue the flow

After completing a step, offer to continue to the next one by name (e.g., "Would you like to continue to **Step 3: Interview Execution**?"). Never reference a step by number alone — always include the name so the user knows what it covers. If the user jumped into a specific step, still offer the next step — they might want to keep going.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-customer-discovery: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-customer-discovery: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
