# How to add a reference file to the knowledge vault

<primary_outcome>
A new file in `references/` that contains live-fetched, properly cited source material — plus every placeholder link and "Real-world case" block in the skill that points to it has been updated to use the verified content from that file. After this task is complete, the user can ask the coach about that source mid-session and get a grounded answer with a real URL.
</primary_outcome>

This file is the playbook for populating the knowledge vault. The user triggers it by saying something like *"I want to add a reference source"* or *"Let's build the reference for [author/work]."* When that happens, load this file and follow it step by step.

---

## Hard rules (apply throughout — never violated)

1. **Live-fetch every fact.** Use `WebSearch`, `WebFetch`, or `mcp__claude_ai_Supadata__supadata_transcript` (for YouTube, Instagram, TikTok, and all other social media) every single session you build a reference. Never recall content from training memory and present it as sourced. This rule comes from the user's global CLAUDE.md and is not negotiable.
2. **Cite real URLs only.** Every reference file ends with a Sources section that contains URLs fetched this session. A name without a URL is a fabricated citation — do not write one.
3. **Do not paraphrase quotes.** If you put text in quote marks, it must be a verbatim extract from the fetched source. Otherwise drop the quotes and frame as synthesis.
4. **Note the fetch date.** Every reference file's frontmatter records the date the material was fetched. Source content drifts; the fetch date is how the user knows how fresh the snapshot is.
5. **If you can't fetch it, say so.** Books that aren't online verbatim, paywalled articles, deleted videos — these can't be sourced live. Tell the user, and propose pulling from interviews / talks / podcast appearances by the same author that *are* accessible OR ask the user to provide the source. Do not fabricate to fill the gap.

---

## Workflow (six steps — run in order)

### Step 1 — Confirm scope with the user (ask 1–3 questions, then stop)

Before fetching anything, get explicit on:

1. **Which source?** Specific book, article, talk, video, podcast episode — with title and author.
2. **Which type of reference?**
   - **Extraction** — verbatim quotes/passages organized for retrieval (best for talks, interviews, articles, video transcripts)
   - **Synthesis** — organized key takeaways drawn from longer material (best for books, multi-source bodies of work)
3. **Which phases / placeholders should this reference feed?** (Optional but helpful — narrows the synthesis.) For example: *"This Grove reference should feed the Phase 2 TRM case placeholder and the Phase 5 midpoint-review placeholder."*

Stop and wait for the answers. Do not start fetching yet.

### Step 2 — Live-fetch the source material

Pick the right tool for the source type:

| Source type | Tool | Notes |
|---|---|---|
| YouTube video / talk | `mcp__claude_ai_Supadata__supadata_transcript` | Returns the full transcript. Capture the URL and the video ID. |
| Article on a public site | `WebFetch` or `mcp__claude_ai_Supadata__supadata_scrape` | Fetch the page and pull the prose. |
| Web search to locate authoritative sources | `WebSearch` | Use when the user names a concept but not a specific URL. |
| Podcast episode | Check if the podcast has a transcript page; fetch that with `WebFetch`. Otherwise look for show notes / quoted passages from secondary coverage. | Note: audio-only without transcript ≠ fetchable. |
| Book | Look for: official author talks on the book's themes, interviews with the author, publisher excerpts, the author's own essays summarizing the book. Cite each fetched piece. | Do not fabricate page numbers or "quotes from the book" without a verifiable source. |

If the first fetch is thin, do additional fetches. A good reference file synthesizes 2–4 sources, not 1.

### Step 3 — Decide the type and pick the template

Pick **extraction** or **synthesis** based on what you fetched and what the user asked for. Both templates are below — use the matching one.

If the source is a single article or talk → extraction.
If the source is a book or a body of work → synthesis.
If both apply (e.g., a book with multiple author talks) → synthesis as the primary structure, with key extractions embedded.

### Step 4 — Create the reference file

**Location:** `~/.claude/skills/estack-leadership-coach/references/<filename>.md`

**Filename convention:** `<author-lastname>_<work-shortname>.md` — lowercase, hyphens not underscores within name parts, single underscore between author and work. Examples already in the skill:

- `grove_high-output-management.md`
- `hormozi-leila_4-stages.md`
- `oncken-wass_monkeys-hbr-1974.md`

Match the existing filenames exactly when you're populating a placeholder — the link path in the placeholder is the contract.

Create the file using the appropriate template from the **Templates** section below.

### Step 5 — Wire it up across the skill

A new reference file is only useful if the existing placeholders find it. After creating the file, do a complete sweep:

1. **Search every phase file** for the filename you just created. Each match is either:
   - A "Going deeper" link block at the bottom of the phase → no change needed, the link already points correctly
   - A "Real-world case" placeholder pointing to this reference → **replace the placeholder block with verified case material from the new reference file**
