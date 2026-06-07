# Pre-delegation flow

<primary_outcome>
The user finishes this flow with two things in hand: (1) a complete Delegation Brief in markdown, ready to share with the person taking the work, and (2) enrollment talking points for the sit-down conversation that happens before the brief is shared. If the user leaves without both of those, the flow is not complete.
</primary_outcome>

This flow runs when the user has not yet handed off the work and wants to set the delegation up correctly. It orchestrates Phases 1 through 6 in order, then assembles the artifact.

---

## When to run this flow

- The user is preparing to delegate something they currently own
- They want help deciding whether/how/to whom to delegate
- They want to write a brief but don't know what should be in it
- They've tried to delegate the work before and want to start over with structure

If the work has already been handed off and went sideways, use `post-mortem.md` instead.

---

## Phase sequence

Each phase has its own file in `../phases/`. Load and follow each one in order. Do not jump ahead — a phase is incomplete until it produces the output the phase declares.

| # | Phase | Output the phase must produce |
|---|---|---|
| 1 | `phases/1-intake.md` | Named task, named owner (or owner-selection logic for flat teams), timeline; filter decision (Eliminate / Automate / Delegate / hold); resistance pattern named if present |
| 2 | `phases/2-trm-assessment.md` | Task-Relevant Maturity for this person on this task (Low / Medium / High) + Hormozi progression stage (Investigation / Informed Progress / Informed Results / Complete Ownership) |
| 3 | `phases/3-enrollment.md` | Enrollment talking points: the problem, why-them, the energizing question, the needs question |
| 4 | `phases/4-build-brief.md` | The brief: What, Why, Success Looks Like, Constraints, Authority Level (1–5), Reciprocal Commitments (flat teams) |
| 5 | `phases/5-monitoring.md` | Check-in schedule with cadence calibrated to TRM, and what each check-in will cover |
| 6 | `phases/6-reverse-delegation.md` | A named protocol for what the owner does when they hit a roadblock — preventing monkey-transfer back to the user |

After Phase 6, deliver the artifact using the template below. Do not declare the session done until the artifact is in the conversation.

---

## Compressed path

If all four conditions are true (trusted peer or proven high-TRM teammate, low public visibility, short timeline, low cost of failure), run a three-step compressed path instead:

1. Confirm the deliverable in one sentence (Phase 1 + 4 condensed)
2. Name the authority level out loud (Phase 4, element ⑤)
3. Set one check-in (Phase 5)

Then deliver a shortened brief with What / Authority Level / One Check-In filled in, and skip enrollment + full reciprocal commitments. Mention briefly that the compressed path is being used and why.

If at any point a condition turns out to be false (the timeline grew, the visibility expanded), drop back to the full flow.

---

## Pre-empted shortcuts

- **Don't lecture all 6 phases up front.** The user will check out. Run phases one at a time.
- **Don't fill in the brief from your assumptions.** If the user couldn't articulate Success Looks Like, do not generate it. Push the question back until they have it.
- **Don't skip enrollment because "they're already on board."** Enrollment is not the user's belief about the owner's buy-in — it's the talking points the user will use in the actual conversation. Always produce them.
- **Don't deliver the brief without check-ins on the calendar.** A brief without a check-in schedule is abdication waiting to happen.

---

## Artifact template — Delegation Brief

When all six phases are complete, deliver the artifact as a markdown block exactly like this. Fill in every field with the specific content captured during the phases.

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

Before delivering the artifact, silently verify all of these. If any is false, return to the relevant phase rather than ship a half-done brief.

- [ ] The deliverable is specific enough that a stranger could tell if it was met
- [ ] Success Looks Like is concrete — not "polished" or "high-quality" or "good"
- [ ] The authority level is named explicitly with a number and a name
- [ ] At least one check-in is on a calendar date, not "we'll figure it out"
- [ ] If flat team: reciprocal commitments are filled in with specific items
- [ ] The roadblock protocol from Phase 6 is named (not "they'll come to me")
- [ ] Enrollment talking points include a specific "why you" — not a generic compliment
- [ ] The user has not said "change outcome" without being re-routed

When all are true, deliver the artifact and then ask: *"Want to walk through how to actually open the enrollment conversation, or are you good to go?"*
