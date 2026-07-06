# Phase 7 — Diagnose the Miss (post-mortem)

<primary_outcome>
By the end of this phase you have a written diagnosis: which of the five structural gaps caused the failure, the principle behind it, the specific moment in the prior handoff where the gap opened, the failure mode it maps to, and one corrective move. The diagnosis is delivered in the artifact template defined in the post-mortem flow file, followed by the offer to re-run the pre-delegation flow with the gap corrected.
</primary_outcome>

This phase runs when the user comes back after a delegation has already failed. The work came back broken, late, or off-target — or it never came back. The user is here for the diagnosis, not to recover the lost work.

Your job is to find the *primary* structural gap that, if fixed, would have prevented the failure. Many failures have multiple co-occurring gaps; name them, but don't dilute the diagnosis by treating all of them as equal.

---

## Ask 1–3 questions, then wait

Start with two or three of these, depending on what the user has already told you. Don't fire off all six in one turn.

1. When did you first notice something was off?
2. How did you present the work to them — did you explain the problem and why you chose them, or just hand over the task?
3. Did they know what good looked like before they started?
4. Did they have the authority to make the calls they needed to make?
5. Were there checkpoints, or did you only see it at the end?
6. *(Flat teams)* Was there one clear owner, or was it more of a shared effort?

The order matters: by the time you've asked the first two or three, you usually already have a candidate gap. The rest confirm or rule it out.

---

## The five structural gaps — pick one as primary

Map the user's answers to *one* of these. The primary gap is the one that, if fixed, would have prevented the failure. Secondary gaps may exist; surface them but don't make them the headline.

**The gap beneath the gap — check the motive.** A structural gap is the mechanism; sometimes a reward-centered motive is the reason it opened. If the user skipped monitoring because check-ins felt tedious, skipped enrollment because the conversation felt awkward, or left authority vague to avoid a hard boundary, the corrective move isn't only structural — it's naming that the tedious part *is* the job. Lencioni's definition is the line to hold here: *"Management is the act of aligning people's actions, behaviors, and attitudes with the needs of the organization and making sure that little problems don't become big ones."* The follow-through the user avoided is not overhead on top of delegation — it is the management the delegation required. Name the motive when it's driving the gap, and route to `../../motive-check/flow.md` if the user wants to work it directly. (See `../../../references/lencioni_the-motive.md`.)

### Enrollment gap

The work was *assigned*, not *enrolled into*. The person did the job but didn't bring initiative, judgment, or ownership — because no one explained why it mattered or why they were chosen.

**Signal phrases:**
- "They did exactly what I asked, but they missed the spirit of it"
- "They didn't push back on anything"
- "They didn't bring me anything I didn't already know"
- "They seemed like they were just executing"

**Principle:** Self-determination theory (Deci & Ryan) — autonomy, competence, relatedness all need to be activated. Skipping enrollment means relatedness never landed.

---

### Authority gap

Decision rights weren't transferred. Escalations piled up, or the owner made calls the user expected to be consulted on. Either way, the level was ambiguous.

**Signal phrases:**
- "They kept coming back to me for things I thought they could decide"
- "They made a call I would not have made"
- "I kept getting pulled in mid-execution"
- "They were waiting on me for things I didn't know they were waiting on"

**Principle:** Authority level needs to be named (Phase 4 ⑤). The owner assumed one level; the user assumed another. Unnamed authority is the most common source of mid-execution friction.

---

### Context gap

The *why* was missing. The work was technically correct but strategically off. The owner couldn't make good tradeoffs when conditions shifted, because they didn't understand the purpose.

**Signal phrases:**
- "It's technically what I asked for but it's wrong"
- "They didn't catch [something obvious to anyone who understood the situation]"
- "It would have been right if [some context the owner didn't have]"

**Principle:** Without context, people execute the letter and miss the spirit. The brief's ② (Why this matters) wasn't filled in, or wasn't delivered in the enrollment conversation.

---

### Success criteria gap

The user knew what good looked like; the owner didn't. The standard lived in the user's head. The work came back below the bar — but the bar was never externalized.

**Signal phrases:**
- "I knew it when I saw it, but they couldn't have known"
- "It's not bad, it's just not what I had in mind"
- "I'd want it more [adjective] — but I never said that"
- "The format/tone/length is wrong"

**Principle:** Hormozi's STAR #2 ("define what done looks like by behavior or outcome") / Sullivan's Impact Filter. If the standard wasn't externalized as a specific behavior or outcome before work began, the user was the only one who knew it.

---

### Accountability diffusion *(flat teams only)*

Nobody failed; the work just didn't get done. Or it got done by three people and none of them knew the other two were also doing it. Ownership was "shared" or informally understood rather than explicitly claimed by one person.

