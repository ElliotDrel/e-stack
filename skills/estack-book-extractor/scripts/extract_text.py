#!/usr/bin/env python3
"""
extract_text.py — Deterministic text extraction for estack-book-extractor.

Pulls plain text out of one or more source documents (book chapters, PDFs,
docs) and writes it to a single merged file plus a metadata sidecar, so the
skill's LLM-driven synthesis steps (chapter summaries, glossary, cheatsheet,
master SKILL.md) start from clean extracted text instead of raw binary files.

Supported formats: .pdf, .epub, .docx, .txt, .md, .rst, .adoc, .html, .htm, .rtf

Usage:
    python extract_text.py <path1> [path2 ...] --out <output_dir>

Requires (installed on demand, one at a time, only for formats you use):
    pypdf              -- .pdf
    ebooklib + bs4      -- .epub
    python-docx         -- .docx
    striprtf            -- .rtf
    beautifulsoup4      -- .html / .htm
"""

import argparse
import json
import re
import sys
from pathlib import Path

SUPPORTED_EXTS = {".pdf", ".epub", ".docx", ".txt", ".md", ".rst", ".adoc", ".html", ".htm", ".rtf"}

# Zero-width and Unicode-tag-block characters can carry hidden instructions
# inside a document. Strip them from every extracted string before it ever
# reaches the agent's context.
_HIDDEN_CHARS_RE = re.compile(
    "[​‌‍‎‏﻿\U000e0000-\U000e007f]"
)


def sanitize(text: str) -> str:
    return _HIDDEN_CHARS_RE.sub("", text)


def extract_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("Missing dependency for .pdf: pip install pypdf")
    reader = PdfReader(path)
    if reader.is_encrypted and not reader.decrypt(""):
        sys.exit(
            f"{path.name} is password-protected. Workarounds:\n"
            f"  1. Open in Chrome and print to PDF (strips most publisher locks)\n"
            f"  2. qpdf --decrypt --password=<pwd> in.pdf out.pdf"
        )
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            parts.append("")
    text = "\n".join(parts)
    if sum(1 for c in text if not c.isspace()) < 200:
        sys.exit(
            f"{path.name}: almost no extractable text found. This is likely a "
            f"scanned/image-only PDF. Run it through OCR first (e.g. `ocrmypdf "
            f"{path.name} {path.stem}_ocr.pdf`) and pass the OCR'd file instead."
        )
    return text


def extract_epub(path: Path) -> str:
    try:
        import ebooklib
        from ebooklib import epub
        from bs4 import BeautifulSoup
    except ImportError:
        sys.exit("Missing dependency for .epub: pip install ebooklib beautifulsoup4")
    book = epub.read_epub(str(path))
    parts = []
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_content(), "html.parser")
            parts.append(soup.get_text(separator="\n"))
    return "\n\n".join(parts)


def extract_docx(path: Path) -> str:
    try:
        import docx
    except ImportError:
        sys.exit("Missing dependency for .docx: pip install python-docx")
    doc = docx.Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs)


def extract_rtf(path: Path) -> str:
    try:
        from striprtf.striprtf import rtf_to_text
    except ImportError:
        sys.exit("Missing dependency for .rtf: pip install striprtf")
    return rtf_to_text(path.read_text(encoding="utf-8", errors="replace"))


def extract_html(path: Path) -> str:
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        sys.exit("Missing dependency for .html: pip install beautifulsoup4")
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "html.parser")
    return soup.get_text(separator="\n")


def extract_plain(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


EXTRACTORS = {
    ".pdf": extract_pdf,
    ".epub": extract_epub,
    ".docx": extract_docx,
    ".rtf": extract_rtf,
    ".html": extract_html,
    ".htm": extract_html,
    ".txt": extract_plain,
    ".md": extract_plain,
    ".rst": extract_plain,
    ".adoc": extract_plain,
}


def collapse_blank_lines(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract plain text from source documents.")
    parser.add_argument("paths", nargs="+", help="One or more source files")
    parser.add_argument("--out", required=True, metavar="DIR", help="Output directory")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    sources = []
    for raw in args.paths:
        p = Path(raw).resolve()
        if not p.exists():
            sys.exit(f"File not found: {p}")
        if p.suffix.lower() not in SUPPORTED_EXTS:
            sys.exit(
                f"Unsupported format: {p.suffix} ({p.name}). Supported: "
                f"{', '.join(sorted(SUPPORTED_EXTS))}"
            )
        sources.append(p)

    chunks = []
    total_chars = 0
    total_words = 0
    per_source = []

    for p in sources:
        print(f"Extracting {p.name}...")
        extractor = EXTRACTORS[p.suffix.lower()]
        text = sanitize(collapse_blank_lines(extractor(p)))
        words = len(text.split())
        chars = len(text)
        total_chars += chars
        total_words += words
        per_source.append({"file": p.name, "chars": chars, "words": words})
        chunks.append(f"<!-- source: {p.name} -->\n\n{text.strip()}")
        print(f"  {words:,} words, {chars:,} chars")

    full_text = "\n\n".join(chunks)
    (out_dir / "full_text.txt").write_text(full_text, encoding="utf-8")

    # Rough token estimate: ~4 chars/token for English prose. Good enough for
    # a pre-flight cost estimate, not a billing-accurate count.
    est_tokens = total_chars // 4

    metadata = {
        "sources": per_source,
        "total_chars": total_chars,
        "total_words": total_words,
        "estimated_tokens": est_tokens,
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"\nSaved -> {out_dir / 'full_text.txt'}")
    print(f"Saved -> {out_dir / 'metadata.json'}")
    print(f"\nTotal: {total_words:,} words, {total_chars:,} chars, ~{est_tokens:,} tokens")
    if est_tokens > 50_000:
        print(
            "This is large (>50k tokens). Prefer `grep -n`/`sed -n` slices over "
            "reading the whole file when locating chapter boundaries."
        )


if __name__ == "__main__":
    main()
