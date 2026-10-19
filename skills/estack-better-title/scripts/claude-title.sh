#!/usr/bin/env bash
# Prints a Claude Code session's current custom title, or a "no title" message.
# Codex threads are handled by codex-title.js instead; session.sh picks between
# them. Usage: claude-title.sh <session-id>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/claude.sh
. "$SCRIPT_DIR/lib/claude.sh"

SESSION_ID="${1-}"

if [[ -z "$SESSION_ID" ]]; then
  echo "Error: Usage: claude-title.sh <session-id>" >&2
  exit 1
fi

SESSION_FILE="$(estack_claude_session_file "$SESSION_ID")"

LAST_CUSTOM=""
if [[ -n "$SESSION_FILE" ]]; then
  LAST_CUSTOM=$(grep '"type":"custom-title"' "$SESSION_FILE" | tail -n 1 || true)
fi

if [[ -n "$LAST_CUSTOM" ]]; then
  # Use Node's JSON parser for safe extraction of the title text
  node -e '
    const line = process.argv[1];
    try {
      const o = JSON.parse(line);
      if (o.customTitle) { console.log("Current title: " + o.customTitle); process.exit(0); }
    } catch {}
    console.log("No current title is set for this session.");
  ' "$LAST_CUSTOM"
else
  echo "No current title is set for this session."
fi
