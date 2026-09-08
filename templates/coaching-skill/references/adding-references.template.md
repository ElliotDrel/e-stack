<!--
  KNOWLEDGE-VAULT PLAYBOOK TEMPLATE
  Copy to <skill>/adding-references.md only when that skill maintains a source
  vault. Replace placeholders, adapt the workflow to the skill, and remove this
  comment before publishing.
-->
# Add a Reference

Use this guide when the user asks to add or update a source for this skill. The
goal is a reference that supports the skill's actual claims and is easy to find
when the user asks about its provenance.

## Source integrity

- Retrieve the source or use material the user supplied before making a claim
  presented as sourced. Do not present recalled content as verified evidence.
- Record a source identifier that another reader can locate: a URL, or for a
  supplied document its title, edition, file name, and relevant page or section.
- Use quotation marks only for a short verbatim extract. Paraphrase in your own
  words and identify the supporting source.
- Record whether material was retrieved or supplied and the accurate date. A
  source may be a dated edition, not a current web page.
- State an evidence gap instead of inventing a citation, quote, page number, or
  case detail.

## Build the reference

Start with the user's stated source and intended use. Ask a focused question only
if the source, the claim it should support, or the useful level of detail remains
unclear. Retrieve the relevant material or inspect the supplied file, then decide
whether a short extract, a synthesis, or both will help this skill.

Place the reference in `references/` with a name that fits the skill's existing
conventions. Check the skill for relevant links or placeholders and update only
the ones this source supports. Do not rewrite nearby guidance to force a source
to fit it.

Use a contents list when the reference is long enough that it will help readers
find evidence. Preserve fuller user-supplied material only when the user asks;
otherwise prefer a concise, attributed synthesis.

## Suggested reference shape

```markdown
---
name: <short-identifier>
title: <source title>
author: <author or organization>
type: <extraction | synthesis | mixed>
captured: <retrieved or supplied date>
sources:
  - <URL or supplied-file identifier>
---

# <Source title>

## Why this is here
<What skill guidance or decision this source supports.>

## Evidence and synthesis
<Concise attributed synthesis. Use a short direct quote only when wording matters.>

## Where this is used
- `<skill file>` — <supported guidance or placeholder>

## Source record
- <URL or supplied-file identifier; page, section, timestamp, or other location>

## Known gaps
<Optional: what this reference does not establish.>
```

## Verify

- The reference identifies its evidence accurately.
- Every sourced claim, quote, and statistic has a source identifier and useful
  location.
- Relevant skill links resolve and describe only what the evidence supports.
- The result distinguishes retrieval from user-supplied material and identifies
  any remaining uncertainty.

Report the reference added, the skill guidance changed, and any evidence gap.
