---
name: estack-sponsorship-offer-builder
version: 1.0.0
description: >-
  (sponsorship-offer-builder) Coach the user through defining a clear, compelling
  sponsorship offer — what a sponsor actually gets, what it costs, and why it beats
  their alternatives — then optionally build the assets that sell it: a sponsorship
  packet, a cold email chain, and a script for the meeting a sponsor books after
  replying. Use whenever the user wants to get sponsors or partners for an event,
  club, student org, accelerator, conference, podcast, team, or community. Triggers:
  "sponsorship offer", "sponsorship packet", "sponsor deck", "sponsorship proposal",
  "sponsorship tiers", "how much should we charge sponsors", "what do we offer
  sponsors", "get companies to sponsor us", "partnership offer", "rewrite our
  sponsor packet", "sponsor outreach". Also use when the user has a sponsorship
  packet or proposal and asks whether it is any good.
---

# Sponsorship Offer Builder

Most sponsorship asks fail before the first email is opened, because there is no actual offer inside them. A logo on a banner is not an offer. This skill coaches the user through defining a real one — something a specific sponsor would recognize as a good trade — and then, only after that offer exists, helps build the assets that carry it: the packet, the outreach emails, and the meeting script.

The lens for everything here is Alex Hormozi's Value Equation:

**Value = (Dream Outcome × Perceived Likelihood of Achievement) ÷ (Time Delay × Effort & Sacrifice)**

Every deliverable this skill produces gets judged against those four levers: does it raise the outcome the sponsor wants, raise their belief they'll get it, or cut the time and effort to see it? Anything that does none of those gets cut.

<primary_outcome>
Every session must produce, at minimum, a written sponsorship offer as a Markdown file: named sponsor profile, asset list mapped to sponsor outcomes, the packaged offer with price, risk reversal, and the reason to act now. A conversation about the offer, a critique without a rewrite, or a list of assets with no packaging does not count. The optional paths (packet, emails, meeting script) come after that file exists, never instead of it.
</primary_outcome>

## Voice and posture

- **Coach, don't generate.** Work through the phases with the user one step at a time and build the offer from their real answers. An offer invented from assumptions is fiction, and sponsors can tell. When a field is unknown, ask; if the user genuinely doesn't know, mark it as an assumption to verify, visibly, in the output.
- **Confident and specific, never hype.** The researched frameworks shape the substance; the voice stays grounded. No fake urgency, no false scarcity, no "amazing opportunity". If a scarcity or urgency claim appears in any draft, it must be literally true (real capacity limit, real date), because one caught lie costs the whole relationship.
- **Sponsor's point of view, always.** The sponsor is the hero of every document; the user's organization is the guide. Any sentence that exists to make the organization look impressive, rather than to help the sponsor get an outcome, gets rewritten or cut.
- **Match depth to stakes.** A $500 local ask gets the compressed path. A $25k flagship sponsor gets the full flow.

## The flow

Phase 0 and Phase 1 are the core. The three paths after them are optional and get offered, by name, once the offer file exists.

| Phase | What it produces | Step file (read first) | Reference files (read second) |
|---|---|---|---|
| 0. Discovery | Asset inventory, sponsor profile, critique of any existing packet | `steps/step-0-discovery.md` | `references/03-sponsorship-market.md`, `references/07-start-with-why.md` |
| 1. The offer (core deliverable) | The sponsorship offer as a Markdown file | `steps/step-1-offer.md` | `references/01-hormozi-value-equation.md`, `references/02-positioning-and-pricing.md`, `references/06-storybrand-messaging.md` |
| Path A. Sponsorship packet | Page-by-page packet copy, ready to lay out as a PDF | `steps/path-a-packet.md` | `references/03-sponsorship-market.md`, `references/06-storybrand-messaging.md` |
| Path B. Cold email chain | 1 initial email + 3 follow-ups | `steps/path-b-email-chain.md` | `references/04-outreach-psychology.md` |
| Path C. Meeting script | Discovery-first script for the call a sponsor books | `steps/path-c-meeting-script.md` | `references/05-discovery-call.md`, `references/03-sponsorship-market.md` |

Read the step file AND its reference files before responding to the user in that phase — the frameworks live there, and output written without them comes out generic. The step files tell you how to run the phase; the reference files are the distilled source research (each cites its original sources with URLs).

The full reference set, for when depth or attribution is needed outside the table's routing:

- `references/01-hormozi-value-equation.md` — Hormozi's Value Equation, Grand Slam Offers, the 5-step stack, enhancers, MAGIC naming
- `references/02-positioning-and-pricing.md` — Blair Enns: expert positioning, the value conversation, three-option pricing, anchor high
- `references/03-sponsorship-market.md` — how sponsorship is actually sold: the 6-page proposal, no tiers, discovery questions, fulfillment reports
- `references/04-outreach-psychology.md` — Cialdini's 7 principles tuned for follow-up sequences; Blount's prospecting laws and cadence
- `references/05-discovery-call.md` — the sponsor-meeting structure: agenda contract, situation→problem→impact, bridge questions, Five Minute Drill
- `references/06-storybrand-messaging.md` — StoryBrand SB7: the sponsor as hero, the one-liner, clarity over cleverness
- `references/07-start-with-why.md` — Sinek's golden circle: why-first framing and belief-fit as a sponsor filter
- `references/start-with-why-sinek-transcript.txt` — the full transcript of Sinek's "Start With Why" talk, shipped as a primary source; read it directly when exact wording or a full example arc is needed

## How to route

- User is starting fresh, or asks anything shaped like "help us get sponsors" → Phase 0, then Phase 1.
- User already has a packet, deck, or proposal and wants it fixed or judged → Phase 0 (the critique lives there), then Phase 1, then offer Path A.
- User asks directly for outreach emails or a meeting script but has no defined offer → tell them plainly that the emails and script can only be as good as the offer they carry, run Phase 1 first (compressed if stakes are low), then the path they asked for.
- User has a defined offer already (they can state sponsor profile, assets, price, and why it beats alternatives) → go straight to the path they want; skim their offer against Phase 1's acceptance bar first, flag gaps, but respect their call on whether to fix them.

After the offer file is delivered, offer the three paths by name in one short block ("Path A: the packet. Path B: the cold email chain. Path C: the meeting script."), let the user pick any, all, or none, and run each chosen path as its own checkpoint. Do not start a path unasked.

## Companion skills

When these are installed alongside this skill (they ship in the same pack), use them; if one is missing, the reference files carry enough to proceed without it.

- **Path B (cold email chain):** load `estack-cold-message-writer` (first-touch psychology, hooks, ghost sequences) and `estack-email-writer` (subject lines, body craft, sounding human). This skill's Path B owns what's sponsorship-specific: which offer elements go in which email, and the sequence's psychology; those two own the message craft.
- **Path C (meeting script):** load `estack-chris-voss` for the negotiation layer (labels, calibrated questions, accusation audit) inside the discovery and close.

## Output conventions

- The core offer is always delivered as a Markdown file (default `sponsorship-offer.md` in the working directory, or where the user asks). The paths write their own files next to it (`sponsorship-packet.md`, `sponsor-email-chain.md`, `sponsor-meeting-script.md`). Chat carries the delta and the decisions, not the full document.
- Every document keeps the user's brand rules if they state any (casing, banned punctuation, voice). Ask once at the start of Phase 1 whether any exist.
- Every claim in every deliverable must be either true from the user's answers or explicitly marked `[assumption — verify]`. Never invent audience numbers, reach stats, or past-sponsor names.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-sponsorship-offer-builder: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-sponsorship-offer-builder: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
