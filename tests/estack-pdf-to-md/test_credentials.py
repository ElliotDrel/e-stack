"""Credential status must agree with conversion without leaking keys or networking."""
import ast
import os
from pathlib import Path
import subprocess
import sys

SCRIPT = Path(__file__).resolve().parents[2] / "skills/estack-pdf-to-md/scripts/pdf_to_md.py"


def resolver():
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "estack_env")
    namespace = {"os": os, "Path": Path, "__file__": str(SCRIPT)}
    exec(compile(ast.Module(body=[function], type_ignores=[]), str(SCRIPT), "exec"), namespace)
    return namespace["estack_env"]


def test_appended_key_and_status(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.delenv("PULSE_API_KEY", raising=False)
    shared = tmp_path / ".e-stack/.env"
    shared.parent.mkdir()
    shared.write_text('PULSE_API_KEY=\nPULSE_API_KEY="fixture-appended-value"\n', encoding="utf-8")
    assert resolver()("PULSE_API_KEY") == "fixture-appended-value"
    result = subprocess.run([sys.executable, "-S", str(SCRIPT), "--check-credentials"], capture_output=True, text=True)
    assert result.returncode == 0
    assert "[OK]" in result.stdout
    assert "fixture-appended-value" not in result.stdout + result.stderr
    monkeypatch.setenv("PULSE_API_KEY", "fixture-process-override")
    assert resolver()("PULSE_API_KEY") == "fixture-process-override"


def test_missing_and_legacy(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.delenv("PULSE_API_KEY", raising=False)
    result = subprocess.run([sys.executable, "-S", str(SCRIPT), "--check-credentials"], capture_output=True, text=True)
    assert result.returncode == 0
    assert "[MISSING]" in result.stdout
    legacy = tmp_path / ".e-stack/estack-pdf-to-md/.env"
    legacy.parent.mkdir(parents=True)
    legacy.write_text("PULSE_API_KEY=fixture-legacy-value\n", encoding="utf-8")
    assert resolver()("PULSE_API_KEY") == "fixture-legacy-value"
    result = subprocess.run([sys.executable, "-S", str(SCRIPT), "--check-credentials"], capture_output=True, text=True)
    assert result.returncode == 0
    assert "[OK]" in result.stdout
    assert "fixture-legacy-value" not in result.stdout + result.stderr