**Signal phrases:**
- "We were all pitching in on it"
- "It was a team effort"
- "I thought [other person] was handling that part"
- "It just kind of fell through"

**Principle:** Work that belongs to "everyone" belongs to no one. One person, one outcome, named out loud — even in flat teams. Diffusion is the most common flat-team failure mode, and it's structurally different from the other four because it predates the handoff entirely.

---

## Full failure mode reference table

Once the primary gap is named, map it to one of these failure modes for the diagnosis artifact:

| Failure mode | What it looks like | Root cause |
|---|---|---|
| **Abdication** | Handed off without structure; work comes back broken | Missing brief + no monitoring plan |
| **Skipped enrollment** | Person executes competently but without initiative or ownership | Task was assigned, not enrolled — no purpose framing, no invitation |
| **Accountability diffusion** | Work stalls or drifts; nobody dropped it but nobody drove it | Ownership was shared or informal — no single person explicitly claimed it |
| **Micromanaging** | Hovering, re-doing work, daily updates untied to milestones | Vague success criteria upfront; the user is trying to fix at handoff what should have been fixed in the brief |
| **Monkey transfer** | The user is following up on work they assigned | Didn't define the owner's next action when they escalated |
| **Vague success criteria** | Deliverable clear; standard wasn't | Taste not externalized before work began |
| **Wrong TRM calibration** | Over-trusted on unfamiliar task, or smothered an expert | Applied general impression to a task-specific decision |
| **Implicit authority** | One party made a call the other expected to be consulted on | Authority level never named |
| **Keeping interesting work** | Delegated routine; held strategic / creative | Identity fused with execution |

When you write the diagnosis, name the failure mode by its row label. This gives the user a vocabulary for the pattern that they can use the next time.

---

## The corrective move — structural, not relational

Once the primary gap is named, the corrective move is the structural fix. **Don't recommend "have a talk with them"** — that's a deflection, not a fix. The structural fixes that actually prevent recurrence:

| Gap | Structural corrective move |
|---|---|
| Enrollment | Run the four-move enrollment conversation (Phase 3) before the brief is shared next time. Specifically, name "why you" with concrete evidence. |
| Authority | Name the authority level explicitly using the 1–5 scale (Phase 4 ⑤). Write it in the brief. State it in the sit-down conversation. |
| Context | Fill in the brief's ② (Why this matters) in writing. Deliver it as part of the enrollment conversation. |
| Success criteria | Name the specific behavior or outcome that defines done (Hormozi STAR #2), or run the Sullivan Impact Filter. Externalize the standard *before* work begins. |
| Accountability diffusion *(flat)* | One owner. One outcome. Stated out loud. Reciprocal commitments named (Phase 4 ⑥). |

---

## Real-world case: Nicole Wipp — the first-hire failure that was actually a clarity failure

Attorney Nicole Wipp opened her own law firm during the 2008 recession and ran herself into the ground at 80–100 hours a week as a solo practitioner, still not clearing six figures. Her first attempt at hiring failed — the obvious read was "the hire didn't work out." Sullivan and Hardy's diagnosis was the opposite: the hire failed because *Nicole had not yet defined the role's specific results clearly enough for anyone to succeed in it*. The standard for "done" lived in her head; the new Who walked in blind. Only after that first painful miss did Nicole sharpen her vision precisely enough that subsequent hires could execute autonomously.

The proof landed during COVID-19: with Nicole stranded in Hawaii and her team in Michigan, the firm completed a full operational transition for vulnerable elderly clients with Nicole only providing the vision — the team owned the how. The lesson for Phase 7: when a delegation fails and the first instinct is "they dropped the ball," run the diagnostic the other direction first. The bar usually wasn't externalized. Fixing the next handoff is a brief problem (write the Impact Filter's Success Criteria), not a personnel problem.

Source: [Sullivan & Hardy — *Who Not How*](../../../references/sullivan_who-not-how.md)

---

## Real-world case: Sanchez — "raised dependents, not leaders" (Enrollment + decision-bottleneck failure)

Codie Sanchez's most common diagnostic for delegation failure isn't that the work was wrong — it's that the founder accidentally trained the team to wait for them. Two of her framings, taken from her YouTube shorts, land directly on the Phase 7 *Enrollment gap* and on the broader pattern where the user becomes the bottleneck without realizing it.

From *The 3 Jobs Of A CEO*: *"Your entire job is to hire people better than you at what they do, then get out of their way. And if you're still in the weeds doing everything, something is wrong. It's either A, you hired the wrong person, or B, you haven't set them up to actually do the job. As Warren Buffett says, don't get a dog and then do the barking."* And later in the same video: *"If everyone has to call you every time something small comes up, the vision isn't clear enough. And that means you kept the strategy in here instead of telling it to the company."* That second line is the Phase 7 *Context gap* in one sentence.

