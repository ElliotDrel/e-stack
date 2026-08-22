#!/usr/bin/env python3
"""
pdf_to_md.py — Convert a PDF to Markdown (or .txt) using the RunPulse API.

Usage:
    python pdf_to_md.py <pdf_path> [options]

Options:
    --batch-size N       Pages per API call (default: 10)
    --output-dir PATH    Where to write the output file (default: same dir as PDF)
    --format md|txt      Output file extension (default: md)
    --no-separator       Join batches with a plain newline instead of a page marker
    --min-chars N        Skip pages with fewer than N non-whitespace chars of locally-
                         extracted text (default: 20). Catches blank pages and pages
                         that are entirely an image, since pypdf can't extract their
                         text. Set to 0 to send every page to RunPulse.
    --no-skip            Alias for --min-chars 0. Useful for scanned PDFs where
                         RunPulse's OCR is the whole point.
    --quality fast|high  fast (default): RunPulse 'default' model, no refinement,
                         full parallelism. Cheap and quick.
                         high: 'pulse-ultra-2' vision-language model + full refinement
                         pass (tables, text, formatting), chart-to-table extraction,
                         figure descriptions, footnote linking. Slower, more expensive,
                         throttled by RunPulse to 2 concurrent / 5 per minute / 20 per
                         hour. Use for tables, math, charts, scanned pages, or sloppy
                         formatting.

Requires:
    pip install requests pypdf
    PULSE_API_KEY env var (already set in your user environment)
"""

import argparse
import json
import os
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install requests")

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    sys.exit("Missing dependency: pip install pypdf")

def estack_env(name: str) -> str:
    """Read a credential the e-stack way: environment first, then ~/.e-stack/.env.

    One file holds the credentials for every e-stack skill rather than one file
    per skill, so a key two skills both need is stored once. Format is KEY=value
    per line; blank lines and lines starting with # are ignored, and surrounding
    quotes are stripped.

    A live environment variable always wins, so a one-off override works without
    editing the file. The legacy per-skill locations are still read last so an
    older install keeps working; they were never a good home, since a .env inside
    the installed skill folder is overwritten whenever the installer syncs it.
    """
    live = os.environ.get(name)
    if live:
        return live
    candidates = [
        Path.home() / ".e-stack" / ".env",
        Path.home() / ".e-stack" / "estack-pdf-to-md" / ".env",  # legacy, per-skill  estack-path-ok
        Path(__file__).parent.parent / ".env",  # legacy, inside the installed skill  estack-path-ok
        Path.home() / ".claude" / "skills" / "estack-pdf-to-md" / ".env",  # legacy
        Path.home() / ".claude" / "skills" / "pdf-to-md" / ".env",  # legacy, pre-prefix
    ]
    for p in candidates:
        try:
            if not p.exists():
                continue
            for raw in p.read_text(encoding="utf-8").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                if k.strip() == name:
                    return v.strip().strip('"').strip("'")
        except Exception:
            pass
    return ""


API_KEY = estack_env("PULSE_API_KEY")
BASE_URL = "https://api.runpulse.com"
POLL_INTERVAL = 2   # seconds between status checks
POLL_TIMEOUT  = 600 # seconds before giving up on a job (raised for refine pass)
MAX_429_RETRIES = 5  # exponential backoff: 5s, 10s, 20s, 40s, 80s
MAX_5XX_RETRIES = 3  # transient gateway errors — fewer retries than 429 since 5xx
                     # often signals a real problem rather than throttling

RETRYABLE_5XX = {500, 502, 503, 504}

QUALITY_PRESETS = {
    "fast": {
        "model": "default",
        "max_workers": None,  # None -> use total_batches (full parallelism)
        "extra_options": {},
    },
    "high": {
        "model": "pulse-ultra-2",
        # Ultra 2 caps at 2 concurrent extractions per API key; exceeding that
        # triggers 429s. Cap the worker pool to match.
        "max_workers": 2,
        "extra_options": {
            "refine": True,
            "refine_options": {
                "tables": True,
                "text": True,
                "formatting": True,
            },
            "extract_figure": True,
            "figure_description": True,
            "figure_processing": {
                "description": True,
            },
            "extensions": {
                "footnote_references": True,
            },
        },
    },
}


