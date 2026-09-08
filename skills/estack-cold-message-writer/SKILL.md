---
name: estack-cold-message-writer
version: 1.1.2
description: >-
  (cold-message-writer) First-touch messages to someone who does not know the
  sender, on LinkedIn, email, or X DMs, for fundraising, hiring, partnerships,
  press, or job-seeking. Use when the recipient is a stranger or
  near-stranger. Mail to someone who already knows the sender is
  estack-email-writer.
---

# Cold message writer

The entire job of a cold message is to make one real person feel like you wrote it only for them. Get that right and the reply takes care of itself. Get it wrong, and it doesn't matter how polished the words are. Most cold outreach fails because it's about the sender (their title, their company, their CV) and reads like it was pasted into a list of 500 names. This skill writes the opposite of that.

This skill owns first-touch psychology: making the reader feel chosen, hooks, weightless asks, and follow-ups. `estack-email-writer` has complementary advice on email craft and voice; consult it for a cold email when it will improve the requested draft. If the recipient already knows the sender or their org, use `estack-email-writer` alone.

## The one rule everything serves

The reader you're writing to gets dozens of these a day and filters ruthlessly. They are not reading carefully. They decide in about two seconds whether to open and another two whether to reply. So every line has to earn its place, and the whole thing has to feel hand-typed for them specifically. When in doubt, cut, don't add. Length is just more reasons to leave.

## Workflow

1. **Use the context already provided.** Never invent a recipient detail or a hook. A good draft normally needs the recipient, the ask, and one true reason for reaching out. Ask only for a missing detail that would make the message unusable; otherwise draft with a clear placeholder or say what is absent.
2. **Adapt to the channel and situation.** Channel changes the mechanics (see Channel rules). Situation changes the proof and the hook (see Situation playbooks in `references/templates.md`).
3. **Draft one tight message** by default. Apply the tactics below. Then offer the follow-up sequence and alternate variants if they want them, but don't dump them unasked.
4. **Self-check against the anti-patterns** before handing it over. If any are present, rewrite.

## The tactics

Apply these to every draft. They are not a checklist to cram in all at once; pick the two or three that fit the situation and let the message stay short.

1. **Make them feel chosen.** They have to believe you picked them on purpose, not pasted them in. Specificity sells it: a number, a reason, a list. "I made a short list of [role]s I wanted in early, you're on it." "We're only showing this to about 10 people before launch." The vaguer it is, the more it reads like a blast.

2. **Open with a hook, about them, not you.** The first line is the notification preview (and the email subject), often the only thing they see before deciding to open. It must be about the reader: their work, their world, their objection, a mutual. Litmus test: if the subject line or the first line starts with "we," "I," "our," or the sender's company or product, rewrite it. "We built X" and "we just shipped Y" are sender-accomplishment openers and fail this test even when the accomplishment is real and relevant; move that proof to line two and lead with the reader. Good openers: "quick question about [their launch]," "[mutual] told me to reach out to you," "you get 40 of these a week, this isn't that," "you're one of ~10 people I'm showing this before launch." Never open with "I noticed that," it signals an incoming pitch and they brace.

   Before (fails, leads with us): "we wired our product into your platform, so our 40k users can now reach it."
   After (about them, proof demoted to line two): "you built the rails for exactly this. we ran with it, our 40k users are now on them."

3. **Say their objection before they can.** Naming the reason they'd ignore you disarms it and makes you sound like a person, not a sequence. "you don't know me, so feel free to ignore this, but I think it's actually for you." "I know you get 50 of these a day, I'll keep it to three lines."

4. **Make the ask weightless.** The yes should cost them nothing. Don't ask for 30 minutes, ask for a glance. "want the 90-second version? I'll drop it right here." "I can show you in two screenshots, no call." "just reply 'send it' and it's in your inbox."

