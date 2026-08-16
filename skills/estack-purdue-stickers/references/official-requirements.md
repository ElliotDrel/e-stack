# Knowledge Lab Sticker Printing — Official Requirements (distilled)

Distilled 2026-08-15 from the official LibGuide (last edited Apr 3, 2026). Full page text saved verbatim in `raw-guide-text/` — see its INDEX.md for which file is which page. Verify against the live guide if much time has passed: https://guides.lib.purdue.edu/klab-stickerprinting

## Hard rules

- No walk-ins. A print time must be requested AND the design submitted for approval in advance: https://calendar.lib.purdue.edu/space/182313
- Material roll is 18 in wide. Monthly max is 36 in of roll length, so the monthly allotment is 18x36 in per individual OR per club/org (a club counts as 1 person; members may not split submissions to get more, penalty is loss of privileges).
- Free, but no commercial use and no mass production.
- Original works only (copyright). All Purdue trademarks (Unfinished P, Boilermaker train, etc.) need permission from Purdue Trademarks and Licensing. Files get denied for infringement. Questions: Knowledge Lab manager Patricia Swanson, paswanso@purdue.edu.
- File prep must be done in Adobe Illustrator (available free in Purdue IT labs; list at https://it.purdue.edu/facilities/instructionallabs/index.php).

## File spec (what the submitted file must contain)

| Item | Requirement |
|---|---|
| Document | Illustrator doc, Width 18 in (printer default), Height = design height, Color Mode CMYK, Raster Effects High (300 ppi) |
| Cut path | Vector outline of each sticker, stroked with the magenta "CutContour" swatch from the official Roland VersaWorks.ai swatch library. The printer recognizes ONLY this swatch as a cut line |
| Cut path stroke width | "0.1" per the official video, which never states a unit — Illustrator's stroke unit (Preferences > Units > Stroke) is points by default and independent of document inches, so read it as 0.1 pt. The printer keys off the CutContour swatch, not the width, so this is not load-bearing |
| Cut path layer | On its own separate layer, above the artwork layer |
| Fill of cut path | None |
| Scaling | Uniform only (chain/link icon locked in Transform panel) |
| Artboard | Trimmed tight to the art (Artboard tool Shift+O, or Window > Artboard > preset "Fit to Selected Art") |
| Offset path | Optional border, recommended for irregular/text edges; guide shows 0.05-0.17 in examples |
| Save format | Written guide: Save As > Adobe PDF with "Preserve Illustrator Editing Capabilities" checked. Video: "High Quality PDF" preset. Either PDF flavor has been accepted |
| File name | FirstName_LastName_Sticker (e.g. Jane_Doe_Sticker) |
| Multiple designs | Allowed in ONE PDF if each sticker is individually prepped; they recommend limiting how many at once. One copy per design is enough — the print operator duplicates in software |

- Roland VersaWorks.ai swatch library (also saved at `../assets/RolandVersaWorks.ai`): https://drive.google.com/file/d/1_BBz8jbD3d8bdIdvzorU0P5Ob2wI5YSI/view?usp=sharing
- When submitting the booking form, upload BOTH the prepped PDF and the original image files (per the video).

## Booking time to request

- <= 12 in of material: 30 min
- 12-24 in: 60 min
- 24-36 in: 90 min
(Rule of thumb from the video: 30 min per 12 in.)

## Materials / finishes (chosen on the request form)

- Glossy (shiny) — best for bold dark designs, what Elliot used
- Matte (flat)
- Transparent (clear, some shine)
- Heat Transfer (fabric) — appears on the form though not on the materials page

## Visual references (archived in `guide-images/`, indexed in its INDEX.md)

- Offset-path width examples 0 to 0.17 in: `1_Offset.jpg` … `6_Offset.jpg` — show these when choosing a border width
- Shape categories: `Circle.png` (geometric), `Irregular.png`, `Irregular-text.png`
- Size frame of reference (1-3 in): `StickerSizes-outlined.png`
- Finishes: `Glossy.png`, `Matte.png`, `Transparent.png` — show these when choosing a material

## Sticker shape categories

- Geometric (circle/rectangle): simplest prep — draw a Rectangle/Ellipse cut path over the art. Video transcript: `raw-guide-text/geometric-shapes-video-transcript.txt`
- Irregular (detailed edges) and Text: full Image Trace silhouette workflow (see `illustrator-playbook.md`)

## Contacts

- Knowledge Lab: knowledgelab@purdue.edu, WALC 3007, 765-496-1883, https://lib.purdue.edu/knowledgelab/
- Manager: Patricia Swanson (she/her), paswanso@purdue.edu
