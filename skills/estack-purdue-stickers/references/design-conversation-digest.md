# Design-conversation digest (trimmed)

Provenance for the six BuildPurdue stickers: what was decided and why, from the claude.ai design sessions of 2026-05-03 → 05-05. The mechanical specs live in `design-system.md`; the shipped SVGs in `../assets/designs/` are the authoritative geometry. The FULL digest (per-sticker coordinate tables, verbatim generator scripts, 26-step chronology) plus both raw transcripts and the original conversation JSONs live in `C:\Users\2supe\Other Claude Code\purdue-stickers\sources\conversations\`.

## Pipeline in one paragraph

Logo curled from https://www.buildpurdue.org/fullbpCOLOR-cropped.svg → base64 data URI → sticker SVGs hand-authored (Python f-strings, no layout engine; vertical math from cap-height 0.72x / descender 0.20x heuristics) → previewed via cairosvg at 384×384 (which silently used a fallback font — see gotcha 1) → visually QA'd and iterated. Delivered files: `sticker_<slug> - buildpurdue.svg/.png`, 2x2 in, viewBox 600.

## Design status and why (the part that prevents mistakes)

- `talk_less_ship_more` — CURRENT. Replaced stop_talking_start_shipping after team feedback asked for a "Hamiltonesque" flip ("talk less, smile more" riff). Keeps its period.
- `build_with_people` ("get it") — CURRENT. Replaced iron_sharpens_iron.
- `stop_building_vacuum` — CURRENT (team suggested a positive reframe like "build in community"; never built).
- `connections_syllabus` — CURRENT. From Elliot's Night Shift copy. Only left-aligned design, only one keeping a rule + left bar. Keeps its period.
- `stop_talking_start_shipping` — RETIRED (superseded by talk_less).
- `iron_sharpens_iron` — RETIRED: "sounds like an anvil slogan" and The Anvil is a competing Purdue space. Do not reprint.

Approved-but-never-built directions: "we help people find each other" (the team's unified value prop), positive reframes ("connections beyond the classroom", "build in community"). Deferred: bee/hexagon/honeycomb rebrand, bell-tower patent-drawing concept.

## Elements deliberately removed (don't reintroduce)

Gold horizontal rules between lines (kept ONLY on connections), corner brackets, strikethroughs, tiny "pip" circles, the 1px inner accent ring (replaced by the single 5-unit gold ring), the "Cohort" label lockup (four centering attempts, dropped), gray/low-opacity text (must be full white; 0.62 opacity is the shipped floor, connections only), trailing periods everywhere except `ship more.` and `syllabus.`.

## Brand context (Slack research, Mar-Apr 2026)

Jason Tennenhouse branding direction: approachable over fancy, students as heroes, flexible/messy over polished, lowercase, dark mode; "density + unstructured collisions > orchestrated collaboration". Brand assets Drive folder: "ALL Logo Stuff" https://drive.google.com/drive/folders/14netUXCjH4GIsaaTVwtj291PbbyzzxMt (Color/Black/White logo variants, naming `type-variant-buildpurdue.svg/png`). His concept-board walkthrough was 2026-05-14 — the brand may have moved after these stickers were finalized.

## Gotchas (verified, condensed)

1. cairosvg does not load Google Fonts — every 2026 preview/PNG used a fallback font and every width estimate was wrong. Render with headless Chrome (this skill's script) or install the font locally.
2. Text is never outlined in the shipped SVGs; they depend on the Google Fonts @import at render time. Barlow Condensed is SIL OFL — outlining is safe if ever needed.
3. Never inline the logo's SVG markup (clipPath coordinate space + Inkscape id collisions); always the base64 data URI. And Illustrator drops data-URI images — hence PNG hand-off.
4. Logo gold is `#fabb18`; `#F5A623` was visibly wrong next to it. Sample, don't assume.
5. `<text>` y is the baseline; letter-spacing adds a trailing space that shifts centered text slightly left (known, unfixed imprecision in the shipped files). Measure real bboxes (getBBox in a browser) if a text+image lockup ever needs true centering.
6. Long hero words overflow: shipping 118→110, ship more. 110→94, stop building 82→60. Keep ~35 units (≈3 mm) clear of the cut edge.
7. Elliot's voice-dictated messages contain transcription artifacts ("Build Pretty logo" = buildpurdue logo, "specters" = stickers, "Shit More" = ship more).
8. Standing preference from the sessions: present PNGs, not SVGs, when showing designs.
