---
name: estack-sponsorship-offer-builder
version: 1.0.2
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
For a new or undefined offer, produce a written sponsorship offer: named sponsor profile, asset list mapped to sponsor outcomes, the packaged offer with price, risk reversal, and the reason to act now. For a critique, packet, email chain, or meeting script, deliver the artifact the user asked for and use the existing offer as far as it is defined. Flag gaps that materially weaken it without forcing unrelated work first.
</primary_outcome>

## Voice and posture

- **Build from real information.** Use the user's answers and existing materials. Ask for a missing fact only when it would change the offer materially; otherwise make a clearly marked assumption. Never invent audience numbers, reach stats, or sponsor names.
- **Confident and specific, never hype.** No fake urgency or false scarcity — every scarcity or urgency claim must be literally true (real cap, real date), because one caught lie costs the relationship.
- **The sponsor is the hero; the org is the guide.** A sentence that exists to make the org look impressive, rather than to get the sponsor an outcome, gets cut.
- **Match depth to stakes.** A $500 local ask gets a compressed pass; a $25k flagship sponsor gets the full flow.

## The flow

Phases 0 and 1 are the core. The three paths are optional. Consult the phase file and references needed for the requested artifact. Do not load an entire workflow or make the user complete earlier phases when the available context supports the work.

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
- Has a packet/deck/proposal to fix or judge → deliver the Phase 0 critique directly. Use Phase 1 only when the user asks to rebuild the underlying offer, and use Path A only when they ask for replacement packet copy.
- Asks for emails or a script with no defined offer → state the important gaps, gather the minimum offer context needed, then create the requested artifact with assumptions clearly marked. Use a compressed Phase 1 only when it is necessary to make the artifact credible.
- Has a defined offer (can state sponsor profile, assets, price, why it beats alternatives) → go straight to the path they want; check their offer against Phase 1's acceptance bar, flag gaps, respect their call.

After delivering an offer, state the most relevant next artifact when useful. Do not start an additional path unless the user asked for it or already requested the broader package.

## Companion skills

These ship in the same pack; use them when installed, proceed on the references when not.

- **Path B:** `estack-cold-message-writer` (first-touch psychology, hooks, ghost sequences) + `estack-email-writer` (subject lines, body craft, sounding human). Path B owns only what's sponsorship-specific.
- **Path C:** `estack-chris-voss` for the negotiation layer (labels, calibrated questions, accusation audit).

## Output conventions

Write deliverables where the user asks. When no file is requested, provide the usable draft in chat and offer to save it. Apply stated brand rules. Ask about brand rules only when their absence would materially affect the deliverable.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-sponsorship-offer-builder:` and a body. File an
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
