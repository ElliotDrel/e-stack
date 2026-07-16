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

# Append-only: never rewrite the file, just add new entries at the end.
# On Windows, the live Claude Code process can hold a transient exclusive lock
# on its own session file while it writes ("Device or resource busy") — retry
# with backoff instead of failing on the first collision. Capture stderr
# (instead of discarding it) so a *permanent* failure — bad path, permissions,
# disk full — is reported accurately rather than misreported as a transient
# lock after silently burning through every retry.
#
# The live CLI writes to this same file on essentially every turn/tool call,
# so in a busy session the lock recurs faster than a short retry window can
# outlast (a flat 6 x 0.3s ~= 1.8s total was measured to fail repeatedly in
# practice). Backoff is exponential, capped at 4s per attempt, ~16s total —
# long enough to reliably clear the real-world lock duration while still
# resolving in under a second in the common case.
BACKOFF=(0.3 0.6 1 1.5 2 3 4 4)
MAX_ATTEMPTS=${#BACKOFF[@]}
attempt=1
APPEND_ERR="$(mktemp)"
until { printf '%s\n%s\n' "$CUSTOM_LINE" "$AGENT_LINE" >> "$SESSION_FILE"; } 2>"$APPEND_ERR"; do
  if [[ $attempt -ge $MAX_ATTEMPTS ]]; then
    LAST_ERR="$(cat "$APPEND_ERR")"
    rm -f "$APPEND_ERR"
    echo "Error: could not append to the session file after ${MAX_ATTEMPTS} attempts." >&2
    echo "Last error: ${LAST_ERR}" >&2
    if [[ "$LAST_ERR" == *[Bb]usy* ]]; then
      echo "This looks like a transient Windows file lock — try the rename again in a few seconds." >&2
    else
      echo "This doesn't look like a transient lock — check the session file path and permissions." >&2
    fi
    exit 1
  fi
  sleep "${BACKOFF[$((attempt - 1))]}"
  attempt=$((attempt + 1))
done
rm -f "$APPEND_ERR"

echo "Renamed session to: ${TITLE}"
