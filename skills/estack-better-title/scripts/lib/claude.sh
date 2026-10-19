#!/usr/bin/env bash
# Shared Claude Code helpers for estack-better-title. Source it; don't run it.

# Prints the path of a Claude Code session's transcript, or nothing if it is
# not on disk. Both claude-title.sh and claude-rename.sh look the session up
# this way, so a change to Claude's project layout lands in one place.
estack_claude_session_file() {
  find "$HOME/.claude/projects/" -maxdepth 2 -name "$1.jsonl" -type f 2>/dev/null | head -1
}
