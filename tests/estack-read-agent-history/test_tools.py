"""Tests for lib.tools."""


from lib import parser as PR
from lib import tools as T


def _load(fixtures_dir, name):
    return PR.parse_lines(fixtures_dir / name)


def test_extract_tool_calls_count(fixtures_dir):
    lines = _load(fixtures_dir, "tool-zoo.jsonl")
    calls = T.extract_tool_calls(lines)
    assert len(calls) == 9


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
