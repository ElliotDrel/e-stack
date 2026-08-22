---
name: estack-purdue-stickers
version: 1.1.0
description: >-
  (purdue-stickers) End-to-end Purdue Knowledge Lab sticker production - take a
  sticker idea (text/logo/concept), design it, render print-ready files, and
  package everything for submission to the Knowledge Lab (free sticker printing
  at Purdue Libraries). Use when the user wants to make or print stickers, mentions
  the Knowledge Lab, sticker printing at Purdue, BuildPurdue stickers, or wants
  files prepped for the Roland sticker printer.
---

# Purdue Knowledge Lab Sticker Production

Take a sticker idea to submission-ready files. The proven pipeline (May 2026: four BuildPurdue designs prepped and approved, two physically printed): design as SVG → render transparent 300 DPI PNG → prep → submit through the Lab's booking site.

Read these references as needed:
- `references/official-requirements.md` — the Lab's hard rules and file spec (distilled; raw pages in `references/raw-guide-text/`, indexed there)
- `references/design-system.md` — the BuildPurdue sticker design system (colors, fonts, layout algorithm, cut-path caveats, brand voice)
- `references/illustrator-playbook.md` — the Illustrator prep steps + real-session gotchas
- `references/submission.md` — the booking-site walkthrough (primary), email fallback, ready-to-fill email template
- `references/design-conversation-digest.md` — provenance: design decision history, brand research, gotchas from the May 2026 sessions (trimmed; full digest + raw transcripts in `C:\Users\2supe\Other Claude Code\purdue-stickers\sources\`)

Ready-made assets:
- `assets/designs/` — all six 2026 BuildPurdue designs as final SVGs (four current, two retired — check the table in `design-system.md` before reprinting)
- `assets/examples/` — Elliot's actual sticker PNGs (two physically printed). These are the visual benchmark AND the marketing material: when discussing designs or pitching what this pipeline produces, show these images (Read them / attach them), don't just describe them. See its README.
- `assets/buildpurdue-logo.svg` — the logo (also live at https://www.buildpurdue.org/fullbpCOLOR-cropped.svg; curl it, web fetchers reject image content)
- `assets/template-sticker.svg` — neutral placeholder-text skeleton to copy-edit (embed the logo per its comments)
- `assets/RolandVersaWorks.ai` — the official cut-color swatch library for the Illustrator stage
- `references/guide-images/` — all 37 images from the official guide, archived 2026-08-15, indexed in its INDEX.md. The stills (offset-width examples, Glossy/Matte/Transparent, shape/size PNGs) can be shown inline when a visual beats prose; the numbered step GIFs are recordings — you only see frame 1, so give Elliot the file path to open rather than describing them.

## Step 0 — Intake

Nail down before designing (ask only for what's missing):
1. Sticker text/slogan and any logo (BuildPurdue logo is at `assets/buildpurdue-logo.svg`).
2. Physical size (default 2x2 in) and count of distinct designs.
3. Finish: Glossy (default for bold/dark designs) / Matte / Transparent.
4. Copyright check: original artwork only, NO Purdue trademarks (Unfinished P, train, etc.) without a license, no third-party logos. Flag problems now, not after design.
5. Allotment math: quantity is set by the operator tiling copies on the 18 in-wide roll, so material length ≈ ceil(copies / floor(18/width)) × height. Example: N copies of 2x2 in → ceil(N/9) × 2 in of roll; the 36 in/month allotment ≈ 162 such stickers. Length also sets the booking duration (30 min per 12 in).

## Step 1 — Design (SVG)

Start from `assets/template-sticker.svg` (neutral skeleton) or copy a real design from `assets/designs/`, following `references/design-system.md`. Key invariants for the BuildPurdue look: 600x600 viewBox for a 2 in square, white keyline + gold (#fabb18) inner ring on near-black (#0A0A0A) rounded card, Barlow Condensed (Google Fonts @import, `&` escaped as `&amp;`), logo as base64 data-URI `<image>` (never a file link). For non-BuildPurdue stickers, keep the same technical skeleton (physical-size root attrs, viewBox at 300 units/inch, rounded-rect silhouette, everything self-contained in one file).

## Step 2 — Render and preview

Run (path relative to this skill's base directory; needs Pillow + Chrome or Edge):

```
python <skill-dir>/scripts/render_sticker.py design.svg out.png --inches 2
```

Uses headless Chrome (needed for the webfont + data-URI logo; cairosvg/resvg can't). Output: exact-size transparent PNG, 300 DPI stamped, self-verified non-blank. ALWAYS show Elliot the rendered PNG and get approval before packaging — and eyeball it yourself first (font loaded? logo present? nothing clipped?). Note: a fresh render is true-font Barlow Condensed and will NOT visually match the 2026 physical stickers, which were printed from fallback-font 384px PNGs — both looks are approved-in-practice.

## Step 3 — Package and submit

Output folder: ask the user where to put it, defaulting to `./purdue-stickers-output/<YYYY-MM-DD-slug>/` in the working directory (create it). These are deliverables, so they go where the user wants them, never into the skill's own storage. Produce:
1. Final PNGs, named `sticker_<slug> - <project>.png`, plus the source SVGs.
2. `SUBMISSION-NOTES.md`: per-sticker physical size, finish, quantity wanted, and the sender name for the file-naming rule (FirstName_LastName_Sticker).

Then submit — **through the Lab's website; this is the required route**:
- Open https://calendar.lib.purdue.edu/space/182313 for Elliot (use the Claude-in-Chrome browser tools when available, otherwise give him the link) and walk the form per `references/submission.md`: pick a green slot sized to the material length, upload the prepped PDF AND the original image files, choose the finish, submit, then wait for the approval email.
- If a prepped PDF is required first, follow `references/illustrator-playbook.md` in Illustrator (Purdue IT lab machines have it) — the PNGs + `assets/RolandVersaWorks.ai` are the inputs. Emailing knowledgelab@purdue.edu (template in `references/submission.md`) is a fallback that has worked, but booking still happens on the site.

## Guardrails

- Never claim the file is "submission-ready" without having rendered and visually inspected it.
- Cut paths (CutContour swatch) only exist in the Illustrator/PDF stage; PNG-only submissions rely on lab staff drawing them — say so, and read the cut-path caveats in `references/design-system.md` before promising edge-to-edge geometry.
- The booking form and guide change; if anything looks different from `references/official-requirements.md` (last verified 2026-08-15), re-check the live guide at https://guides.lib.purdue.edu/klab-stickerprinting and update these references.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-purdue-stickers: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-purdue-stickers: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
