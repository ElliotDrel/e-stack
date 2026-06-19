"""Tests for backup-root resolution (--root mirror|snapshot-*|<abs-path>)."""

from pathlib import Path

import pytest

from lib import paths as P


def test_root_live_default():
    assert P.resolve_root(None) == P.DEFAULT_LIVE_PROJECTS
    assert P.resolve_root("live") == P.DEFAULT_LIVE_PROJECTS


def test_root_mirror_path_shape():
    r = P.resolve_root("mirror")
    parts = r.parts
    assert ".claude-backups" in parts
    assert "mirror" in parts
    assert parts[-1] == "projects"


def test_root_snapshot_24h_path_shape():
    r = P.resolve_root("snapshot-24h")
    assert "snapshot-24h" in r.parts
    assert r.name == "projects"


def test_root_all_known():
    for name in ("mirror", "snapshot-24h", "snapshot-1w", "snapshot-1mo"):
        r = P.resolve_root(name)
        assert name in r.parts


def test_root_absolute_path(tmp_path: Path):
    fake = tmp_path / "weird-root"
    fake.mkdir()
    assert P.resolve_root(str(fake)) == fake


def test_root_unknown_relative_raises():
    with pytest.raises(ValueError):
        P.resolve_root("bogus")


def test_find_project_dir_uses_root(tmp_path: Path):
    # Build a fake root with a fake project dir
    proj = tmp_path / "C--Users-foo-bar"
    proj.mkdir()
    found = P.find_project_dir("C:\\Users\\foo\\bar", root=tmp_path)
    assert found == proj


def test_find_project_dir_not_found(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        P.find_project_dir("C:\\does\\not\\exist", root=tmp_path)
