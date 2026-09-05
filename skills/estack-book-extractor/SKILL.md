---
name: estack-book-extractor
version: 1.0.1
description: >-
  (book-extractor) Turn a book or reference document (PDF, EPUB, DOCX, HTML,
  TXT/MD) into an on-demand skill with per-chapter reference files. Use when
  asked to make a skill out of a book or document. Plain PDF-to-text is
  estack-pdf-to-md.
---

Convert a book (or any doc set worth re-reading many times) into a standalone Agent Skill: a `SKILL.md` index plus per-chapter reference files, installed at the root of the skills directory — **not** namespaced under `estack-`, because the skill this produces belongs to the user's own reference library, not to the e-stack pack. Methodology adapted from [virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill): extract once with a deterministic script, synthesize once with the agent, then load only the relevant chapter on future asks instead of re-reading the source every session.

## When to reach for this vs. estack-pdf-to-md

- **estack-pdf-to-md**: "get me the text/markdown of this PDF" — one file in, one file out, done.
- **estack-book-extractor** (this skill): "I want to be able to ask about this book/framework again next month without re-uploading it" — produces a structured, indexed, on-demand-loadable skill.

## Step 0 — Scope check

Confirm the input: one or more file paths, or a folder/glob of source documents. Supported formats: `.pdf .epub .docx .txt .md .rst .adoc .html .htm .rtf`. If the user names an unsupported format (`.mobi`, `.azw`, `.azw3`), tell them to convert it first with Calibre (`ebook-convert in.azw3 out.epub`) and rerun.

If the input is a scanned/image-only PDF, `extract_text.py` will detect it and tell the user to OCR first (`ocrmypdf in.pdf out.pdf`) — don't attempt this step for them silently, since OCR quality varies and they should eyeball the result.

## Step 1 — Extract text (deterministic, run the script)

```bash
python "$HOME/.claude/skills/estack-book-extractor/scripts/extract_text.py" <path1> [path2 ...] --out <scratch_dir>
```

Use a scratch directory (e.g. the session scratchpad) for `--out`, not the final skill location — this is intermediate output. The script installs no dependencies automatically; if it exits with `Missing dependency for .X: pip install Y`, run that `pip install` and retry.

This produces `full_text.txt` (all sources concatenated, each marked with `<!-- source: filename -->`) and `metadata.json` (word/char/estimated-token counts per source). Read `metadata.json`, not the full text file, to get the size.

## Step 2 — Pre-flight estimate, then confirm

Before generating anything, tell the user:
- Total estimated tokens (from `metadata.json`)
- Roughly how many chapter files this will produce (see Step 4)
- That this is a multi-step synthesis job, not instant

Wait for a go-ahead before continuing. This is the same gate the source project uses — synthesis is the expensive part, not extraction.

## Step 2.5 — Large-source handling (>50k estimated tokens)

Do not read all of `full_text.txt` into context at once. Instead:

```bash
wc -l < full_text.txt                          # total line count
grep -n '^# \|^Chapter [0-9]' full_text.txt     # locate chapter/section headings
sed -n '120,340p' full_text.txt                 # read just one chapter's line range
```

Locate chapter boundaries via `grep -n`, then pull each chapter's text with `sed -n '<start>,<end>p'` one at a time while writing that chapter's summary file. This keeps any single source book from blowing the context budget regardless of length.

## Step 3 — Skim for structure

Read (or `sed -n` slice) roughly the first 8,000 characters of `full_text.txt` to identify: title, author, chapter/section list, and 2-3 recurring themes. If the user only wants a structural report (not a full skill), stop here and give them that report — don't generate files they didn't ask for.

## Step 4 — Ask the user two things

1. **Purpose**: apply the frameworks in real work / think in the book's mental models / look up specific chapters on demand / all of the above. This sets the depth (see Step 6).
2. **Skill name**: propose `<author-lastname>-<concept>` (e.g. `cialdini-influence`) or a title-derived slug; let the user override.

## Step 5 — Pick the output location

Default target: `~/.agents/skills/<slug>/` (the same root e-stack itself installs into, which every agent — Claude Code, Codex, others — reads from). If `~/.agents/skills/` doesn't exist on this machine, fall back to `~/.claude/skills/<slug>/`.

**This folder does NOT get the `estack-` prefix and is NOT added to this repo.** It is a standalone skill living in the user's personal skill collection, generated content specific to one book — it has nothing to do with the e-stack pack's own skills, docs, versioning, or publish flow. Never run `manage-e-stack`'s add/edit/publish steps against it.

```bash
mkdir -p "<target>/<slug>/chapters"
```

## Step 6 — Write per-chapter files (LLM synthesis — the core of this skill)

For each chapter/section identified in Step 3, write `<target>/<slug>/chapters/ch<NN>-<slug>.md` using this template:

