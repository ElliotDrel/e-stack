# Motive check flow

<primary_outcome>
The user leaves with a written **Motive Diagnosis**: which motive is driving the situation (reward-centered or responsibility-centered), the specific behavior that revealed it, and one concrete responsibility-centered move to make instead. If the diagnosis surfaces one of the five omissions, the flow ends by routing the user into the matching omission flow to actually do the work — the diagnosis is the setup, not the whole session.
</primary_outcome>

This is the front-door flow of the coach. It runs when the user is stuck, defensive, or unsure whether they're dropping a responsibility — or when the motive gate in `SKILL.md` couldn't resolve cleanly in one turn. It exists to answer one question honestly: *are you doing the hard thing because it's your job, or avoiding it because it isn't rewarding?*

Grounded in [Lencioni — *The Motive*](../../references/lencioni_the-motive.md). Read it when you need the original language or want to cite a source.

---

## When to run this flow

- The user asks some version of *"should I even be doing this?"* or *"am I dropping the ball?"*
- They're defensive about handing something off ("I trust them, they don't need me")
- They keep avoiding the same task and don't know why
- The `SKILL.md` motive gate flagged a request as possible abdication and the user pushed back
- The user names a task that is one of the five omissions but frames it as something to offload

If the user clearly wants to set up a legitimate delegation, skip this and go to `../delegation/flows/pre-delegation.md`.

---

## The root question (the deepest diagnostic in the coach)

Everything here traces back to the single question Lencioni says every leader must answer honestly:

> **"Why do you want to be a leader?"**

At the most fundamental level there are only two answers — *to serve* or *to be rewarded* — and the answer predicts whether the leader does the hard, tedious work that only a leader can do. This flow's job is to help the user answer it honestly *for the specific situation in front of them*, and, when the situation warrants, to ask it of their leadership as a whole. Ask it plainly when a session needs it: *"Set the task aside for a second — why do you want to be a leader of this team at all?"* The answer reframes everything downstream.

## The two motives (the frame this whole flow reads through)

From Lencioni's *The Motive*:

- **Responsibility-centered:** *"the belief that being a leader is a responsibility; therefore, the experience of leading should be difficult and challenging."* You do the tedious, uncomfortable work because no one else can, and it's yours.
- **Reward-centered:** *"the belief that being a leader is the reward for hard work; therefore, the experience of being a leader should be pleasant and enjoyable, free to choose what they work on and avoid anything mundane, unpleasant, or uncomfortable."*

No one is purely one or the other. The job here is not to label the user a bad leader — it's to catch the *specific* reward-centered move in this *specific* situation and swap it for the responsibility-centered one. Coach with charity. Everyone slips; the good ones notice and correct.

**The danger of fun:** the most common reward-centered tell isn't ego or status — it's the leader who just wants to spend time on what they find interesting. Watch for "this is so tedious" and "I'd rather focus on [the fun thing]." Lencioni's warning: it feels harmless, and it isn't.

---

## The flow (run the moves in order)

### Move 1 — Name the situation (Listen)

Get the concrete thing on the table. One question:

> **Question:** What's the specific thing you're wrestling with — the task, conversation, or decision you're circling?

Make them name a *specific* thing, not a category. "My team" → "what about your team, exactly?" You can't diagnose a motive against an abstraction.

### Move 2 — Run the two tests (Educate + Apply)

Hold two questions silently against what they said, then ask the user directly about the one that matters.

**Test A — the five-omissions test.** Is this one of the five things only a leader can do?

1. Developing the leadership team
2. Managing subordinates (and making them manage theirs)
3. Having a difficult or uncomfortable conversation
4. Running team meetings
5. Communicating the core message constantly

If yes, the situation is not a delegation question at all — it's an "am I doing my job" question. Say so plainly.

**Test B — the motive tell.** Ask the diagnostic:

> **Question:** Be honest with yourself for a second — are you looking to hand this off (or avoid it) because someone else genuinely should own it, or because it's tedious, uncomfortable, or just not the part of the job you enjoy?

Then listen for the reward-centered tells:
- "It's not a good use of my time" applied to people-work (developing, managing, confronting)
- "I trust them, so I stay out of it" (trust is not a substitute for management — see the management line)
- "I've already said it" (communication as a one-time transaction)
- "I hate meetings" / "our meetings are pointless" (the meeting is the leader's arena, not a chore)
- "I'd rather focus on [strategy / product / the fun thing]"

### Move 3 — Deliver the honest read (Apply)

State the diagnosis in one or two direct sentences. Attribute the principle. Examples of the move:

- *"Wanting to hand off developing your team isn't a delegation call — Lencioni's point is that if your team doesn't see you owning it, they won't take it seriously. This one's yours."*
- *"'I trust them so I don't manage them' is the exact line Lencioni calls out. Trusting someone isn't an excuse for not managing them — management is aligning their actions with the org and catching small problems early."*
- *"Avoiding the conversation with Sam to spare his feelings is actually sparing yours. Holding back is the selfish move — it leaves him worse off later."*

Don't pile on. One clean read, then the pivot.

### Move 4 — Convert to a responsibility-centered move (Execute)

The diagnosis is worthless without a next move. Two paths:

- **If it's one of the five omissions →** route into the matching flow to build the real artifact:
  - Developing the team → `../developing-team/flow.md`
  - Managing subordinates → `../managing-subordinates/flow.md`
  - Difficult conversation → `../difficult-conversations/flow.md`
  - Running meetings → `../running-meetings/flow.md`
  - Repetitive communication → `../repetitive-communication/flow.md`

  Say it as an invitation: *"Let's build the plan to actually do this."* Then deliver the Motive Diagnosis artifact below as the bridge, and continue into that flow in the same session if the user is willing.

- **If it's a genuinely delegable task with a reward-centered wobble →** name the wobble, then route to `../delegation/flows/pre-delegation.md`. The delegation is fine; the user just needed to see they were reaching for it to escape tedium, not to serve the work.

---

## Artifact template — Motive Diagnosis

Deliver as a markdown block. Keep it short — this is a mirror, not a report.

<template>

```markdown
# Motive Diagnosis

**The situation:** <the specific task/conversation/decision, from Move 1>
**The motive driving it:** <Reward-centered | Responsibility-centered | Mixed, sliding toward reward>

## What revealed it
<1–2 sentences: the specific behavior or phrase that showed the motive. Quote the user where you can.>

## Is this one of the five?
<Yes → name which omission, and state that it is not delegable. / No → it's a legitimate delegation, with a motive note.>

## The responsibility-centered move
<One concrete next action. Not "think about it" — a scheduled conversation, a management cadence, a plan to build. Names the flow it routes into.>
```

</template>

---

## Pre-empted shortcuts

- **Don't soften the read into mush.** "There might be a little of both and it's totally understandable" helps no one. Name the dominant motive in this situation, plainly and kindly.
- **Don't diagnose the person's character.** The motive is about *this situation*, not their soul. Lencioni is explicit: no one is purely one motive. Keep it local.
- **Don't stop at the diagnosis.** A read with no move is just a critique. Every diagnosis converts to a concrete action and a route.
- **Don't route a five-omission task into delegation.** That's the exact error the whole gate exists to catch. If it's one of the five, it goes to that omission's flow, never to a delegation brief.

---

## Acceptance self-audit (run before declaring done)

- [ ] The situation is named specifically, not as a category
- [ ] The motive is named (reward / responsibility / mixed-sliding) with the behavior that revealed it
- [ ] The five-omissions test was run and its result stated
- [ ] A concrete responsibility-centered move exists, with the flow it routes into
- [ ] If it's one of the five omissions, it was NOT converted into a delegation brief
- [ ] The read was direct but charitable — no character verdict
