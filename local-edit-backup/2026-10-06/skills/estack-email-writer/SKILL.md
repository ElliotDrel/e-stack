---
name: estack-email-writer
version: 1.2.0
description: >-
  (email-writer) Write, edit, or review any email — outreach to an org or
  person who already knows the sender, event and partner invitations,
  scheduling and meeting requests, replies, follow-ups, internal email, and
  coaching someone else's draft. Use for: drafting an email from scratch,
  tightening or rewriting a draft, picking a subject line, structuring an ask,
  proposing meeting times. Triggers: "write an email", "review my email",
  "fix this email draft", "make this email better", "what should the subject
  line be", "email [person] about", "reply to this", "help me ask for a
  meeting". For a first-touch message to a stranger who has no idea who the
  sender is, ALSO load estack-cold-message-writer — the two work in tandem
  (that skill owns first-touch psychology, this one owns general email craft).
---

# Email writer

Every email has one job, usually to get one specific reply or action. Most drafts fail by burying that job under logistics, jargon, and pleasantries. The work of this skill is deciding what the job is, cutting everything that doesn't serve it, and making the one ask effortless to say yes to.

## How this pairs with estack-cold-message-writer

That skill owns the psychology of a first touch to a stranger: making them feel chosen, hooks, weightless asks, ghost sequences. This skill owns the craft that applies to every email regardless of who it's to: subject lines, structure, the scheduling ask, voice. For a cold email, load both — cold decides the strategy, this polishes the craft. If the recipient already knows the sender or their org (a past attendee, a community partner, a colleague, a warm intro), this skill leads and the cold skill stays closed.

## Workflow

1. **Name the email's one job.** The single reply or action you want. Write it down before drafting. Every sentence either moves the reader toward it or gets cut.
2. **Gather real context.** Who the reader is, what they actually do and care about, and any genuine shared history with the sender (an event you both attended, a prior thread, a mutual project). Never invent these. If the user hasn't supplied them, ask.
3. **Draft, then cut.** A revision should mostly delete. When it adds, it adds specificity (a name, a number, a date), never qualifiers or restatements.
4. **Write the subject line last**, once you know what the email actually says.
5. **Run the voice check** (below) before handing it over.

## Subject line

- The reason to open must fit in the first ~40 characters — that's all a phone notification shows.
- Never lead with the recipient's name or their org spelled out. They know who they are, and it tells them nothing about why to open. If their org appears at all, abbreviate it (they'll recognize their own abbreviation).
- Lead with the thing that's news to them: your event, your offer, your question. Add a timeframe when one exists.

Before: `[Their Organization] x [Your Org] Partnership`
After: `[Your event name] x [their abbrev] — fall 2026`

## The opener

The first line must answer the question the reader is silently asking: "how does this person know me?" A pleasantry ("Hope you're having a great summer!") answers nothing. Genuine shared context does: "I had a great time at [event where you actually met] — I met some great people" proves a relationship exists before the ask arrives. If there is no shared context, one short pleasantry maximum, then get to it: the first sentence of the next paragraph states the reason for writing ("I'm reaching out because...").

**Say the awkward thing before they think it.** If the email has an obvious weakness — late notice, a long silence, an ask out of proportion — name it in your own words near the top and own it. "I'll say the obvious part first: this is extremely late notice and that is on me." A reader who was about to hold it against you now has nothing to hold, and the rest gets read on its merits. Burying it reads as either oblivious or evasive, and both cost more than the admission.

## The body

- **Specifics persuade; abstractions wash out.** Dates, times, headcounts, and names of people or orgs the reader would recognize do the convincing. "100+ founders, with [Partner A], [Partner B], and [Partner C]" beats any adjective.
- **Plain words over insider jargon.** Language that's natural inside your org reads as noise outside it.
  Before: "The goal is to connect builders directly to the broader entrepreneurship pipeline — from ideation to the local ecosystem."
  After: "The goal is to show builders what opportunities are available to them in the area."
- **State facts, not your framing.** "This is a campus-wide event bringing together 100+ founders" beats "We're positioning this as the main campus-wide launch event." The reader doesn't care how you're positioning it; a declared fact is shorter, more confident, and harder to argue with. If a sentence describes your marketing intent instead of the thing itself, rewrite it as the fact.
- **Ground the why-you line in something specific and true about them.** Generic flattery ("given all the great work you do") gets skimmed past. The formula: "Given [specific true thing they actually do], [why this doesn't work without them]." Knowing what they do is the flattery.
- **Say each thing once.** If a sentence restates a point already made, cut it — a second pass at the same idea reads as padding, not emphasis.
- **The first email sells the conversation, not the whole plan.** When the goal is a call, the email carries exactly three things: what the thing is (the goal of the event or project), why you need this reader specifically, and why it falls short without them. Formats, logistics, room layouts, and role details wait for the call — including them up front gives the reader more surface area to object to, buries the ask, and removes the reason to talk at all.

## The ask

