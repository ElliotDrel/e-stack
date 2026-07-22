#!/usr/bin/env bash
# Prints the session's current custom title, or a "no title" message.
# Usage: current-title.sh <session-id>

set -euo pipefail

SESSION_ID="${1-}"

if [[ -z "$SESSION_ID" ]]; then
  echo "Error: Usage: current-title.sh <session-id>" >&2
  exit 1
fi

# Find the session JSONL file (same lookup rename.sh uses)
SESSION_FILE=$(find "$HOME/.claude/projects/" -maxdepth 2 -name "${SESSION_ID}.jsonl" -type f 2>/dev/null | head -1)

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