5. **Prove demand without bragging.** Quiet, specific, small proof beats any adjective. "showed this to five people Monday, four asked in." "two teams in your space already grabbed a spot." The moment it becomes "everyone loves it," they stop believing you. The same move applies to proving your own competence: ladder every claim down to the hardest specific it can reach. "executed on key initiatives" → "drove impact" → "helped grow ARR by $1M in three months." If a line can be made more concrete, it isn't done yet.

6. **Make it unmistakably about them.** Don't just name a detail, connect it to why you're reaching out. "you wrote about [problem] last week, this is the fix for exactly that." "saw you're hiring a [role], which usually means [pain], that's why I'm here." "Love what you're building" does none of this and should be deleted.

7. **Match the channel's native register.** A lowercase first name can work in an informal DM, but it is a style choice, not evidence of authenticity. Match the sender's actual voice and the relationship.

8. **Keep it short enough to be read quickly.** Cut context that does not earn the reply. The right length depends on the channel, audience, and ask.

9. **One ask per message.** Two asks double the work to reply, so people do neither. Pick the single smallest yes and ask for that alone. The bigger favor (the intro, the call) waits for message two.

## Channel rules

The principles are constant. The mechanics change by channel.

**LinkedIn.** Treat notes, timing, and InMail subjects as choices to test against the recipient and the current product experience. A low-friction connection request can be useful, but it is not a universal rule. Keep the first message personal and avoid making it look like an automated sequence. The first line often appears in the notification preview, so give it the reader's reason to care.

**Email.** You get a subject line and slightly more room, but the discipline is the same. The subject should sound like a person, not a campaign ("quick one about [their thing]"). First line still should give the reader a reason to care. Add only enough context to make the small ask credible.

**X (Twitter) DMs.** The most casual and often the shortest. No subject. Often there's existing context (they followed back, replied to a post), so lean on it. Use the register the sender would naturally use. The weightless ask matters most because the medium itself signals low commitment.

## Sound like a human, not a system

This is the deepest version of the one rule, and the most common failure. A cold message that is tactically perfect but tonally polished still dies, because polish is the tell of a template, and a template is exactly what the reader filters out. The target is not "well written." The target is "a real person clearly typed this for me, probably between meetings." Slightly rough beats smooth.

`estack-email-writer` has complementary guidance on grounding a draft in the sender's voice and avoiding templated prose. Consult it when that added craft will help this draft. Cold-specific additions:

- Let the channel and the sender's real voice set the register. Informal DMs often benefit from a casual tone; business contexts may not.
- Do not manufacture roughness. Remove wording that feels templated, but keep the draft clear and natural.

## Anti-patterns (rewrite if any appear)

- "figured I'd reach out" or any empty opener burning the notification preview on nothing
- "I noticed that..." (telegraphs the pitch)
- Opening with the sender's title, company, past companies, or what they built before giving the reader a reason to care. This includes "we built X" or "we just shipped Y" as the first line. The first line and the subject are about the reader, full stop.
- More than one ask
- Unneeded length that obscures the reason for writing or the ask
- Adjective-bragging ("amazing," "game-changing," "everyone loves it") instead of small specific proof
- "Love what you're building" or any detail that isn't tied to why you're writing
- Asking a stranger for 30 minutes up front
- A bold InMail subject line

## When they ghost

Most first messages get no reply, that's normal. The follow-up is where it's won or lost. Never "just bumping this up." The key move is handing them an easy no so they stop bracing and actually answer. The full ghost sequence and the situational templates (warm proof, no proof yet, post-engager, mutual intro, wrong-person, soft no, cold revival, job-seeking) live in `references/templates.md`. Read that file whenever the user wants follow-ups, a specific situation handled, or ready-to-send templates rather than a single bespoke draft.

## Output

By default, hand back one tight message, then a one-line offer to also write the ghost sequence or a couple of alternate angles. If the user asks for options, give 2 to 3 labeled variants that pursue genuinely different strategies (e.g. "lead with the mutual" vs "lead with their post"), not just three tones of the same thing.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-cold-message-writer:` and a body. File an
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
