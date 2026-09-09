# Pre-delegation flow

<primary_outcome>
For a substantial delegation setup, the user leaves with a complete Delegation Brief in markdown and the enrollment talking points needed before sharing it. For a narrow request, deliver the requested draft, review, or decision with the handoff elements relevant to its stakes. Do not withhold a usable artifact merely because a broader delegation flow was not requested.
</primary_outcome>

This flow runs when the user has not yet handed off the work and wants to set the delegation up correctly. Use the phases to resolve the information the handoff actually needs, then assemble the artifact. A consequential or incomplete handoff benefits from the full sequence; a well-specified direct request can be drafted from the facts already supplied.

---

## When to run this flow

- The user is preparing to delegate something they currently own
- They want help deciding whether/how/to whom to delegate
- They want to write a brief but don't know what should be in it
- They've tried to delegate the work before and want to start over with structure

If the work has already been handed off and went sideways, use `post-mortem.md` instead.

---

## Phase sequence

Each phase has its own file in `../phases/`. For a consequential or incomplete handoff, follow the sequence and resolve the fields that affect the brief. When the user already supplies a complete, low-risk brief request, synthesize its relevant outputs in one pass and ask only for material blanks. Do not manufacture a multi-turn intake just to traverse every phase.

| # | Phase | Output the phase must produce |
|---|---|---|
| 1 | `../phases/1-intake.md` | Contextual accountability and motive read when relevant; named task, named owner (or owner-selection logic for flat teams), timeline; filter decision (Eliminate / Automate / Delegate / hold); resistance pattern named if present |
| 2 | `../phases/2-trm-assessment.md` | Task-Relevant Maturity for this person on this task (Low / Medium / High) + Hormozi progression stage (Investigation / Informed Progress / Informed Results / Complete Ownership) |
| 3 | `../phases/3-enrollment.md` | Enrollment talking points: the problem, why-them, the energizing question, the needs question |
| 4 | `../phases/4-build-brief.md` | The brief: What, Why, Success Looks Like, Constraints, Authority Level (1–5), Reciprocal Commitments (flat teams) |
| 5 | `../phases/5-monitoring.md` | Check-in schedule with cadence calibrated to TRM, and what each check-in will cover |
| 6 | `../phases/6-reverse-delegation.md` | A named protocol for what the owner does when they hit a roadblock — preventing monkey-transfer back to the user |

After the needed inputs are resolved, deliver the artifact using the template below. Do not declare substantial delegation work done until the artifact is in the conversation.

---

## Compressed path

If the handoff is low-risk or the user asks for a narrow artifact, use this compressed path. It is also appropriate when the supplied facts already establish the four conditions (trusted peer or proven high-TRM teammate, low public visibility, short timeline, low cost of failure):

1. Confirm the deliverable in one sentence (Phase 1 + 4 condensed)
2. Name "why you" in one sentence (Phase 3 Move 2 only — the other three moves are skipped)
3. Name the authority level out loud (Phase 4, element 5)
4. Set one check-in (Phase 5)

Then deliver a shortened brief with What / Why You / Authority Level / One Check-In filled in. Skip Moves 1, 3, 4 of enrollment and skip full reciprocal commitments. Mention briefly that the compressed path is being used and why.

If at any point a condition turns out to be false (the timeline grew, the visibility expanded), drop back to the full flow.

---

## Pre-empted shortcuts

- **Don't lecture all 6 phases up front.** Use only the parts that affect the requested handoff.
- **Don't invent a brief from unsupported assumptions.** State reasonable assumptions in a draft and ask only for blanks that materially change the recommendation.
- **Don't skip enrollment because "they're already on board."** When the user needs to have the conversation, include the talking points that will make ownership clear.
- **Don't omit proportionate follow-through.** A brief needs a check-in cadence or trigger that matches the work's risk and the owner's readiness.

---

## Artifact template — Delegation Brief

For a complete delegation setup, deliver the artifact as a markdown block using this structure and fill in every field with specific content. For a direct draft, include the sections supported by the supplied facts, label material assumptions, and identify the few fields that require confirmation before the user shares it.

<template>

```markdown
# Delegation Brief

**Task:** <one-sentence deliverable from Phase 1 + Phase 4 ①>
**Owner:** <named person from Phase 1>
**Timeline:** <from Phase 1>
**Team mode:** <Hierarchical | Flat — detected during the session>

---

## Why this matters
<from Phase 4 ②: the actual problem being solved, who it's for, what goes wrong if it's late or off>

## Why this owner
<from Phase 3 ②: specific reason they were chosen — not "they're great">

## Success looks like
<from Phase 4 ③: concrete description of done, with the standard externalized. Excellent / Acceptable / Poor distinctions if surfaced.>

## Constraints
<from Phase 4 ④: non-negotiables — timeline, budget, stakeholders to involve, decisions they can't make alone>

## Authority level
**Level <1–5> — <Name>**
<one-line description of what that level means in this specific situation>

## Check-in schedule
<from Phase 5: actual cadence, e.g., "Early-stage alignment check on <date>, midpoint review on <date>, final delivery on <date>". Each check-in says what it covers.>

## When the owner hits a roadblock
<from Phase 6: the named protocol — what they do, how they bring it to the user, what the user will/won't take back>

## Reciprocal commitments
<Flat teams only — from Phase 4 ⑥: what the user/team owes the owner: blockers they'll clear, stakeholders they'll handle, decisions they'll stay out of>
```

---

# Enrollment talking points

**To use before sharing the brief — these are for the sit-down conversation.**

> **The problem we're solving:** <from Phase 3 ①>
>
> **Why it matters right now:** <stakes, urgency, downstream impact>
>
> **Why you're the right person for this:** <specific, not generic — from Phase 3 ②>
>
> **What part of this energizes you?** <ask in the conversation, listen to the answer — Phase 3 ③>
>
> **What would help you do your best work?** <ask, listen — Phase 3 ④>

</template>

---

## Acceptance self-audit (run before declaring the session done)

Before delivering a complete brief, silently verify all of these. For a direct draft, verify the sections that apply, label material gaps, and do not force an unrelated phase just to satisfy this audit.

- [ ] The deliverable is specific enough that a stranger could tell if it was met
- [ ] Success Looks Like is concrete — not "polished" or "high-quality" or "good"
- [ ] The authority level is named explicitly with a number and a name
- [ ] At least one check-in is on a calendar date, not "we'll figure it out"
- [ ] If flat team: reciprocal commitments are filled in with specific items
- [ ] The roadblock protocol from Phase 6 is named (not "they'll come to me")
- [ ] Enrollment talking points include a specific "why you" — not a generic compliment
- [ ] The user has not said "change outcome" without being re-routed

When the applicable items are true, deliver the artifact. Offer to walk through the enrollment conversation only when it is a useful next move.
