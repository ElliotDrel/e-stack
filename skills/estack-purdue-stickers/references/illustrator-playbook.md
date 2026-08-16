# Illustrator Playbook — from Elliot's real May 2026 print session

The official guide's steps, adapted with everything learned actually doing it (claude.ai walkthrough session, 2026-05-04: four 2x2 in BuildPurdue stickers prepped in Illustrator and submitted; two designs were later printed from emailed PNGs with little to no edits).

Every official step screenshot/GIF is archived in `guide-images/` (see its INDEX.md): numbered `1_NewFile.png` through `21_SavePDF.gif` following the written guide's order. Show the matching image when a step is confusing (e.g. `16_RolandSwatches.gif` for loading the swatch library, `18_NewLayer.gif` for moving the cut path to its own layer, `21_SavePDF.gif` for the save dialog).

## The proven fast path (rectangle stickers from PNGs)

1. New File: Width 18 in, Height ~4 in (enough for the sticker row; artboard gets trimmed later), CMYK, Raster Effects High (300 ppi).
2. File > Place… > pick the PNG > SINGLE CLICK on the artboard (never click-drag; dragging free-stretches it).
3. Immediately click "Embed" in the top control bar (Place links by default; linked files throw "Could not find the linked file" later).
4. Repeat for each design. One copy per design is enough.
5. Select each image; in Transform panel lock the chain/link icon, set W to the target inches (H follows). Arrange in a row/grid; small gaps or touching are both fine — the cutter only follows the CutContour boxes.
6. Load the cut swatch: Window > Swatches > Swatch Libraries menu (bottom-left icon) > Other Library… > open `../assets/RolandVersaWorks.ai`.
7. Per sticker: press M (Rectangle tool), draw a box around it; press V, select the box; Fill = none (X to focus fill, then /), Stroke = the magenta CutContour swatch (X to focus stroke, click swatch). Stroke width 0.1 (unitless in the video; 0.1 pt on default settings — the swatch is what matters, not the width). Size the box to the sticker's exact dimensions in Transform (chain locked) and center it over the art (select both > align tools). For the BuildPurdue rounded-corner designs, see the cut-path caveats in `design-system.md` (round the cut rect or offset it).
8. Move all cut rectangles to their own layer: Window > Layers > + for a new layer > drag each <Path> entry onto it.
9. Trim artboard: Shift+O and drag edges tight, or Window > Artboard > Fit to Selected Art.
10. File > Save As > Adobe PDF > keep "Preserve Illustrator Editing Capabilities" checked > Save PDF. Name it FirstName_LastName_Sticker.

## Gotchas hit in the real session

- SVGs with embedded data-URI images (like the BuildPurdue stickers, whose logo is a base64 <image>) DROP the logo when opened or placed in Illustrator, and trigger the "Could not find the linked file" dialog. Use the rendered PNG instead — this is why the pipeline renders PNGs. SVGs whose text uses webfonts (@import) also lose the font in Illustrator.
- "Could not find the linked file. Choose/Ignore": the file was placed as a link. Re-place and click Embed, or keep the file at a stable path. Ignore makes it import minus the linked parts.
- Distorted/stretched art: it was click-dragged during Place or scaled with the chain unlocked. Single-click to place, Shift-drag or locked-chain Transform to scale.
- Blank-looking artboard after layer juggling: check you didn't drag the art off-canvas; Ctrl+Z back.
- Checking a sticker's size: select it, read W/H in the Transform panel (Window > Transform if hidden).

## Irregular/text shapes (official full workflow, not needed for rectangles)

Duplicate art > Image Trace preset Silhouettes on the copy > Expand > Ungroup > Release > keep outermost shape, delete the rest > Shift+X swap fill/stroke > duplicate the outline (one for clipping, one for the cut) > align first outline over art > Make Clipping Mask > optional Offset Path (0.05-0.17 in) on the second outline > align it > stroke it with CutContour > move to its own layer > resize both together > trim artboard > save PDF. Full official wording: `raw-guide-text/guide_10391398.txt`.