def _ensure_decrypted(pdf_path: Path) -> tuple[Path, Path | None]:
    """If `pdf_path` is encrypted, write an unencrypted temp copy and return it.

    Returns (path_to_use, cleanup_path_or_None). Many publisher-restricted PDFs
    are owner-locked but have no user password, so `decrypt('')` succeeds and we
    can transparently unlock them. If that fails (real user-password protection),
    exit with workaround guidance.
    """
    reader = PdfReader(pdf_path)
    if not reader.is_encrypted:
        return pdf_path, None

    if not reader.decrypt(""):
        sys.exit(
            f"PDF is password-protected: {pdf_path.name}.\n"
            f"  Workarounds:\n"
            f"    1. Open in Chrome and print to PDF (strips most publisher locks)\n"
            f"    2. qpdf --decrypt --password=<pwd> in.pdf out.pdf\n"
            f"  Then rerun on the new file."
        )

    tmp = tempfile.NamedTemporaryFile(
        suffix=".pdf",
        prefix=f"{pdf_path.stem}_decrypted_",
        delete=False,
    )
    tmp.close()
    tmp_path = Path(tmp.name)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    with open(tmp_path, "wb") as f:
        writer.write(f)
    print(f"  {pdf_path.name} was owner-locked; decrypted with empty password to temp copy.")
    return tmp_path, tmp_path


def analyze_pages(pdf_path: Path, min_chars: int) -> tuple[int, list[int], list[int]]:
    """Return (total_pages, pages_to_convert, pages_skipped). All 1-indexed.

    A page is kept if pypdf can locally extract at least `min_chars` non-whitespace
    characters from it. Blank pages produce empty text; pages whose entire content
    is a rasterized image also produce empty text (pypdf can't OCR). Both get
    skipped, which avoids paying RunPulse to process pages with nothing useful on
    them.
    """
    reader = PdfReader(pdf_path)
    total = len(reader.pages)
    keep: list[int] = []
    skip: list[int] = []
    for i, page in enumerate(reader.pages, 1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        nonspace = sum(1 for c in text if not c.isspace())
        if nonspace >= min_chars:
            keep.append(i)
        else:
            skip.append(i)
    return total, keep, skip


def build_ranges(pages: list[int], max_per_range: int) -> list[tuple[int, int]]:
    """Group a sorted list of 1-indexed pages into consecutive ranges, splitting
    any run that would exceed `max_per_range` pages so each API call stays bounded.
    """
    if not pages:
        return []
    sorted_pages = sorted(set(pages))
    ranges: list[tuple[int, int]] = []
    start = prev = sorted_pages[0]
    for p in sorted_pages[1:]:
        if p == prev + 1 and (prev - start + 1) < max_per_range:
            prev = p
        else:
            ranges.append((start, prev))
            start = prev = p
    ranges.append((start, prev))
    return ranges


def _format_page_list(pages: list[int], max_show: int = 30) -> str:
    """Render a page list compactly: 1,2,3,7,8,9 -> '1-3, 7-9'."""
    if not pages:
        return ""
    sorted_pages = sorted(set(pages))
    groups: list[str] = []
    start = prev = sorted_pages[0]
    for p in sorted_pages[1:]:
        if p == prev + 1:
            prev = p
        else:
            groups.append(f"{start}" if start == prev else f"{start}-{prev}")
            start = prev = p
    groups.append(f"{start}" if start == prev else f"{start}-{prev}")
    if len(groups) > max_show:
        return ", ".join(groups[:max_show]) + f", ... ({len(groups) - max_show} more)"
    return ", ".join(groups)


def _form_value(v):
    """Coerce a Python value into a form-field-friendly string.

    Nested dicts get JSON-encoded; booleans become 'true'/'false'; everything else
    is stringified. RunPulse's multipart endpoint accepts nested option blocks as
    JSON-stringified form fields.
    """
    if isinstance(v, dict):
        return json.dumps(v)
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)


