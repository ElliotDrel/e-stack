# BuildPurdue Sticker Design System

The recipe behind the six printed/approved 2026 stickers. Full provenance and per-sticker coordinate tables: `design-conversation-digest.md`. Ready-to-use SVGs for all six: `../assets/designs/`.

## Technical skeleton (every sticker)

```xml
<svg width="2in" height="2in" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
```
- 600 units / 2 in = 300 DPI equivalent; 1 unit = 1/300 in. For other sizes keep 300 units per inch.
- Draw order: (1) white die-cut backing `rx=28` full canvas → (2) dark field `#0A0A0A` inset 5, `rx=24` → (3) subtle radial gradient overlay clipped to the same rect → (4) single gold ring `stroke=#fabb18 stroke-width=5 fill=none`.
- The white 5-unit inset ring IS the intended die-cut border. No cut-contour layer lives in the SVG; that happens at the Illustrator/PDF stage (or lab staff add it).

### Cut-path caveats (read before promising edge geometry)

- The white keyline is only 5 units = 0.0167 in ≈ 0.42 mm — at or below the cutter's registration tolerance, so a cut flush to the art edge can nick the gold ring on one side. Expect that, or add margin.
- The art silhouette is a ROUNDED rect (`rx=28` ≈ 0.093 in). If prepping in Illustrator, draw the cut rectangle with matching rounded corners (or apply a 0.05 in offset path); a plain square cut leaves transparent-cornered vinyl. The square-rectangle cut described in the playbook is what lab staff effectively handled in 2026 — the exact Illustrator recipe was never tested by us against these files.

## Colors

- Gold `#fabb18` — MUST match the logo's gold; `#F5A623` was tried and visibly clashed. Always sample the logo, never assume.
- White `#ffffff` at full opacity for body text (low opacities print lighter than they screen; 0.62 is the floor ever shipped).
- Background `#0A0A0A`; gradient centers used across the set: `#161616`, `#181818`, `#191919`, `#1c1c1c` (decorative only, near-invisible in print).

## Type

- Font: Barlow Condensed (SIL OFL), weights 300/400/700/900 across the set, loaded via `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&amp;display=swap')` in `<defs><style>` — the `&` MUST be escaped `&amp;`, and the `wght@...` list must include every weight the file actually uses (a missing weight falls back to synthetic rendering).
- Fallback stack: `'Barlow Condensed','Arial Narrow',Impact,sans-serif`. Note: the 2026 printed PNGs were accidentally rendered in the fallback font and still looked good, so the design survives both.
- Hierarchy: one gold hero word/line, 94–130px, weight 900, letter-spacing −1 to −3; supporting lines white, 42–66px, weight 700 (or 400 for connectors like "in a"), positive letter-spacing (2–14).
- Periods: intentional per design — `ship more.` and `syllabus.` keep theirs, everything else dropped them.

## Layout algorithm (vertical centering)

SVG `<text>` y is the BASELINE. Use: cap height = 0.72 × font-size, descender = 0.20 × font-size.
1. Per line: box top = baseline − 0.72·size, box bottom = baseline + 0.20·size.
2. Constant visual gap between boxes (13/20/26 units were used).
3. Set baselines so (block_top + block_bottom)/2 = 300 (canvas center).
4. Logo floats ~28–30 units below block_bottom, EXCLUDED from centering.
5. Keep everything ≥35 units (≈3 mm) from the cut edge; long hero words overflow — shrink until they fit (ship more. 110→94, shipping 118→110).
6. Known imprecision: letter-spacing adds a trailing space, nudging `text-anchor="middle"` text slightly left; measure real bboxes (headless-browser getBBox) if precision matters.

## Logo

- Source: https://www.buildpurdue.org/fullbpCOLOR-cropped.svg (curl -L it; web fetchers choke on image content). Local copy: `../assets/buildpurdue-logo.svg` (27,682 bytes, viewBox 0 0 375 90, white "build" + gold "purdue", transparent bg, glyphs outlined).
- Embed as base64 data URI in an `<image>` tag: `<image href="data:image/svg+xml;base64,..." x="180" y="..." width="240" height="57" preserveAspectRatio="xMidYMid meet"/>`. Never inline its markup (clipPath coordinate-space + id collisions) and never link a file path (breaks in Illustrator and browsers).
- Standard size 240×57 centered (x=180); left-aligned variant 220×52 with `xMinYMid meet`.

## The six shipped designs

| Slug | Text | Hero | Notes |
|---|---|---|---|
| talk_less_ship_more | talk less / ship more. | ship more. 94px | Hamilton riff; replaced stop_talking |
| build_with_people | build with / people who / get it | get it 130px | Replaced iron_sharpens (Anvil association) |
| stop_building_vacuum | stop building / in a / vacuum | vacuum 126px | |
| connections_syllabus | connections / that don't / show up / on a / syllabus. | syllabus. 96px | Only left-aligned one; keeps gold left bar + rule; opacities 0.75/0.62 |
| stop_talking_start_shipping | stop talking / start / shipping | shipping 110px | Superseded but approved |
| iron_sharpens_iron | iron / sharpens / iron | sharpens 108px | Retired (Anvil is a rival Purdue space) |

Naming: `sticker_<snake_case_slug> - <project>.svg/.png`.

## Brand voice (for new designs)

Lowercase everywhere. Builder/anti-talk culture: shipping over talking, community over solo ("we help people find each other" — approved direction, never built). Dark mode, students as heroes, approachable over polished (Jason Tennenhouse brand direction, Mar 2026). Deferred concepts on file: bee/hexagon/honeycomb rebrand, bell-tower patent drawing. Avoid: anvil references, purely negative framings (team prefers positive flips).