```markdown
# Chapter N: <Full Title>

## Core Idea
<1-3 sentences — the chapter's central claim>

## Frameworks Introduced
- **<Framework Name>**: <exact formulation as the author states it> — when to use it, how it works

## Key Concepts
<terms and their precise definitions from the text>

## Mental Models
<durable ways of thinking the chapter teaches>

## Anti-patterns
<what the author explicitly warns against>

## Key Takeaways
<3-6 bullets>

## Connects To
<other chapters/concepts in this book this one builds on or feeds into>
```

Add `## Worked Example` if the user's Step 4 answer was "study" depth — a walked-through application of the chapter's main framework, not present at reference depth. Add `## Code Examples` / `## Reference Tables` only for technical source material with actual code or tabular data to preserve.

**Quality rules — the whole point of this skill depends on these:**
1. Extract structure, not summaries. A summary loses the framework; extracting the framework's exact shape preserves it.
2. Preserve the author's precision. "The 5 Whys" is not "ask why multiple times" — keep the technique's actual name and steps.
3. Never copy raw book text verbatim into these files — always synthesize in your own words. This keeps output non-infringing and forces genuine understanding over transcription.
4. Budget roughly 800–1,500 tokens per chapter at reference depth, 1,500–3,000 at study depth. Longer isn't better — the goal is fast, targeted loading, not a second copy of the book.

## Step 7 — Write the cross-chapter files

`<target>/<slug>/glossary.md` — terms with one-line definitions and a link back to the chapter that introduces them.

`<target>/<slug>/patterns.md` — recurring frameworks that show up across multiple chapters, described once instead of duplicated per-chapter.

`<target>/<slug>/cheatsheet.md` — **decision rules, not a glossary.** Every entry should read like "When X, do Y, because Z," or a trade-off table, or a numeric threshold/default. This is the file someone opens mid-task to make a call fast — prose explanations belong in the chapter files, not here.

## Step 8 — Write the master SKILL.md

`<target>/<slug>/SKILL.md`, kept under ~4,000 tokens and front-loaded (compaction truncates from the end, so put the most load-bearing content first):

```markdown
---
name: <slug>
description: Reference skill for "<Book Title>" by <Author>. Use when applying <topic> frameworks, thinking through <topic> decisions, or looking up specific concepts from the book.
---

## How to Use This Skill
<one paragraph: load a chapter file on demand rather than reading everything>

## Core Frameworks & Mental Models
<~2,000 tokens: the handful of frameworks worth having loaded by default, without opening a chapter file>

## Chapter Index
| # | Title | File | Covers |
|---|---|---|---|

## Topic Index
<alphabetical term -> chapter file>

## Supporting Files
- `chapters/` — per-chapter detail
- `glossary.md`
- `patterns.md`
- `cheatsheet.md`

## Scope & Limits
<what this skill does not cover, so future sessions don't over-trust it>
```

This generated `SKILL.md` has plain frontmatter (`name`, `description` only) — it does NOT follow e-stack's `estack-` naming/versioning conventions, because it isn't part of e-stack.

## Step 9 — Advisory security scan

```bash
python "$HOME/.claude/skills/estack-book-extractor/scripts/scan_skill.py" "<target>/<slug>"
```

This flags hidden/zero-width characters and instruction-like phrases that might have leaked from a compromised source document into the synthesized output. It's advisory — review any findings before reporting success, but don't block on false positives (a chapter that legitimately discusses prompt injection will trip the phrase check).

## Step 10 — Report and clean up

Delete the scratch extraction directory from Step 1 (`full_text.txt`, `metadata.json` — their content now lives in the chapter files). Report to the user:
- Where the skill was installed
- Chapter count and rough total size
- One example of how to invoke it going forward (e.g. "next session, just ask about `<topic>` and this loads automatically" — or `/<slug>` if their agent supports slash-invoking skills by name)

## Updating an existing book-skill

If the user wants to fold new material into a skill this process already produced (a second book by the same author, an updated edition, extra chapters), re-run Steps 1-3 on the new source, then edit only the affected chapter files / append new ones, and refresh `SKILL.md`'s Chapter Index, `glossary.md`, and `cheatsheet.md` accordingly — don't regenerate the whole skill from scratch.

## Publishing a generated book-skill (optional, only if asked)

If the user wants to share the generated skill via GitHub, that's a decision entirely on them — offer `gh repo create` **private by default**. Only make it public if the user explicitly says the single word "public" in response to being asked, and only after confirming they hold rights to publish content derived from the source book (this matters most for still-in-copyright, non-public-domain works). This is unrelated to e-stack's own publish flow — never route this through `manage-e-stack`.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-book-extractor: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-book-extractor: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
