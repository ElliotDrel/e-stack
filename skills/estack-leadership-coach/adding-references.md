# How to add a reference file to the knowledge vault

<primary_outcome>
A new file in `references/` that contains properly attributed source material and the minimal,
source-faithful extracts or summaries needed for the coach to use it. The file records whether its
evidence was fetched from the web or supplied locally, so the user can ask about the source
mid-session and get a grounded answer with accurate provenance.
</primary_outcome>

This file is the playbook for populating the knowledge vault. The user triggers it by saying something like *"I want to add a reference source"* or *"Let's build the reference for [author/work]."* When that happens, load this file and follow it step by step.

---

## Hard rules (apply throughout — never violated)

1. **Ground every factual claim in evidence actually inspected.** For current or external web claims, use `WebSearch`, `WebFetch`, or `mcp__claude_ai_Supadata__supadata_transcript` (for YouTube, Instagram, TikTok, and other social media). A user-supplied book, document, or local file is valid evidence too. Never present recalled training material as sourced.
2. **Cite the evidence accurately.** Cite fetched web material with its real URL. Cite supplied local material with the title, edition or version, filename, and page or section when available; label it supplied. Never invent a URL, page number, timestamp, or source location.
3. **Quote carefully; synthesize normally.** Text in quotation marks must be a short, verbatim extract from an available source and must preserve its meaning. Paraphrase and synthesis are appropriate when attributed to their supporting source; do not disguise them as quotations or reproduce copyrighted passages at length.
4. **Record provenance and timing.** Use `last_fetched` for live web sources. For supplied material, record `source_version`, `supplied_on`, or the edition/date available from the source. Do not imply a local source was fetched from the web.
5. **Surface real gaps.** If a needed source cannot be fetched and the user has not supplied it, say so. Propose accessible primary material or ask the user to provide the source; do not fabricate to fill the gap.

---

## Workflow (six steps — adapt to the evidence and request)

### Step 1 — Establish the source and intended use

Use the request and any supplied material to establish:

1. **Which source?** Specific book, article, talk, video, podcast episode — with title and author.
2. **Which type of reference?**
   - **Extraction** — verbatim quotes/passages organized for retrieval (best for talks, interviews, articles, video transcripts)
   - **Synthesis** — organized key takeaways drawn from longer material (best for books, multi-source bodies of work)
3. **Which phases / placeholders should this reference feed?** (Optional but helpful — narrows the synthesis.) For example: *"This Grove reference should feed the Phase 2 TRM case placeholder and the Phase 5 midpoint-review placeholder."*
4. **What evidence is available?** A URL or accessible web source, or a supplied book, document, excerpt, or local file.

If those facts are already clear, inspect or fetch the source in the same turn. Ask only the question whose answer would materially change the reference; do not add a separate scope-confirmation turn.

### Step 2 — Inspect the source material

For web sources, pick the right tool for the source type:

| Source type | Tool | Notes |
|---|---|---|
| YouTube video / talk | `mcp__claude_ai_Supadata__supadata_transcript` | Returns the full transcript. Capture the URL and the video ID. |
| Article on a public site | `WebFetch` or `mcp__claude_ai_Supadata__supadata_scrape` | Fetch the page and pull the prose. |
| Web search to locate authoritative sources | `WebSearch` | Use when the user names a concept but not a specific URL. |
| Podcast episode | Check if the podcast has a transcript page; fetch that with `WebFetch`. Otherwise look for show notes / quoted passages from secondary coverage. | Note: audio-only without transcript ≠ fetchable. |
| Book | Look for: official author talks on the book's themes, interviews with the author, publisher excerpts, the author's own essays summarizing the book. Cite each fetched piece. | Do not fabricate page numbers or "quotes from the book" without a verifiable source. |

For user-supplied material, inspect the relevant pages, sections, or excerpts. Record its identity and the specific locations available. Use additional authoritative material only when it fills a real gap in the requested reference; a single primary source can be enough.

### Step 3 — Decide the type and pick the template

Pick **extraction** or **synthesis** based on what you fetched and what the user asked for. Both templates are below — use the matching one.

If the source is a single article or talk → extraction.
If the source is a book or a body of work → synthesis.
If both apply (e.g., a book with multiple author talks) → synthesis as the primary structure, with key extractions embedded.

### Step 4 — Create the reference file

**Location:** `~/.agents/skills/estack-leadership-coach/references/<filename>.md`

**Filename convention:** `<author-lastname>_<work-shortname>.md` — lowercase, hyphens not underscores within name parts, single underscore between author and work. Examples already in the skill:

