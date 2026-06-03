"""Tests for lib.tools."""

from pathlib import Path

from lib import parser as PR
from lib import tools as T


def _load(fixtures_dir, name):
    return PR.parse_lines(fixtures_dir / name)


def test_extract_tool_calls_count(fixtures_dir):
    lines = _load(fixtures_dir, "tool-zoo.jsonl")
    calls = T.extract_tool_calls(lines)
    assert len(calls) == 9


def test_format_bash():
    call = {"name": "Bash", "input": {"command": "ls -la /tmp"}}
    out = T.format_tool_call(call)
    assert out == "Bash: ls -la /tmp"


def test_format_powershell():
    call = {"name": "PowerShell", "input": {"command": "Get-ChildItem"}}
    assert "PowerShell" in T.format_tool_call(call)


def test_format_read_with_lines():
    call = {"name": "Read", "input": {"file_path": "C:\\foo.py", "offset": 1, "limit": 50}}
    out = T.format_tool_call(call)
    assert "C:\\foo.py" in out
    assert "lines 1" in out


def test_format_edit_with_edits():
    call = {"name": "Edit", "input": {"file_path": "C:\\foo.py", "edits": [{}, {}, {}]}}
    out = T.format_tool_call(call)
    assert "3 edits" in out


def test_format_write():
    call = {"name": "Write", "input": {"file_path": "C:\\bar.py", "content": "print('hi')"}}
    out = T.format_tool_call(call)
    assert "chars" in out


def test_format_agent():
    call = {"name": "Agent", "input": {"subagent_type": "Explore", "description": "Find X"}}
    out = T.format_tool_call(call)
    assert "Agent[Explore]" in out
    assert "Find X" in out


def test_format_skill():
    call = {"name": "Skill", "input": {"skill": "using-superpowers"}}
    out = T.format_tool_call(call)
    assert "using-superpowers" in out


def test_tool_filter(fixtures_dir):
    lines = _load(fixtures_dir, "tool-zoo.jsonl")
    calls = T.extract_tool_calls(lines, tool_filter={"Bash"})
    assert len(calls) == 1
    assert calls[0]["name"] == "Bash"


def test_files_touched(fixtures_dir):
    lines = _load(fixtures_dir, "tool-zoo.jsonl")
    files = T.files_touched(lines)
    assert any("foo.py" in str(p) for p in files)
    assert any("bar.py" in str(p) for p in files)


def test_extract_tool_results(fixtures_dir):
    lines = _load(fixtures_dir, "subagent-parent.jsonl")
    result = T.extract_tool_results(lines, "toolu_01abc")
    assert result is not None
    assert "Found it" in result
