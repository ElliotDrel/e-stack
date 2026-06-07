# Post-mortem flow

<primary_outcome>
The user finishes this flow with a written diagnosis: which of the five structural gaps caused the failure, the principle behind it, the specific moment in the prior handoff where the gap opened, and a concrete corrective move. The diagnosis closes with an offer to re-run the pre-delegation flow using the gap as the starting correction. If the user accepts, the pre-delegation flow runs immediately with the existing context.
</primary_outcome>

This flow runs when a delegation already happened and went wrong. The work came back broken, late, or off-target — or it didn't come back at all. The user is here for the diagnosis, not to recover the lost work.

---

## When to run this flow

- The user describes a handoff that already happened and failed
- The work came back below the bar, late, or in the wrong direction
- The user finds themselves redoing work they delegated
- The user keeps getting pulled back into something they thought they'd handed off
- Trust between user and owner is fraying after the delegation

If the user hasn't handed off the work yet, use `pre-delegation.md` instead.

---

## Phase sequence

This flow runs only Phase 7, but Phase 7 produces the full diagnosis.

| # | Phase | Output the phase must produce |
|---|---|---|
| 7 | `../phases/7-diagnose.md` | Named structural gap (1 of 5) + named failure mode + specific principle explaining why the gap caused the failure + one corrective move |

After Phase 7, deliver the diagnosis artifact using the template below, then offer the pre-delegation re-run.

---

## How to run this flow without re-traumatizing the user

The user often arrives frustrated, embarrassed, or angry — at themselves, at the owner, or both. Coach with that in mind:

- **Lead with the system, not the person.** Almost every delegation failure is structural, not character-based. If you find yourself building a case against the owner, you've drifted. Bring it back to which of the five gaps opened.
- **Don't pile on.** The user already knows it went wrong. They don't need a lecture on what they should have done. They need a diagnosis they can use next time.
- **The owner is not in the room.** Be careful with claims about the owner's intent. Stick to observable behavior.
- **It's almost never 'they're not capable.'** Wrong TRM calibration looks like incapability but is actually the user applying their general impression of the person to a task type the person hadn't done before.

---

## Pre-empted shortcuts

- **Don't diagnose before asking the diagnostic questions.** It's tempting to pattern-match on the first sentence the user says ("they didn't do what I wanted"). Run the questions from Phase 7 — the surface story usually hides the actual gap.
- **Don't pick the first gap that fits.** Multiple gaps often co-occur. Name the *primary* gap — the one that, if fixed, would have prevented the failure. Mention secondary gaps but don't dilute the diagnosis.
- **Don't recommend a "have a talk with them" as the corrective move.** That's not a fix — it's a deflection. The corrective move is a structural change: a named authority level, an externalized success criterion, a check-in cadence, a written brief.

---

## Artifact template — Diagnosis

When Phase 7 produces its output, deliver the artifact as a markdown block exactly like this:

<template>

```markdown
# Delegation Post-Mortem

**Situation:** <one-sentence description of what was delegated and to whom>
**What went wrong:** <one-sentence description of the failure, in observable terms>
**Team mode:** <Hierarchical | Flat>

---

## The gap
**<Enrollment | Authority | Context | Success criteria | Accountability diffusion (flat teams)>**

<2–4 sentences naming where in the prior handoff this gap opened — the specific moment or omission. Quote the user's own words when possible.>

## The principle behind it
<1–2 sentences of theory with attribution. Why this gap reliably causes this kind of failure.>

## The failure mode this maps to
<From the failure-mode table in Phase 7 — name the row that matches.>

## The corrective move
<One concrete, structural change that, if applied next time, prevents this gap from opening. Not "talk to them" — a specific brief element, authority level, or check-in.>

## Secondary gaps (if any)
<Optional. Other gaps that also opened, but were not the primary cause. One line each.>
```

</template>

---

## Closing offer (always include after the diagnosis)

After the diagnosis is delivered, ask the user:

> *Want to run the pre-delegation flow now, starting from the corrected gap? We'll skip what you already know about the situation and focus on building the brief / authority level / check-in structure that wasn't there last time.*

If the user accepts: load `pre-delegation.md` and resume at the phase that maps to the diagnosed gap, carrying forward the task / owner / timeline / team-mode already established:

| Primary gap | Resume at |
|---|---|
| Enrollment | Phase 3 (run all four moves) |
| Authority | Phase 4, element 5 (then continue to 5 and 6) |
| Context | Phase 3 Move 1 → Phase 4, element 2 (then continue) |
| Success criteria | Phase 4, element 3 (then continue to 5 and 6) |
| Accountability diffusion | Phase 1 (owner-selection) → Phase 4, element 6 |

After resuming at the gap's phase, run forward to the end of the flow. Don't skip the artifact assembly — the corrected brief is the point.

If the user declines: deliver the diagnosis and stop. Do not push.

---

## Acceptance self-audit (run before delivering the diagnosis)

- [ ] The named gap is one of the five (Enrollment / Authority / Context / Success criteria / Accountability diffusion)
- [ ] The principle is attributed to a specific source (Grove, Hormozi, Sullivan, Oncken/Wass, etc.)
- [ ] The failure mode named maps to a row in the Phase 7 failure-mode table
- [ ] The corrective move is structural, not relational
- [ ] The offer to re-run pre-delegation is present
- [ ] The diagnosis does not blame the owner where the gap is structural