def _resolve_result(payload: dict, label: str) -> str:
    """Return markdown from a result payload, fetching from URL for large results.

    RunPulse returns `is_url: true` + a one-time `url` when the result exceeds
    ~5MB or ~70 pages. We download with the same auth header. The body is either
    raw markdown or a small JSON wrapper around it.
    """
    if payload.get("is_url"):
        url = payload.get("url")
        if not url:
            raise RuntimeError(f"{label}: is_url=true but no url in payload: {payload}")
        print(f"  {label}: fetching large result from URL...")
        resp = requests.get(url, headers={"x-api-key": API_KEY}, timeout=180)
        resp.raise_for_status()
        ctype = resp.headers.get("content-type", "")
        if "json" in ctype:
            body = resp.json()
            md = body.get("markdown") or body.get("result", {}).get("markdown")
            if md:
                return md
            return resp.text
        return resp.text
    return payload.get("markdown", "")


def extract_pages(pdf_path: Path, start: int, end: int, quality: str = "fast") -> str:
    """Upload the PDF and extract a specific page range; returns markdown string."""
    preset = QUALITY_PRESETS[quality]
    headers = {"x-api-key": API_KEY}

    pages_arg = f"{start}" if start == end else f"{start}-{end}"
    data = {
        "pages": pages_arg,
        "async": "true",
        "model": preset["model"],
    }
    for key, value in preset["extra_options"].items():
        data[key] = _form_value(value)

    payload = _post_with_retry(pdf_path, headers, data, start, end)

    if "job_id" in payload:
        return _poll(payload["job_id"], start, end)
    if "markdown" in payload or payload.get("is_url"):
        return _resolve_result(payload, f"pages {start}-{end}")

    raise RuntimeError(f"Unexpected response for pages {start}-{end}: {payload}")


def _post_with_retry(pdf_path: Path, headers: dict, data: dict, start: int, end: int) -> dict:
    """POST to /extract with exponential-backoff retry on 429 and transient 5xx."""
    backoff_429 = 5
    backoff_5xx = 5
    attempts_429 = 0
    attempts_5xx = 0
    while True:
        with open(pdf_path, "rb") as f:
            resp = requests.post(
                f"{BASE_URL}/extract",
                headers=headers,
                files={"file": (pdf_path.name, f, "application/pdf")},
                data=data,
                timeout=120,
            )
        if resp.status_code == 429 and attempts_429 < MAX_429_RETRIES:
            print(f"  pages {start}-{end}: 429 rate-limited, sleeping {backoff_429}s before retry...")
            time.sleep(backoff_429)
            backoff_429 *= 2
            attempts_429 += 1
            continue
        if resp.status_code in RETRYABLE_5XX and attempts_5xx < MAX_5XX_RETRIES:
            print(f"  pages {start}-{end}: {resp.status_code} from RunPulse, sleeping {backoff_5xx}s before retry...")
            time.sleep(backoff_5xx)
            backoff_5xx *= 2
            attempts_5xx += 1
            continue
        resp.raise_for_status()
        return resp.json()


def _poll(job_id: str, start: int, end: int) -> str:
    """Block until the async job completes and return its markdown."""
    headers = {"x-api-key": API_KEY}
    deadline = time.time() + POLL_TIMEOUT
    backoff_429 = 5
    backoff_5xx = 5
    attempts_5xx = 0

    while time.time() < deadline:
        resp = requests.get(f"{BASE_URL}/job/{job_id}", headers=headers, timeout=30)
        if resp.status_code == 429:
            print(f"  pages {start}-{end}: 429 during poll, sleeping {backoff_429}s...")
            time.sleep(backoff_429)
            backoff_429 = min(backoff_429 * 2, 60)
            continue
        if resp.status_code in RETRYABLE_5XX and attempts_5xx < MAX_5XX_RETRIES:
            print(f"  pages {start}-{end}: {resp.status_code} during poll, sleeping {backoff_5xx}s...")
            time.sleep(backoff_5xx)
            backoff_5xx *= 2
            attempts_5xx += 1
            continue
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")

        if status == "completed":
            result = data.get("result", {}) or {}
            return _resolve_result(result, f"pages {start}-{end}")
        if status in ("failed", "canceled"):
            raise RuntimeError(f"Job {job_id} ended with status '{status}': {data}")

        time.sleep(POLL_INTERVAL)

    raise TimeoutError(f"Job {job_id} did not finish within {POLL_TIMEOUT}s")