- `grove_high-output-management.md`
- `hormozi-leila_4-stages.md`
- `oncken-wass_monkeys-hbr-1974.md`

Match the existing filenames exactly when you're populating a placeholder — the link path in the placeholder is the contract.

Create the file using the appropriate template from the **Templates** section below.

### Step 5 — Wire it up across the skill

A new reference is useful when the relevant flow can find it without copying the source vault into
the flow. Search for direct references to the author, work, or filename in `SKILL.md`, phase files,
and flow files. Then make only the updates the evidence supports:

1. Keep or add a concise link where the flow needs the source for deeper detail or attribution.
2. Correct, hedge, or remove an inline claim that the fetched source does not support.
3. Replace a selected placeholder only when the new source contains an example that materially
   improves the coaching. Summarize it in a few sentences and link the reference; do not copy
   paragraphs of source prose into the phase file.

Do not update every matching file merely because a reference was added. The reference file is the
knowledge vault; phase files should retain the decision rule and point to the vault when detail is
needed.

### Step 6 — Verify (acceptance self-audit)

Before declaring done, confirm:

- [ ] Reference file exists at the expected path with the expected filename
- [ ] Frontmatter includes `name`, `author`, `work`, `type` (extraction/synthesis), and accurate provenance: `last_fetched` and URLs for web evidence, or source version/supplied date and local citation details for supplied evidence
- [ ] Every fact, quote, and statistic in the file is traceable to the specific source listed in the Sources section
- [ ] Any updated placeholder or inline claim is supported by the new reference, and links to it where helpful
- [ ] Every "Going deeper" link block in phase files that references this file still resolves correctly
- [ ] No hedged or fabricated content has been smuggled in — if the source doesn't say it, the reference file doesn't say it
- [ ] Filename in the file matches the link paths used by placeholders

Report back to the user with: (a) which reference was built, (b) which placeholders / cross-references were updated, (c) any placeholders that were *not* updated and why, (d) any source material the user might want to add later to fill gaps.

---

## Templates

### Template A — Extraction reference

Use for articles, talks, interviews, video transcripts — anything where you can pull verbatim text.

```markdown
---
name: <author-lastname>_<work-shortname>
title: <Full title of the work>
author: <Author name(s)>
work_type: <article | talk | interview | podcast | video transcript>
type: extraction
last_fetched: <YYYY-MM-DD if live-fetched>
supplied_on: <YYYY-MM-DD if supplied by the user>
source_version: <edition, file version, or other local identifier if available>
sources:
  - <URL 1 or supplied title, edition/file, and page/section>
---

# <Author> — *<Work title>*

## Overview

<2–3 sentence framing of what this work covers and why it matters for leadership coaching. No fabrication — only what's actually in the fetched material.>

## Why this is in the vault

<1 paragraph: which phases / coaching moves draw on this work, and what specific principle it backs.>

## Key extractions

> "<Verbatim quote 1>"
> — <Source location: timestamp / paragraph / page number if available>

> "<Verbatim quote 2>"
> — <Source location>

(Include only the short, useful extracts the source supports. Each quotation is verbatim and cites a URL, timestamp, page, or section. Summarize instead where an extract would be long or unavailable.)

## Notable cases / illustrations from the source

<If the source contains specific case material — a story the author tells, a study they cite, a scenario they walk through — extract it here. Each one is faithful to the source.>

### <Case 1 title>

<Faithful summary, with a short direct quote only when it helps. Cite the location in the source.>

## Where this is used in the skill

- `phases/<file>.md` — <which placeholder / "Going deeper" block uses this>
- `SKILL.md` — <if applicable>

## Sources

- Live-fetched <YYYY-MM-DD>: [<Title of source>](<URL>)
- Supplied: <Title, edition or filename, page/section if available>
```

### Template B — Synthesis reference

Use for books, multi-source bodies of work, or any case where you're synthesizing from several fetched pieces.

