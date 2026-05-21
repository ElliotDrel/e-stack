# Prompt Builder: Examples of Good Prompts

These are real prompts from the article this skill is based on. Use them as reference models of what a finished, well-defined prompt sounds like. Each one names the work instead of gesturing at it.

The pattern to notice: the good version is longer, but length is not the point. It is longer because it contains the actual shape of the work, the goal, the context, the sources, the constraints, the quality bar, and the stopping point.

---

## Part 1: Thin ask vs good prompt

The thin version returns the average of everything on the internet. The good version changes the assignment.

### Marketing plan

Thin ask:

> a marketing plan

Good prompt:

> a launch plan for a technical audience that already understands the category, is skeptical of vendor claims, and needs to see implementation details before believing the product

Why it works: it names the audience, what that audience already believes, and what would make the output unusable to them. The thin version gets the average marketing plan; this one gets a plan for these readers.

### Resume feedback

Thin ask:

> feedback on my resume

Good prompt:

> review this resume for a senior operator moving into AI-native product roles. Focus on whether the evidence shows judgment, shipped work, and ability to use AI in real workflows rather than generic AI enthusiasm

Why it works: it sets the goal (a specific role transition) and the quality bar (judgment, shipped work, real-workflow AI use, not enthusiasm). It turns a vague request into a real evaluation with criteria.

### Transcript summary

Thin ask:

> summarize this transcript

Good prompt:

> turn this transcript into attendance-replacement notes for a team that needs decisions, owners, open questions, and next steps. Ignore small talk and flag uncertain attribution

Why it works: it names the goal (attendance-replacement notes), the definition of done (decisions, owners, open questions, next steps), and the edges of the flashlight (ignore small talk, flag uncertain attribution). The thin version gets a chronological recap nobody asked for.

### The same shift, at the field level

For the Goal field specifically, the article contrasts:

Bad:

> Help me with this deck.

Better:

> Help me turn this rough strategy deck into a board-ready discussion document that supports a decision about whether to fund the pilot.

The better version states the outcome, not the activity. A board discussion document is a different thing from a sales deck or a brainstorm, and naming it tells the agent what job it is doing.

---

## Part 2: Full briefs

These are complete prompts that name every field. They are the target output of this skill.

### Research brief for an article

> I want to develop a substantive Substack piece for learners and builders. The working angle is that working with AI agents makes you a better communicator. The reader problem is that people get mediocre AI output and think they need prompt tricks, when the deeper issue is that they have not defined the work. Do not draft yet. Check the archive so we do not repeat earlier pieces. Avoid generic prompt-engineering advice. Produce a research brief, thesis, outline, examples, and a practical template.

Why it works, field by field:
- **Goal / kind of work:** a substantive Substack piece, plus a working angle to hold.
- **Context:** who it is for (learners and builders) and the reader problem the piece must solve.
- **Sources:** check the archive so earlier pieces are not repeated.
- **Constraints:** do not draft yet; avoid generic prompt-engineering advice; closed lanes named.
- **Definition of done:** a research brief, thesis, outline, examples, and a practical template.
- It even names when not to act yet, which stops the agent racing to a draft before the argument is clear.

### Board-ready discussion document

> I need help turning this rough strategy deck into a board-ready discussion document. The audience is deciding whether to fund the pilot. Use the attached financial model, meeting notes, and current operating plan. Do not invent numbers or change the company voice. The quality bar is clear, plain business English with every claim tied to a source. Return a revised outline first, then stop for review.

Why it works, field by field:
- **Goal:** a board-ready discussion document, not a deck.
- **Context:** the audience is making a fund-or-kill decision on the pilot.
- **Sources:** the financial model, meeting notes, and operating plan, named explicitly.
- **Constraints:** do not invent numbers; do not change the company voice.
- **Quality bar:** clear, plain business English with every claim tied to a source.
- **Definition of done:** a revised outline first, then a hard stop for review.

### Meeting prep brief

> I have a 30-minute meeting with a potential partner tomorrow. The goal is to decide whether there is enough overlap to schedule a deeper technical session. Use the attached notes and their website. Give me a one-page prep brief with their likely priorities, three questions I should ask, two risks to watch for, and a suggested opening framing. Do not draft a sales pitch. I want to understand fit, not force a deal.

Why it works, field by field:
- **Goal:** decide whether there is enough overlap for a deeper technical session.
- **Context:** a 30-minute meeting with a potential partner, tomorrow.
- **Sources:** the attached notes and the partner's website.
- **Constraints:** do not draft a sales pitch; the aim is fit, not closing a deal.
- **Quality bar / definition of done:** a one-page prep brief with their likely priorities, three questions, two risks, and a suggested opening framing.

The article's note on this one: a better AI request is also a better request to a chief of staff. The same brief that produces good agent output produces a good human handoff.

---

## The takeaway

Across all of these, the good prompt is not a clever phrasing trick. It is the work made legible: the goal stated as an outcome, the context that changes the answer, the sources named, the constraints drawn, the quality bar shown, and the stopping point set. Build toward that shape.