def _parse_page_range(spec: str, total: int) -> set[int]:
    """Parse '5-10,12,20-22' into a set of 1-indexed page numbers, clamped to total.

    Exits with a clear message on malformed input (non-integers, reversed ranges,
    missing sides, non-positive numbers) instead of crashing with a bare ValueError.
    """
    pages: set[int] = set()
    for raw_part in spec.split(","):
        part = raw_part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = (s.strip() for s in part.split("-", 1))
            if not a or not b:
                sys.exit(f"Bad --pages: range '{part}' is missing a number on one side. Use e.g. '5-10' or just '5'.")
            try:
                lo, hi = int(a), int(b)
            except ValueError:
                sys.exit(f"Bad --pages: '{part}' contains a non-integer.")
            if lo > hi:
                sys.exit(f"Bad --pages: range '{part}' is reversed ({lo} > {hi}).")
        else:
            try:
                lo = hi = int(part)
            except ValueError:
                sys.exit(f"Bad --pages: '{part}' is not an integer.")
        if lo < 1:
            sys.exit(f"Bad --pages: '{part}' contains a non-positive page number.")
        for p in range(lo, min(total, hi) + 1):
            pages.add(p)
    if not pages:
        sys.exit(f"Bad --pages: '{spec}' resolved to no valid pages (PDF has {total}).")
    return pages


def convert_pdf(
    pdf_path: Path,
    batch_size: int = 10,
    output_dir: Path | None = None,
    fmt: str = "md",
    separator: bool = True,
    min_chars: int = 20,
    quality: str = "fast",
    pages_filter: str | None = None,
) -> Path:
    if not API_KEY:
        sys.exit(
            "PULSE_API_KEY is not set. Open a new terminal so the user env var is loaded, "
            "or set it manually: $env:PULSE_API_KEY = '...'"
        )

    pdf_path = pdf_path.resolve()
    if not pdf_path.exists():
        sys.exit(f"File not found: {pdf_path}")

    effective_pdf, cleanup_path = _ensure_decrypted(pdf_path)
    try:
        return _convert_pdf_impl(
            original_pdf=pdf_path,
            effective_pdf=effective_pdf,
            batch_size=batch_size,
            output_dir=output_dir,
            fmt=fmt,
            separator=separator,
            min_chars=min_chars,
            quality=quality,
            pages_filter=pages_filter,
        )
    finally:
        if cleanup_path is not None and cleanup_path.exists():
            try:
                cleanup_path.unlink()
            except OSError:
                pass