- **One ask per email.** Two asks double the work to reply, so people do neither.
- **Exception: the update email.** When the reader has already committed — a partner who said yes, a guest who is on the invite — the email's job is to deliver information and the asks ride along as cheap add-ons. Several are fine there, because none of them is the reason the email exists. Keep the one-ask rule for anything trying to win a decision.
- **Do the reader's work for them.** The strongest ask is one where the artifact already exists. Don't ask a professor to announce your event; write the announcement, put it in a doc, link it, and say "copy and paste, nothing to edit." Don't ask for a forward; supply the text to forward. Every step you remove raises the hit rate more than any wording change does.
- **When cold-emailing an institution, ask for the routing.** Close with "if there is a form, a deadline, or a different person I should go through, tell me and I'll do it properly." Offices ignore requests that arrive through the wrong door, and this turns a dead send into a redirect.
- **Small and time-boxed.** "A quick 15-minute call" is answerable; "a call to discuss" is not.
- **Prefer no-oriented phrasing.** "Would you be against a quick 15-minute call next week?" is easier to answer than "Are you open to a call?" — saying no feels safe, and here "no" means yes. This is straight from `estack-chris-voss`; load it when the email carries a stake worth negotiating.
- **Kill the scheduling round-trip.** Never end with a bare "let me know what time works for you" — that hands the reader homework. Give 2–3 concrete slots (or a plainly stated window: "anytime after 5pm Monday to Friday"), and offer their scheduling link as the fallback so either path closes in one reply.
- **Once they name a time or a window, book it instead of confirming it.** Pick the best slot in or near what they gave you, send the calendar invite, and state the booked time in the reply as the final check. Works even when their time doesn't fit yours: "sorry, can't do 3, but I put us down for 3:30." See `meeting-mentalities` for why this closes faster.
- **Lock your own side first.** If anyone else from your team needs to be on the call, confirm their availability before proposing times to the recipient. Proposing times you then have to walk back costs more credibility than a one-day delay.

## Sound like a human

A tactically perfect email that reads polished-by-a-tool still underperforms, because polish is the tell of a template. The target is "a real person clearly typed this," not "well written."

**Ground it in the sender's real voice first.** Before drafting, use whatever you have of how this person actually writes: past emails, posts, prior messages, a voice sample. Match that. If you have no read on their voice and it matters, ask for a sample. Do not fall back to a generic competent register — that is the thing that reads as AI.

**AI tells to kill (rewrite if any appear):**
- Tidy parallelism and wordplay ("a start, not a finish"). Clever balance reads as crafted, not typed.
- Balanced triplets and lists of three.
- Summary or bow-tie lines that wrap the point up neatly.
- Every sentence the same length and shape. Real writing is lumpy.
- Filler intensifiers and generic enthusiasm ("genuinely excited," "amazing opportunity").
- Em-dashes everywhere. Corporate throat-clearing ("I hope this finds you well"). Stacked adjectives. Templated parenthetical sign-offs.

**What human looks like:**
- Contractions, the occasional fragment.
- Asymmetric rhythm: a short line, then a longer one.
- One real, specific detail instead of a tidy abstraction.
- A small aside or hedge no template would include.

**The read-aloud test.** Before handing a draft over, read it out loud. Does it sound like the sender actually talking? Would they say these words to a peer? Anything they'd never say out loud (a buzzword, a stacked adjective, a bow-tie line) gets cut. This single check catches most of the tells above.

## Sending to a list

One email going to many people is a different job from one email going to one person, and the failure modes are operational rather than editorial.

- **BCC, always, for anyone who shouldn't see the other recipients.** A single CC send on a list someone handed over in confidence exposes every address and ends that relationship. There is no undo.
- **Batch it.** Roughly 100 recipients per send. Most mail providers throttle large recipient counts, and one enormous BCC is the fastest route into a spam filter.
- **BCC is unrecoverable.** No mailbox stores who was BCC'd — not the sender's, not anyone's. If you will ever need to know who received something, paste the list into a file at send time. Nobody can reconstruct it later.
- **Put the sender in the To field**, themselves, so the message isn't a headerless orphan.
- **Personalize the one token that matters and leave the rest generic.** A note that names the reader's college or org gets acted on; the identical note without it reads as a blast and gets ignored. If a variable can't be filled in, don't send that one.
- **Tell whoever gave you the list that it went out.** They handed over something valuable and asked for nothing. Two lines confirming the send is the entire price of being asked again.

## Writing variants of one email

When one email has to go to two audiences whose situations genuinely differ, write the primary version, then change **only the section that is factually different**. Everything else stays word-for-word identical.

The temptation is to re-tune tone, re-order sections, and improve wording in the second version. Resist it. Rewriting introduces drift between the two, makes both harder to review, and produces contradictions when a fact changes later and only one copy gets updated. State up front which single section differs — that sentence is what makes the pair maintainable.

**Don't spoil your own withheld facts.** If something is deliberately unrevealed to the end audience (a mystery prize, an unannounced guest), every version withholds it, including the ones going to partners and staff. Someone who knows the answer will say it out loud to the person it was being kept from. Give them the same line the audience gets, and tell them it's deliberate so they're in on it rather than left out.

## Hygiene

- **cc whoever needs the thread.** If a team or shared inbox needs continuity on the conversation, cc it on the first send — forwarding later loses context and looks like an afterthought.
- **The signature's job is credibility.** Name, then either an official-sounding role ("[org] officer") or just the org name. Vague self-labels ("Leadership," "Executive Team") sound self-appointed and do the opposite. Use the org's real brand casing exactly — always, including in the subject line.

## Output

Hand back one tight draft with a subject line, and flag anything you had to guess (the shared-context opener, the why-them line, the proposed times) so the user can replace guesses with truth. When reviewing someone else's draft, return the edited version plus a short list of what changed and why — the why is what makes the edit reusable.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-email-writer: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-email-writer: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