```markdown
---
name: <author-lastname>_<work-shortname>
title: <Full title of the work or body of work>
author: <Author name(s)>
work_type: <book | body of work>
type: synthesis
last_fetched: <YYYY-MM-DD if live-fetched>
supplied_on: <YYYY-MM-DD if supplied by the user>
source_version: <edition, file version, or other local identifier if available>
sources:
  - <URL or supplied title, edition/file, and page/section>
---

# <Author> — *<Work title>*

## Overview

<2–3 sentence framing.>

## Why this is in the vault

<1 paragraph: which phases / coaching moves draw on this work.>

## Synthesis — core principles

### Principle 1: <name>

<2–3 paragraph synthesis of the principle, drawn from the inspected sources. Use short direct quotes only where the source language is necessary; paraphrase when integrating across sources. Every claim should be defensible against the Sources section below.>

### Principle 2: <name>

<...>

### Principle 3: <name>

<...>

(3–6 principles total. Don't pad.)

## Verbatim extracts (when sources support them)

> "<Quote>"
> — <Source URL or title>

(Include verbatim extracts only where you actually fetched the verbatim text. If you're synthesizing from interview snippets and don't have a clean quote, skip this section.)

## Notable cases / illustrations

<If the fetched sources contain specific cases — a story the author tells in an interview, a case study from a talk — extract them faithfully here. Each one cites where it came from.>

### <Case 1 title>

<Faithful retelling.>

## Where this is used in the skill

- `phases/<file>.md` — <which placeholder uses this>
- `SKILL.md` — <if applicable>

## Sources

- Live-fetched <YYYY-MM-DD>: [<Title>](<URL>)
- Supplied: <Title, edition or filename, page/section if available>

## Known gaps

<Optional. If the user might later want to deepen this reference: name the gap. Example: "Did not fetch the original *High Output Management* text — only Grove talks and secondary summaries. Future pass could add direct chapter excerpts if obtainable.">
```

---

## Cross-reference map (where to look when wiring up)

For convenience, here's where each existing reference filename is mentioned in the skill body. Use it to find locations that may need a link, attribution correction, or a supported example. Update only the locations the new evidence actually improves.

| Reference file | Mentioned in |
|---|---|
| `lencioni_the-motive.md` | `SKILL.md`, `frameworks/motive-check/flow.md`, `frameworks/developing-team/flow.md`, `frameworks/managing-subordinates/flow.md`, `frameworks/difficult-conversations/flow.md`, `frameworks/running-meetings/flow.md`, `frameworks/repetitive-communication/flow.md`, `phases/1-intake.md`, `phases/7-diagnose.md` |
| `grove_high-output-management.md` | `phases/1-intake.md`, `phases/2-trm-assessment.md`, `phases/4-build-brief.md`, `phases/5-monitoring.md`, `phases/7-diagnose.md` |
| `gerber_e-myth-revisited.md` | `phases/1-intake.md`, `phases/7-diagnose.md` |
| `hormozi-leila_4-stages.md` | `phases/2-trm-assessment.md`, `phases/7-diagnose.md` |
| `hormozi-alex_followthrough.md` | `phases/4-build-brief.md`, `phases/7-diagnose.md` |
| `doerr_measure-what-matters.md` | `phases/4-build-brief.md`, `phases/5-monitoring.md`, `phases/7-diagnose.md` (primary); `phases/1-intake.md`, `phases/3-enrollment.md` (secondary) |
| `sullivan_who-not-how.md` | `phases/1-intake.md`, `phases/3-enrollment.md`, `phases/4-build-brief.md`, `phases/7-diagnose.md` |
| `sanchez_main-street-millionaire.md` | `phases/2-trm-assessment.md`, `phases/7-diagnose.md` |
| `ferriss_4hww.md` | `phases/1-intake.md` |
| `oncken-wass_monkeys-hbr-1974.md` | `phases/6-reverse-delegation.md`, `phases/7-diagnose.md` |
| `deci-ryan_self-determination-theory.md` | `phases/3-enrollment.md`, `phases/7-diagnose.md` |
| `gallup_engagement-research.md` | `phases/3-enrollment.md` |
| `van-edwards_cues.md` | `phases/5-monitoring.md` |

If you add a reference not on this list, append it to this map after the targeted wire-up so future passes have an accurate index.

---

## Pre-empted shortcuts

- **Don't research from memory and dress it up as sourced.** Every claim needs traceable inspected evidence; that may be a fetched URL or a clearly identified supplied source.
- **Don't fabricate page numbers, timestamps, or quote locations.** If you don't know where the quote came from, omit the location citation.
- **Don't write a "Notable case" with invented dialogue.** If the source contains the case, extract it. If it doesn't, leave the section empty or skip it.
- **Don't skip the cross-reference sweep.** A reference file that exists but isn't wired up adds zero value to coaching.
- **Don't bend the source to fit existing skill prose.** If the inline content in a phase file disagrees with what the source actually says, fix the phase file — not the reference.
- **Don't build references the user didn't ask for.** This task is triggered by the user. Don't preemptively add references to "round out the vault" — that's how scope creep starts.

---

## When the user says "add a reference source"

1. Establish the Step 1 facts from the request and supplied material; ask only material gaps.
2. Inspect or fetch the source material (Step 2).
3. Build the reference file (Step 4).
4. Sweep and wire up (Step 5).
5. Run the acceptance audit (Step 6).
6. Report back with what changed and any gaps.