def _convert_pdf_impl(
    *,
    original_pdf: Path,
    effective_pdf: Path,
    batch_size: int,
    output_dir: Path | None,
    fmt: str,
    separator: bool,
    min_chars: int,
    quality: str,
    pages_filter: str | None,
) -> Path:
    page_count, pages_to_convert, pages_skipped = analyze_pages(effective_pdf, min_chars)
    print(f"{original_pdf.name}: {page_count} pages total")

    skip_reason = "blank or image-only"
    if pages_filter:
        requested = _parse_page_range(pages_filter, page_count)
        pages_to_convert = sorted(requested)
        pages_skipped = [p for p in range(1, page_count + 1) if p not in requested]
        skip_reason = "excluded by --pages filter"
        print(f"  --pages filter active: only processing {_format_page_list(pages_to_convert)}")
    elif pages_skipped:
        print(
            f"  Skipping {len(pages_skipped)} page(s) with <{min_chars} chars of "
            f"extractable text (blank or image-only): {_format_page_list(pages_skipped)}"
        )
        print("  Override with --no-skip if you want every page sent to RunPulse.")

    if not pages_to_convert:
        sys.exit(
            "No pages contain extractable text above the threshold. If this PDF is a "
            "scan where RunPulse OCR is exactly what you need, rerun with --no-skip."
        )

    if quality not in QUALITY_PRESETS:
        sys.exit(f"Unknown quality preset: {quality!r}. Choose 'fast' or 'high'.")
    preset = QUALITY_PRESETS[quality]

    ranges = build_ranges(pages_to_convert, batch_size)
    total_batches = len(ranges)
    pages_being_sent = len(pages_to_convert)
    max_workers = preset["max_workers"] or total_batches
    max_workers = min(max_workers, total_batches)
    print(
        f"  Sending {pages_being_sent} page(s) in {total_batches} batch(es) "
        f"(max {batch_size} pages each) via quality='{quality}' (model={preset['model']})"
    )

    results: dict[int, str] = {}

    def _process_batch(idx: int, start: int, end: int) -> tuple[int, str]:
        text = extract_pages(effective_pdf, start, end, quality=quality)
        print(f"  [{idx}/{total_batches}] pages {start}-{end} done ({len(text):,} chars)")
        return idx, text.strip()

    print(f"Submitting {total_batches} batch(es) with up to {max_workers} in parallel...")
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(_process_batch, i, start, end): (i, start, end)
            for i, (start, end) in enumerate(ranges, 1)
        }
        for future in as_completed(futures):
            i, start, end = futures[future]
            try:
                idx, text = future.result()
                results[idx] = text
            except Exception as exc:
                print(f"  [{i}/{total_batches}] pages {start}-{end} FAILED: {exc}")
                raise

    if separator:
        chunks: list[str] = []
        skipped_any = bool(pages_skipped)
        prev_end = 0
        for i, (start, end) in enumerate(ranges, 1):
            if skipped_any:
                gap_start = prev_end + 1
                if gap_start < start:
                    chunks.append(
                        f"<!-- pages {gap_start}-{start - 1} skipped ({skip_reason}) -->"
                    )
                chunks.append(f"<!-- pages {start}-{end} -->\n\n{results[i]}")
            else:
                if i == 1:
                    chunks.append(results[i])
                else:
                    chunks.append(f"<!-- pages {start}-{end} -->\n\n{results[i]}")
            prev_end = end
        if skipped_any and prev_end < page_count:
            chunks.append(
                f"<!-- pages {prev_end + 1}-{page_count} skipped ({skip_reason}) -->"
            )
        full_text = "\n\n".join(chunks)
    else:
        full_text = "\n\n".join(results[i] for i in range(1, total_batches + 1))

    dest_dir = output_dir or original_pdf.parent
    dest_dir.mkdir(parents=True, exist_ok=True)
    out_path = dest_dir / f"{original_pdf.stem}.{fmt}"
    if out_path.exists():
        print(f"  WARNING: overwriting existing file: {out_path}")
    out_path.write_text(full_text, encoding="utf-8")

    print(f"\nSaved -> {out_path}")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a PDF to Markdown using RunPulse."
    )
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument(
        "--batch-size", type=int, default=10, metavar="N",
        help="Pages per API call (default: 10)"
    )
    parser.add_argument(
        "--output-dir", metavar="PATH",
        help="Output directory (default: same directory as the PDF)"
    )
    parser.add_argument(
        "--format", choices=["md", "txt"], default="md",
        help="Output file extension (default: md)"
    )
    parser.add_argument(
        "--no-separator", action="store_true",
        help="Join batches without page-marker comments"
    )
    parser.add_argument(
        "--min-chars", type=int, default=20, metavar="N",
        help="Skip pages with fewer than N non-whitespace chars of locally-extracted "
             "text — catches blank and image-only pages (default: 20)"
    )
    parser.add_argument(
        "--no-skip", action="store_true",
        help="Send every page to RunPulse (equivalent to --min-chars 0). Use for "
             "scanned PDFs where OCR is the whole point."
    )
    parser.add_argument(
        "--quality", choices=["fast", "high"], default="fast",
        help="fast (default): 'default' model, full parallelism, cheap. "
             "high: 'pulse-ultra-2' + refinement + figure extraction; throttled to "
             "2 concurrent. Use for tables, math, charts, scans, or sloppy formatting."
    )
    parser.add_argument(
        "--pages", metavar="RANGE",
        help="Restrict to a specific 1-indexed page range, e.g. '5-10'. Useful for "
             "spot-testing on a single page. Overrides the blank/image-only filter "
             "for pages explicitly requested."
    )
    args = parser.parse_args()

    min_chars = 0 if args.no_skip else args.min_chars

    convert_pdf(
        pdf_path=Path(args.pdf_path),
        batch_size=args.batch_size,
        output_dir=Path(args.output_dir) if args.output_dir else None,
        fmt=args.format,
        separator=not args.no_separator,
        min_chars=min_chars,
        quality=args.quality,
        pages_filter=args.pages,
    )


if __name__ == "__main__":
    main()
