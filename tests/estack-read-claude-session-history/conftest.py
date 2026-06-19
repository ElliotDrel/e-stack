"""Shared pytest fixtures and import-path setup."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest


# Ensure UTF-8 output regardless of console code page (Windows)
for _stream in (sys.stdout, sys.stderr):
    if _stream.encoding and _stream.encoding.lower() != "utf-8":
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass


THIS_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = THIS_DIR.parent.parent / "skills" / "estack-read-claude-session-history" / "scripts"
FIXTURES_DIR = THIS_DIR / "fixtures"

if not SCRIPTS_DIR.is_dir():
    raise FileNotFoundError(f"Scripts dir missing: {SCRIPTS_DIR}")
if not FIXTURES_DIR.is_dir():
    raise FileNotFoundError(f"Fixtures dir missing: {FIXTURES_DIR}")

# Make `from lib...` work in tests
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES_DIR


@pytest.fixture
def scripts_dir() -> Path:
    return SCRIPTS_DIR


@pytest.fixture
def cli_path() -> Path:
    return SCRIPTS_DIR / "read_transcript.py"
