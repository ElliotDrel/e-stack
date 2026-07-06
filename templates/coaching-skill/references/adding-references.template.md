<!--
  TIER 2 — KNOWLEDGE-VAULT PLAYBOOK TEMPLATE
  Use this tier only when a flat sources/ list stops scaling — i.e. you have many
  cited sources that feed inline "Real-world case" / "Going deeper" placeholders
  across multiple framework files.

  Copy to <skill>/adding-references.md and fill the {{PLACEHOLDERS}}. SKILL.md
  should point here ("when the user wants to add a reference, load
  adding-references.md and follow it exactly"). Delete this comment when done.

  If you're on Tier 1 (lightweight sources/), delete this whole references/ folder
  from your skill — you don't need the vault machinery.
-->
# How to add a reference file to the knowledge vault

<primary_outcome>
A new file in `references/` that contains live-fetched, properly cited source
material — plus every placeholder link and "Real-world case" block in the skill
that points to it has been updated to use the verified content. After this task,
the user can ask the coach about that source mid-session and get a grounded answer
with a real URL.
</primary_outcome>

This file is the playbook for populating the knowledge vault. The user triggers it
by saying something like *"I want to add a reference source"* or *"Let's build the
reference for [author/work]."* When that happens, load this file and follow it.

---

## Hard rules (apply throughout — never violated)

1. **Live-fetch every fact.** Use `WebSearch`, `WebFetch`, or a transcript tool every session you build a reference. Never recall content from training memory and present it as sourced. (From the global CLAUDE.md — not negotiable.)
2. **Cite real URLs only.** Every reference file ends with a Sources section of URLs fetched this session. A name without a URL is a fabricated citation.
3. **Do not paraphrase quotes.** Text in quote marks must be a verbatim extract. Otherwise drop the quotes and frame as synthesis.
4. **Note the fetch date.** Frontmatter records the date material was fetched. Source content drifts; the fetch date is how the user knows how fresh the snapshot is.
5. **If you can't fetch it, say so.** Books not online verbatim, paywalled articles, deleted videos — tell the user, propose accessible alternatives (interviews, talks, podcasts by the same author) or ask them to provide the source. Do not fabricate to fill the gap.

---

## Workflow (six steps — run in order)

### Step 1 — Confirm scope with the user (ask 1-3 questions, then stop)

1. **Which source?** Specific book, article, talk, video, podcast — title and author.
2. **Which type of reference?** **Extraction** (verbatim quotes organized for retrieval — best for talks, interviews, articles, transcripts) or **Synthesis** (organized takeaways from longer material — best for books, bodies of work).
3. **Which {{phases / sections / placeholders}} should this reference feed?** (Optional but narrows the synthesis.)

Stop and wait for the answers. Do not start fetching yet.

### Step 2 — Live-fetch the source material

| Source type | Tool | Notes |
|---|---|---|
| Video / talk | transcript tool | Capture the URL and video ID. |
| Article on a public site | `WebFetch` | Pull the prose. |
| Locate authoritative sources | `WebSearch` | When the user names a concept but no URL. |
| Podcast | Fetch the transcript page if one exists; otherwise show notes / quoted passages. | Audio-only without transcript ≠ fetchable. |
| Book | Author talks, interviews, publisher excerpts, the author's own essays. Cite each. | Do not fabricate page numbers or "quotes from the book". |

If the first fetch is thin, do more. A good reference file synthesizes 2-4 sources.

### Step 3 — Decide the type and pick the template

Single article or talk → **extraction**. Book or body of work → **synthesis**.
Both apply → synthesis as primary structure with key extractions embedded.

### Step 4 — Create the reference file

**Location:** `references/<filename>.md`
**Filename convention:** `<author-lastname>_<work-shortname>.md` — lowercase,
hyphens within name parts, single underscore between author and work
(e.g. `grove_high-output-management.md`). Match existing filenames exactly when
populating a placeholder — the link path in the placeholder is the contract.

Use the matching template from the **Templates** section below.

If the reference file runs past ~100 lines, open the body (right after the H1)
with a short `## Contents` list of its section names. Claude previews long files
with partial reads; a table of contents lets it see the full scope and jump to
the right section instead of acting on the first 100 lines.

### Step 5 — Wire it up across the skill

A new reference file is only useful if existing placeholders find it. After
creating it, sweep:

1. **Search every framework/phase file** for the new filename. Each match is either a "Going deeper" link (no change needed) or a "Real-world case" placeholder (**replace it with verified case material from the new reference**).
2. **Search `SKILL.md`** for inline mentions of the author/work. If a paraphrased claim is now backed by your verified source, align it to the source's actual wording. If it doesn't match, hedge or remove it — don't bend the source to fit the prose.

For each "Real-world case" placeholder you replace: pull 1-2 paragraphs from the
reference (verbatim where you can), keep the header `## Real-world case: <title>`
(drop any `(placeholder)` marker), and include the source URL inline. Do not add
invented specifics.

### Step 6 — Verify (acceptance self-audit)

- [ ] Reference file exists at the expected path and filename
- [ ] Frontmatter has `name`, `author`, `work`, `type`, `last_fetched`, `sources`
- [ ] Every fact, quote, and statistic traces to a URL in the Sources section
- [ ] Every "Real-world case" placeholder pointing here is replaced OR left with a note explaining why
- [ ] Every "Going deeper" link to this file still resolves
- [ ] No fabricated content smuggled in — if the source doesn't say it, the file doesn't say it

Report back: (a) which reference was built, (b) which placeholders/cross-refs were
updated, (c) any left un-updated and why, (d) source material to add later to fill gaps.

---

## Templates

### Template A — Extraction reference

Use for articles, talks, interviews, transcripts — anything with verbatim text.

```markdown
---
name: <author-lastname>_<work-shortname>
title: <Full title>
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
<2-3 sentence framing of what this work covers and why it matters for this skill. Only what's in the fetched material.>

## Why this is in the vault
<1 paragraph: which sections / coaching moves draw on this, and what principle it backs.>

## Key extractions
> "<Verbatim quote 1>"
> — <Source location: timestamp / paragraph / page if available>

(Pull 5-15 strong verbatim extractions, each citing where in the source it came from.)

## Notable cases / illustrations from the source
### <Case 1 title>
<Faithful retelling, with direct quotes where possible. Cite the location.>

## Where this is used in the skill
- `<file>.md` — <which placeholder / "Going deeper" block uses this>

## Sources (live-fetched on <YYYY-MM-DD>)
- [<Title>](<URL>)
```

### Template B — Synthesis reference

Use for books, multi-source bodies of work, or synthesizing several fetched pieces.

```markdown
---
name: <author-lastname>_<work-shortname>
title: <Full title or body of work>
author: <Author name(s)>
work_type: <book | body of work>
type: synthesis
last_fetched: <YYYY-MM-DD>
sources:
  - <URL 1>
  - <URL 2>
---

# <Author> — *<Work title>*

## Overview
<2-3 sentence framing.>

## Why this is in the vault
<1 paragraph: which sections / coaching moves draw on this.>

## Synthesis — core principles
### Principle 1: <name>
<2-3 paragraph synthesis from the fetched sources. Quote where the language is sharp; paraphrase where integrating. Every claim defensible against the Sources section.>

(3-6 principles total. Don't pad.)

## Verbatim extracts (when sources support them)
> "<Quote>"
> — <Source URL or title>

## Notable cases / illustrations
### <Case 1 title>
<Faithful retelling.>

## Where this is used in the skill
- `<file>.md` — <which placeholder uses this>

## Sources (live-fetched on <YYYY-MM-DD>)
- [<Title>](<URL>)

## Known gaps
<Optional. Name what wasn't fetched so a future pass can deepen it.>
```

---

## Cross-reference map (where to look when wiring up)

Keep an index of where each reference filename is mentioned in the skill, so a new
reference's wire-up updates every location that points to it. Append to it whenever
you add a reference.

| Reference file | Mentioned in |
|---|---|
| `{{example_reference}}.md` | `{{file-a}}.md`, `{{file-b}}.md` |

---

## Pre-empted shortcuts

- **Don't research from memory and dress it up as sourced.** Every claim needs a URL fetched this session.
- **Don't fabricate page numbers, timestamps, or quote locations.** Omit the citation if you don't know it.
- **Don't write a "Notable case" with invented dialogue.** Extract it if the source has it; skip it if not.
- **Don't skip the cross-reference sweep.** A reference that exists but isn't wired up adds zero value.
- **Don't bend the source to fit existing prose.** Fix the skill file, not the reference.
- **Don't build references the user didn't ask for.** This task is user-triggered. No preemptive vault-rounding.
