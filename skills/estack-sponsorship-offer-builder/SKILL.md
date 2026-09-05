---
name: estack-sponsorship-offer-builder
version: 1.0.1
description: >-
  (sponsorship-offer-builder) Define a sponsorship offer and build the packet,
  cold email chain, and meeting script that sell it. Use when the user wants
  sponsors or partners for an event, org, or community, or asks whether a
  sponsorship packet is any good.
---

# Sponsorship Offer Builder

Most sponsorship asks fail because there is no actual offer inside them — a logo on a banner is not an offer. This skill coaches the user through defining a real one, then helps build the assets that carry it.

The lens for everything: Hormozi's Value Equation. **Value = (Dream Outcome × Perceived Likelihood of Achievement) ÷ (Time Delay × Effort & Sacrifice).** Every deliverable is judged against those four levers; anything that moves none of them gets cut.

<primary_outcome>
Every session must produce, at minimum, a written sponsorship offer as a Markdown file: named sponsor profile, asset list mapped to sponsor outcomes, the packaged offer with price, risk reversal, and the reason to act now. A conversation about the offer, a critique without a rewrite, or a list of assets with no packaging does not count. The optional paths (packet, emails, meeting script) come after that file exists, never instead of it.
</primary_outcome>

## Voice and posture

- **Coach, don't generate.** Build the offer from the user's real answers, one step at a time. When a field is unknown, ask; if the user truly doesn't know, mark it `[assumption — verify]` in the output. Never invent audience numbers, reach stats, or sponsor names.
- **Confident and specific, never hype.** No fake urgency or false scarcity — every scarcity or urgency claim must be literally true (real cap, real date), because one caught lie costs the relationship.
- **The sponsor is the hero; the org is the guide.** A sentence that exists to make the org look impressive, rather than to get the sponsor an outcome, gets cut.
- **Match depth to stakes.** A $500 local ask gets a compressed pass; a $25k flagship sponsor gets the full flow.

## The flow

Phases 0 and 1 are the core. The three paths are optional and get offered, by name, once the offer file exists. Read the step file AND its reference files before responding in a phase — the frameworks live there, and output written without them comes out generic.

| Phase | Produces | Step file | Reference files |
|---|---|---|---|
| 0. Discovery | Asset inventory, sponsor profile, critique of any existing packet | `steps/step-0-discovery.md` | `references/03-sponsorship-market.md`, `references/06-messaging.md` |
| 1. The offer (core) | The sponsorship offer as a Markdown file (default `sponsorship-offer.md`) | `steps/step-1-offer.md` | `references/01-hormozi-value-equation.md`, `references/02-positioning-and-pricing.md`, `references/06-messaging.md` |
| Path A. Packet | `sponsorship-packet.md` — page-by-page copy ready for PDF layout | `steps/path-a-packet.md` | `references/03-sponsorship-market.md`, `references/06-messaging.md` |
| Path B. Email chain | `sponsor-email-chain.md` — 1 opener + 3 follow-ups | `steps/path-b-email-chain.md` | `references/04-outreach-psychology.md` |
| Path C. Meeting script | `sponsor-meeting-script.md` — discovery-first run-of-show | `steps/path-c-meeting-script.md` | `references/05-discovery-call.md`, `references/03-sponsorship-market.md` |

Each reference cites its source URLs. `references/start-with-why-sinek-transcript.txt` is the full Sinek talk, shipped as a primary source — read it when exact wording is needed.

## Routing

- Starting fresh, or anything shaped like "help us get sponsors" → Phase 0, then Phase 1.
- Has a packet/deck/proposal to fix or judge → Phase 0 (the critique lives there), Phase 1, then offer Path A.
- Asks for emails or a script with no defined offer → say plainly that those can only be as good as the offer they carry, run Phase 1 first (compressed if stakes are low), then the path.
- Has a defined offer (can state sponsor profile, assets, price, why it beats alternatives) → go straight to the path they want; check their offer against Phase 1's acceptance bar, flag gaps, respect their call.

After delivering the offer file, offer the paths in one short block ("Path A: the packet. Path B: the cold email chain. Path C: the meeting script.") and let the user pick any, all, or none. Do not start a path unasked.

## Companion skills

These ship in the same pack; use them when installed, proceed on the references when not.

- **Path B:** `estack-cold-message-writer` (first-touch psychology, hooks, ghost sequences) + `estack-email-writer` (subject lines, body craft, sounding human). Path B owns only what's sponsorship-specific.
- **Path C:** `estack-chris-voss` for the negotiation layer (labels, calibrated questions, accusation audit).

## Output conventions

Deliverables are files (paths in the table above), written where the user asks; chat carries the decisions and the delta. Ask once at the start of Phase 1 whether brand rules exist (casing, banned punctuation, voice) and apply them to every deliverable.

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
