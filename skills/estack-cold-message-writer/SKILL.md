---
name: estack-cold-message-writer
version: 1.1.0
description: (cold-message-writer) Write cold outreach messages that actually get replies, on LinkedIn, in email, or in X (Twitter) DMs. Use this skill whenever the user wants to reach out cold to someone they don't know or barely know, including phrases like "write a cold DM," "cold email," "LinkedIn message to," "reach out to," "pitch [person]," "how do I get [person] to reply," "DM this investor/recruit/partner/podcast host," "email a founder/company I want to work for," "cold email for a job," "land a job at [company]," "reach out about a role," "follow up with someone who ghosted," or any request to draft a first-touch message to a stranger or near-stranger for fundraising, hiring, partnerships/BD, press/podcasts/speaking, or job-seeking. Trigger this even when the user just pastes a name, a role, and "help me reach out," and even when they don't say the word "cold."
---

# Cold message writer

The entire job of a cold message is to make one real person feel like you wrote it only for them. Get that right and the reply takes care of itself. Get it wrong, and it doesn't matter how polished the words are. Most cold outreach fails because it's about the sender (their title, their company, their CV) and reads like it was pasted into a list of 500 names. This skill writes the opposite of that.

This skill owns first-touch psychology: making the reader feel chosen, hooks, weightless asks, ghost sequences. The general email craft — subject-line mechanics, body structure, the scheduling ask, and the full sound-like-a-human voice guide — lives in `estack-email-writer`. For a cold email, load both and let them work in tandem: this skill decides the strategy and the hook, that one polishes the craft. If the recipient already knows the sender or their org, use `estack-email-writer` alone.

## The one rule everything serves

The reader you're writing to gets dozens of these a day and filters ruthlessly. They are not reading carefully. They decide in about two seconds whether to open and another two whether to reply. So every line has to earn its place, and the whole thing has to feel hand-typed for them specifically. When in doubt, cut, don't add. Length is just more reasons to leave.

## Workflow

1. **Get the missing context before drafting.** Never invent the specifics. To write a real message you need: who the recipient is (name, role, company), what the sender is offering or asking for, and ideally one true hook (a post they wrote, a launch they shipped, a mutual connection, a thing they're hiring for). If the user hasn't given you a genuine hook, ask for one or tell them the message will be weaker without it. Do not fabricate a fake "I loved your post about X."
2. **Confirm channel and situation.** Channel changes the mechanics (see Channel rules). Situation changes the proof and the hook (see Situation playbooks in `references/templates.md`).
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

7. **Use a lowercase first name.** Type "hey tom," not "hey Tom." Every automation auto-capitalizes the name, so a lowercase one is a quiet tell that a human typed this by hand.

8. **Keep it short.** Aim under 50 words for a DM. The agency version that fails runs 120. Short is not a constraint, it's the point.

9. **One ask per message.** Two asks double the work to reply, so people do neither. Pick the single smallest yes and ask for that alone. The bigger favor (the intro, the call) waits for message two.

## Channel rules

The principles are constant. The mechanics change by channel.

**LinkedIn.** Send the connection request with no note (empty requests get accepted more, because a note triggers a second "clear this" notification). After they accept, wait a few days before the first message so it doesn't feel automated. If they haven't accepted in two weeks, send an InMail with no subject line, because LinkedIn bolds the subject and recipients now read a bold line as "ad." The one exception: a lowercase, offhand subject that reads like a text, not an ad (see the annotated best-message example in `references/templates.md`). The first line is the notification preview, so it carries the whole open.

**Email.** You get a subject line and slightly more room, but the discipline is the same. Subject should be short, lowercase or sentence case, and sound like a person, not a campaign ("quick one about [their thing]"). First line still can't be about you. A touch more context is allowed than a DM, but if it's over ~90 words it's too long. One ask, weightless.

**X (Twitter) DMs.** The most casual and the shortest. No subject. Often there's existing context (they followed back, replied to a post), so lean on it. Lowercase throughout reads native here. Two to four lines max. The weightless ask matters most because the medium itself signals low commitment.

## Sound like a human, not a system

This is the deepest version of the one rule, and the most common failure. A cold message that is tactically perfect but tonally polished still dies, because polish is the tell of a template, and a template is exactly what the reader filters out. The target is not "well written." The target is "a real person clearly typed this for me, probably between meetings." Slightly rough beats smooth.

The full voice guide — grounding the draft in the sender's real voice, the AI tells to kill, what human writing looks like, and the read-aloud test — lives in `estack-email-writer` (the "Sound like a human" section). Run it on every draft before handing it over; it applies doubly here, because a cold reader is actively filtering for templates. Two cold-specific additions on top of that guide:

- Lowercase throughout reads native in DMs, and the casual register of a text to a peer beats a pitch to a prospect.
- When a draft reads clean and balanced, that is the signal to mess it up on purpose: cut a connective, break the parallelism, drop a word, let one line run short.

## Anti-patterns (rewrite if any appear)

- "figured I'd reach out" or any empty opener burning the notification preview on nothing
- "I noticed that..." (telegraphs the pitch)
- Opening with the sender's title, company, past companies, or what they built before giving the reader a reason to care. This includes "we built X" or "we just shipped Y" as the first line. The first line and the subject are about the reader, full stop.
- More than one ask
- A wall over ~50 words (DM) or ~90 (email)
- Adjective-bragging ("amazing," "game-changing," "everyone loves it") instead of small specific proof
- "Love what you're building" or any detail that isn't tied to why you're writing
- Asking a stranger for 30 minutes up front
- A capitalized auto-name in a DM
- A bold InMail subject line

## When they ghost

Most first messages get no reply, that's normal. The follow-up is where it's won or lost. Never "just bumping this up." The key move is handing them an easy no so they stop bracing and actually answer. The full ghost sequence and the situational templates (warm proof, no proof yet, post-engager, mutual intro, wrong-person, soft no, cold revival, job-seeking) live in `references/templates.md`. Read that file whenever the user wants follow-ups, a specific situation handled, or ready-to-send templates rather than a single bespoke draft.

## Output

By default, hand back one tight message, then a one-line offer to also write the ghost sequence or a couple of alternate angles. If the user asks for options, give 2 to 3 labeled variants that pursue genuinely different strategies (e.g. "lead with the mutual" vs "lead with their post"), not just three tones of the same thing.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-cold-message-writer: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-cold-message-writer: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
