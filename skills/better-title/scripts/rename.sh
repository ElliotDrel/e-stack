#!/usr/bin/env bash
# Renames a Claude Code session by appending title entries (append-only, never rewrites)
# Usage: rename.sh <session-id> <title>
#    or: pass the title on stdin to rename.sh <session-id>

set -euo pipefail

SESSION_ID="${1-}"
TITLE="${2-}"

# If no title argument, read from stdin (supports heredoc input)
if [[ -z "$TITLE" ]]; then
  TITLE="$(cat)"
fi

if [[ -z "$SESSION_ID" || -z "$TITLE" ]]; then
  echo "Error: Usage: rename.sh <session-id> <title>" >&2
  echo "   or: pass the title on stdin to rename.sh <session-id>" >&2
  exit 1
fi

# Reject multiline titles (JSONL entries must be single lines)
if [[ "$TITLE" == *$'\n'* || "$TITLE" == *$'\r'* ]]; then
  echo "Error: title must be a single line" >&2
  exit 1
fi

# Use Node's JSON.stringify for safe escaping of all special characters
TITLE_JSON="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$TITLE")"

# Find the session JSONL file
SESSION_FILE=$(find "$HOME/.claude/projects/" -maxdepth 2 -name "${SESSION_ID}.jsonl" -type f 2>/dev/null | head -1)

if [[ -z "$SESSION_FILE" ]]; then
  echo "Error: Could not find session file for ${SESSION_ID}" >&2
  exit 1
fi

# Build the exact lines we intend to append
CUSTOM_LINE="$(printf '{"type":"custom-title","customTitle":%s,"sessionId":"%s"}' "$TITLE_JSON" "$SESSION_ID")"
AGENT_LINE="$(printf '{"type":"agent-name","agentName":%s,"sessionId":"%s"}' "$TITLE_JSON" "$SESSION_ID")"

# Check if both last entries already match (idempotent — skip if already current)
LAST_CUSTOM="$(grep '^{"type":"custom-title"' "$SESSION_FILE" | tail -n 1 || true)"
LAST_AGENT="$(grep '^{"type":"agent-name"' "$SESSION_FILE" | tail -n 1 || true)"

if [[ "$LAST_CUSTOM" == "$CUSTOM_LINE" && "$LAST_AGENT" == "$AGENT_LINE" ]]; then
  echo "Session already named: ${TITLE}"
  exit 0
fi

# Append-only: never rewrite the file, just add new entries at the end
printf '%s\n%s\n' "$CUSTOM_LINE" "$AGENT_LINE" >> "$SESSION_FILE"

echo "Renamed session to: ${TITLE}"