2. **Search `SKILL.md`** for any inline mention of the author / work that the new reference covers. If a paraphrased claim or quote in `SKILL.md` is now backed by your verified source, update it to match the source's actual wording. If it doesn't match, hedge it or remove it — do not bend the source to fit the existing prose.
3. **Search flow files** (`flows/pre-delegation.md`, `flows/post-mortem.md`). Less common, but check.

For each "Real-world case" placeholder you replace:

- Pull 1–2 paragraphs from the reference file's body — verbatim where you can, synthesized where you must
- Keep the section header as `## Real-world case: <descriptive title>` (drop the `(placeholder — fill in during reference build)` marker)
- Include the source URL inline or as a footnote: *"From Grove, *High Output Management*, p. 142 — see [reference](../../../references/grove_high-output-management.md)"*
- Do **not** add invented specifics. If the reference has no verbatim case with the dialogue/metrics that would make the section pop, write a short principle illustration grounded in what *is* in the reference, and accept that it's less dramatic than the placeholder hoped for.

### Step 6 — Verify (acceptance self-audit)

Before declaring done, confirm:

- [ ] Reference file exists at the expected path with the expected filename
- [ ] Frontmatter includes `name`, `author`, `work`, `type` (extraction/synthesis), `last_fetched` date, and `sources` (URLs)
- [ ] Every fact, quote, and statistic in the file is traceable to a URL in the Sources section
- [ ] Every "Real-world case" placeholder that points to this reference has been replaced with verified content OR explicitly left as a placeholder with a note explaining why (e.g., "verified content available but not yet drafted")
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
last_fetched: <YYYY-MM-DD>
sources:
  - <URL 1>
  - <URL 2>
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

(Pull 5–15 strong extractions. Each one is verbatim. Each one cites where in the source it came from.)

## Notable cases / illustrations from the source

<If the source contains specific case material — a story the author tells, a study they cite, a scenario they walk through — extract it here. Each one is faithful to the source.>

### <Case 1 title>

<Faithful retelling, with direct quotes where possible. Cite the location in the source.>

## Where this is used in the skill

- `phases/<file>.md` — <which placeholder / "Going deeper" block uses this>
- `SKILL.md` — <if applicable>

## Sources (live-fetched on <YYYY-MM-DD>)

- [<Title of source>](<URL>)
- [<Title of source>](<URL>)
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
last_fetched: <YYYY-MM-DD>
sources:
  - <URL 1>
  - <URL 2>
  - <URL 3>
---

# <Author> — *<Work title>*

## Overview

<2–3 sentence framing.>

## Why this is in the vault

<1 paragraph: which phases / coaching moves draw on this work.>

## Synthesis — core principles

### Principle 1: <name>

<2–3 paragraph synthesis of the principle, drawn from the fetched sources. Use direct quotes where the source language is sharp; paraphrase where you're integrating across sources. Every claim should be defensible against the Sources section below.>

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

## Sources (live-fetched on <YYYY-MM-DD>)

- [<Title>](<URL>)
- [<Title>](<URL>)

## Known gaps

<Optional. If the user might later want to deepen this reference: name the gap. Example: "Did not fetch the original *High Output Management* text — only Grove talks and secondary summaries. Future pass could add direct chapter excerpts if obtainable.">
```

---

## Cross-reference map (where to look when wiring up)

For convenience, here's where each existing reference filename is mentioned in the skill body. When you build a new reference, update *all* the locations that point to it.

| Reference file | Mentioned in |
|---|---|
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

If you add a reference not on this list, append it to this map after you finish the wire-up so future passes have an accurate index.

---

## Pre-empted shortcuts

- **Don't research from memory and dress it up as sourced.** Every claim needs a URL fetched this session.
- **Don't fabricate page numbers, timestamps, or quote locations.** If you don't know where the quote came from, omit the location citation.
- **Don't write a "Notable case" with invented dialogue.** If the source contains the case, extract it. If it doesn't, leave the section empty or skip it.
- **Don't skip the cross-reference sweep.** A reference file that exists but isn't wired up adds zero value to coaching.
- **Don't bend the source to fit existing skill prose.** If the inline content in a phase file disagrees with what the source actually says, fix the phase file — not the reference.
- **Don't build references the user didn't ask for.** This task is triggered by the user. Don't preemptively add references to "round out the vault" — that's how scope creep starts.

---

## When the user says "add a reference source"

1. Ask the Step 1 questions. Stop and wait.
2. Once the user answers, fetch the source material (Step 2).
3. Confirm with the user: *"I fetched [N] sources for [author/work]. Building as a [extraction / synthesis]. Going to populate [N] placeholders in [phase files]. Sound right?"*
4. Build the reference file (Step 4).
5. Sweep and wire up (Step 5).
6. Run the acceptance audit (Step 6).
7. Report back with what changed and any gaps.
