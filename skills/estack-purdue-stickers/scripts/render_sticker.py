"""Render a sticker SVG to a print-ready transparent PNG via headless Chrome.

Chrome is used (not cairosvg/resvg) because the BuildPurdue sticker SVGs load
Barlow Condensed from Google Fonts via a CSS @import, which only a real
browser engine will fetch. The SVG is inlined into a wrapper HTML file first:
headless Chrome cannot fetch() a local SVG from file:// (CORS), and
data-URI-embedded <image> elements render fine when inlined.

Usage:
    python render_sticker.py input.svg output.png --inches 2 [--dpi 300]

The output pixel size is inches * dpi (default 300 DPI, the Knowledge Lab's
recommended raster resolution). A square sticker at 2in/300dpi -> 600x600 px.
For non-square SVGs pass --width-in/--height-in instead of --inches.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def find_chrome() -> str:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        shutil.which("chrome"),
        # Edge accepts the same --headless/--screenshot flags
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        shutil.which("msedge"),
    ]
    for c in candidates:
        if c and Path(c).exists():
            return c
    sys.exit("No Chrome/Edge found; pass --chrome PATH")


def render(svg_path: Path, out_path: Path, width_px: int, height_px: int,
           chrome: str, wait_ms: int = 10000) -> None:
    svg = svg_path.read_text(encoding="utf-8")
    svg = svg[svg.index("<svg"):]
    # Force the on-screen CSS size to the target pixel size; the SVG viewBox scales.
    html = (
        '<!doctype html><html><head><meta charset="utf-8"><style>'
        "html,body{margin:0;padding:0;background:transparent}"
        f"svg{{display:block;width:{width_px}px;height:{height_px}px}}"
        "</style></head><body>" + svg + "</body></html>"
    )
    out_path.unlink(missing_ok=True)  # never let a stale render pass verification
    with tempfile.TemporaryDirectory() as td:
        wrapper = Path(td) / "wrap.html"
        wrapper.write_text(html, encoding="utf-8")
        cmd = [
            chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            f"--window-size={width_px},{height_px}",
            "--default-background-color=00000000",
            f"--screenshot={out_path}",
            f"--virtual-time-budget={wait_ms}",
            wrapper.as_uri(),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if res.returncode != 0 or not out_path.exists():
            sys.exit(f"Chrome failed (rc={res.returncode}) for {out_path}\n{res.stderr[-2000:]}")


def stamp_dpi(out_path: Path, dpi: int) -> None:
    from PIL import Image
    im = Image.open(out_path)
    im.save(out_path, dpi=(dpi, dpi))


def verify(out_path: Path, width_px: int, height_px: int) -> None:
    from PIL import Image
    im = Image.open(out_path).convert("RGBA")
    assert im.size == (width_px, height_px), f"size {im.size} != {(width_px, height_px)}"
    colors = im.getcolors(width_px * height_px)
    if len(colors) <= 2:
        sys.exit(f"Render looks blank ({len(colors)} distinct colors) - "
                 "the SVG may have failed to load. Check the SVG content.")
    print(f"OK {out_path} {im.size} {len(colors)} colors, "
          f"corner alpha={im.getpixel((1, 1))[3]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svg")
    ap.add_argument("png")
    ap.add_argument("--inches", type=float, help="square sticker size in inches")
    ap.add_argument("--width-in", type=float)
    ap.add_argument("--height-in", type=float)
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--chrome", default=None)
    ap.add_argument("--wait-ms", type=int, default=10000,
                    help="virtual time budget for webfont loading")
    args = ap.parse_args()

    if args.inches and (args.width_in or args.height_in):
        sys.exit("Pass either --inches or --width-in/--height-in, not both")
    w_in = args.inches or args.width_in
    h_in = args.inches or args.height_in
    if not w_in or not h_in:
        sys.exit("Pass --inches (square) or both --width-in and --height-in")
    wpx, hpx = round(w_in * args.dpi), round(h_in * args.dpi)

    out = Path(args.png).resolve()
    chrome = args.chrome or find_chrome()
    render(Path(args.svg).resolve(), out, wpx, hpx, chrome=chrome, wait_ms=args.wait_ms)
    stamp_dpi(out, args.dpi)
    verify(out, wpx, hpx)


if __name__ == "__main__":
    main()
