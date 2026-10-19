#!/usr/bin/env bash
# Renames the current session, whichever agent that session belongs to.
#
# Usage: rename.sh <session-id> <title>
#    or: pass the title on stdin to rename.sh <session-id>
#
# This stays the single rename entry point on purpose: it is the path named in
# the skill's allowed-tools and in any allow rule a user has added to
# settings.json, so the host routing happens behind it rather than by calling a
# different script per agent.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SESSION_ID="${1-}"
TITLE="${2-}"

# No title argument means it is on stdin (the heredoc form the skill uses).
if [ -z "$TITLE" ]; then
  TITLE="$(cat)"
fi

if [ -z "$SESSION_ID" ] || [ -z "$TITLE" ]; then
  echo "Error: Usage: rename.sh <session-id> <title>" >&2
  echo "   or: pass the title on stdin to rename.sh <session-id>" >&2
  exit 1
fi

# Validated once here, at the entry point, so both hosts reject the same input
# with the same message. A Claude transcript line and a Codex thread name are
# both single-line values.
case "$TITLE" in
  *$'\n'*|*$'\r'*)
    echo "Error: title must be a single line" >&2
    exit 1
    ;;
esac

# shellcheck source=lib/host.sh
. "$SCRIPT_DIR/lib/host.sh" || exit $?

if [ "$SESSION_ID" != "$ESTACK_SESSION_ID" ]; then
  cat >&2 <<EOF
Error: refusing to rename - the id passed in is not this session's id.

  passed in:      $SESSION_ID
  this session:   $ESTACK_SESSION_ID  ($ESTACK_HOST_LABEL)

Renaming the wrong session is silent and hard to notice, so this is a hard stop.
A stale id usually means the id was carried over from an earlier turn or copied
from another session. Re-run scripts/session.sh to get the current one.

The host override selects a host, not a different session. Run the skill
from the session you want to rename.
EOF
  exit 1
fi

# Both leaves take the title on stdin, one shape for both hosts.
if [ "$ESTACK_HOST" = claude ]; then
  printf '%s' "$TITLE" | bash "$SCRIPT_DIR/claude-rename.sh" "$SESSION_ID"
else
  printf '%s' "$TITLE" | node "$SCRIPT_DIR/codex-title.js" set "$SESSION_ID"
fi
