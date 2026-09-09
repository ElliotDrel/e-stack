---
name: estack-chris-voss
version: 1.0.5
description: >-
  (chris-voss) Chris Voss negotiation tactics from Never Split the Difference.
  Use when the user is preparing to negotiate with a counterpart (a deal, a
  price, a landlord, a hiring offer) and asks how to approach it. Leading
  their own team through a hard conversation is estack-leadership-coach;
  writing the message itself is estack-email-writer or
  estack-cold-message-writer.
---

# Chris Voss Negotiation Skill

Use *Never Split the Difference* when the user is preparing for a real negotiation or a high-stakes
conversation with a counterpart. Diagnose the situation, select the few tactics that fit, and give
the user a practical next move. Do not load this skill for ordinary writing, marketing, or general
persuasion; the message-writing skills own those requests.

---

## How to Apply This Skill

Use the user's facts and stated objective. Ask a focused question only when a missing fact would
materially change the advice. Otherwise, make a best-effort recommendation and label assumptions.
You do not need to name every technique. Explain one when that helps the user use it in the room.

**Prioritize:**
- Giving the user exact words or a rewritten draft when they need one
- Identifying the emotional or psychological dynamics at play — in the room or in the reader
- Pointing out where the user might be giving away power or framing things suboptimally
- Preempting objections and resistance before they arise

---

## Core Principles Reference

Consult `references/voss-principles.md` for the structured knowledge base and
`references/elliot-notes.md` for personal highlights and edge cases when the situation needs
that detail. Below is a quick index of when to reach for each tool:

| Situation | Primary Tools |
|---|---|
| Need a reply in an active negotiation thread | "Have you given up on X?" framing, No-oriented question |
| Writing a negotiated ask or request | Accusation audit, lead with value, FOMO framing |
| Pitching a negotiated idea, product, or company offer | Loss aversion framing, emotional anchoring, accusation audit |
| Structuring pricing or an offer | Precise numbers, Ackerman logic, nonmonetary add-on |
| Anticipating pushback or rejection | Label negatives upfront, accusation audit |
| Tense conversation / conflict | Labeling, mirroring, downward voice tone |
| Someone not engaged / shutting down | Mirroring, calibrated questions, "That's right" pursuit |
| Trying to build trust quickly | Similarity principle, tactical empathy, acknowledge the negative |
| Getting someone to commit (not just agree) | Rule of 3, "how/what" implementation questions |
| Someone being unreasonable | Look for black swans — there's something you don't know yet |
| Deadline pressure | Reframe: deadlines are often self-imposed and flexible |
| Positioning or messaging within a negotiation | Emotional framing, loss aversion, accusation audit |

---

## Output Style

- **For messages/emails/outreach within a negotiation**: Rewrite or draft directly, applying Voss principles implicitly. Route general first-touch outreach or ordinary email craft to its dedicated skill.
- **For live situations/conversations**: Diagnose the emotional dynamics, give exact language, flag
  power the user is giving away.
- **For strategy questions**: Be direct and tactical. State the recommendation, why it fits, and
  the words or next move the user can use.

Use calm, confident language. If the situation is high-stakes, slow down and be precise. Never
rush the user into a compromise — no deal is better than a bad deal.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-chris-voss:` and a body. File an
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