The deeper Sanchez principle is from *Pay Won't Fix Performance*: when work comes back competent but soulless, the lever is not money — it is enrollment. *"Instead of when performance dips, reaching for money or perks, you just fire bad bosses. You tell your employee exactly why you they're your best. You give them ownership over something that matters. You let them make real decisions without somebody over their shoulder yapping. You show them where they're going next, because people don't just want to be paid, they want to matter."* That is the four-move enrollment conversation (Phase 3) restated as a post-mortem corrective.

Use this case during coaching when the user's diagnostic answers point toward Enrollment gap or toward "they kept coming back to me for small things" — Sanchez's framing reframes the failure from a *team* problem ("they're dependent") to a *system* problem the user owns ("I either hired the wrong person or didn't set them up").

Source: [Sanchez — *Main Street Millionaire* (and related video content)](../../../references/sanchez_main-street-millionaire.md), drawn from *The 3 Jobs Of A CEO* and *Pay Won't Fix Performance*.

---

## Source gap acknowledged: accountability diffusion in flat / co-founder teams

The vault still does not hold a verified case study of accountability diffusion on a flat / co-founder team specifically. The Sanchez reference was substantially deepened in May 2026 with 11 YouTube short transcripts on hiring, vision, motivation, and decision-tiering — but none of those videos address flat-team, peer-level, or co-founder dynamics where no one has positional authority over anyone else.

The structural illustration to use during coaching: when a flat team says "we were all pitching in on it" or "I thought [other person] was handling that part," the failure is not effort, skill, or motivation — it is that no single person had standing to make the in-flight calls. The corrective move is structural, not motivational: one named owner, one named outcome, reciprocal commitments stated out loud (Phase 4 ⑥). Acknowledge to the user that the vault is still being populated with flat-team case material; offer to coach from the principle and run the four-question diagnostic against their actual situation.

Source gap: see [Sanchez — *Main Street Millionaire*](../../../references/sanchez_main-street-millionaire.md) "Known gaps" section, item 4 (co-founder / flat-team dynamics), for what is still missing and which additional sources would close it.

---

## Pre-empted shortcuts

- **Don't diagnose before asking the diagnostic questions.** It's tempting to pattern-match on the first sentence the user says. Run the questions — the surface story usually hides the actual gap.
- **Don't pick the first gap that fits.** Multiple gaps often co-occur. Name the *primary* one — the one that, if fixed, would have prevented the failure.
- **Don't recommend "talk to them" as the corrective move.** Structural fix only. Specific brief element, specific authority level, specific check-in.
- **Don't make the diagnosis about the owner's character.** Almost every delegation failure is structural, not character-based. If you're building a case against the owner, you've drifted.
- **Don't deliver the diagnosis without the offer to re-run pre-delegation.** The offer is the bridge from understanding-the-miss to actually-fixing-it.

---

## Phase 7 is complete when

- One of the five structural gaps is named as the primary cause
- A specific moment or omission in the prior handoff is identified as where the gap opened
- The failure mode is named from the table
- A structural corrective move is named — not "talk to them," but a specific brief element / authority level / check-in
- Secondary gaps (if any) are noted but not made the headline
- The diagnosis is delivered using the post-mortem artifact template
- The offer to re-run the pre-delegation flow is made

When all of those are true, the post-mortem flow assembles the artifact and delivers it.

---

> **Going deeper.** Everything you need to coach this section is above. If the user asks where this comes from, or you need a more detailed take, load:
> - [Grove — *High Output Management*](../../../references/grove_high-output-management.md) — abdication, monitoring, TRM
> - [Gerber — *The E-Myth Revisited*](../../../references/gerber_e-myth-revisited.md) — management by abdication
> - [Hormozi (Alex) — Team Follow-Through (5 STAR)](../../../references/hormozi-alex_followthrough.md) — 5 reasons follow-through fails (STAR diagnostic ladder)
> - [Sullivan — *Who Not How*](../../../references/sullivan_who-not-how.md) — Impact Filter for success criteria
> - [Oncken & Wass — HBR 1974](../../../references/oncken-wass_monkeys-hbr-1974.md) — monkey transfer
> - [Deci & Ryan — Self-Determination Theory](../../../references/deci-ryan_self-determination-theory.md) — enrollment as activating autonomy / competence / relatedness
> - [Doerr — *Measure What Matters*](../../../references/doerr_measure-what-matters.md) — vague-success-criteria diagnosis; "Goals Gone Wild" failure mode
