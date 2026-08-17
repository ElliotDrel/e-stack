#!/usr/bin/env python3
"""
scan_skill.py — Advisory scan of a freshly generated book-skill folder.

Runs after the LLM synthesis steps, before reporting success to the user.
Checks every .md file in the target folder for:
  - hidden/zero-width/Unicode-tag-block characters (prompt-injection carriers
    that could have survived synthesis from a compromised source document)
  - phrases that read as instructions-to-the-agent rather than book content
    (e.g. "ignore previous instructions", "disregard the above")
  - raw HTML <script>/<iframe> tags (shouldn't appear in synthesized markdown)

This is advisory, not a hard gate — it flags lines for the agent to eyeball,
it does not block or auto-delete anything.

Usage:
    python scan_skill.py <skill_dir>
"""

import re
import sys
from pathlib import Path

HIDDEN_CHARS_RE = re.compile("[​‌‍‎‏﻿\U000e0000-\U000e007f]")
SUSPECT_PHRASES = [
    r"ignore (all |the )?(above|previous|prior) instructions",
    r"disregard (the )?(above|previous|prior)",
    r"you are now",
    r"system prompt",
    r"</?script",
    r"</?iframe",
]
SUSPECT_RE = re.compile("|".join(SUSPECT_PHRASES), re.IGNORECASE)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python scan_skill.py <skill_dir>")

    skill_dir = Path(sys.argv[1])
    if not skill_dir.is_dir():
        sys.exit(f"Not a directory: {skill_dir}")

    md_files = sorted(skill_dir.rglob("*.md"))
    if not md_files:
        print("No .md files found to scan.")
        return

    findings = []
    for f in md_files:
        text = f.read_text(encoding="utf-8", errors="replace")
        if HIDDEN_CHARS_RE.search(text):
            findings.append(f"{f.relative_to(skill_dir)}: contains hidden/zero-width characters")
        for i, line in enumerate(text.splitlines(), 1):
            if SUSPECT_RE.search(line):
                findings.append(f"{f.relative_to(skill_dir)}:{i}: suspicious phrase — {line.strip()[:120]}")

    print(f"Scanned {len(md_files)} file(s) under {skill_dir}")
    if not findings:
        print("No issues found.")
        return

    print(f"\n{len(findings)} finding(s) to review before shipping this skill:")
    for finding in findings:
        print(f"  - {finding}")


if __name__ == "__main__":
    main()
