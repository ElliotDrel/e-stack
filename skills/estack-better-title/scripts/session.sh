#!/usr/bin/env bash
# Entry point. Works out which agent this is running in, then reports the
# session id, the title it currently has, and the exact command that will
# rename it.
#
# SKILL.md runs this first so the rest of the skill never has to care whether
# the host is Claude Code or Codex, and never has to depend on Claude Code's
# ${CLAUDE_SESSION_ID} / ${CLAUDE_SKILL_DIR} interpolation, which Codex does not
# do. Usage: session.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/host.sh
. "$SCRIPT_DIR/lib/host.sh" || exit $?

if [ "$ESTACK_HOST" = claude ]; then
  TITLE_OUT="$(bash "$SCRIPT_DIR/claude-title.sh" "$ESTACK_SESSION_ID" 2>&1)"
  TITLE_STATUS=$?
else
  TITLE_OUT="$(node "$SCRIPT_DIR/codex-title.js" get "$ESTACK_SESSION_ID" 2>&1)"
  TITLE_STATUS=$?
fi

echo "HOST: $ESTACK_HOST_LABEL"
echo "SESSION_ID: $ESTACK_SESSION_ID"

if [ $TITLE_STATUS -ne 0 ]; then
  echo "CURRENT_TITLE: could not be read" >&2
  echo "$TITLE_OUT" >&2
  echo "Stop and explain the read failure to the user before retrying." >&2
  exit "$TITLE_STATUS"
else
  echo "$TITLE_OUT"
fi

cat <<EOF

Rename with (single quoted heredoc, so the title is passed through literally):

bash "$SCRIPT_DIR/rename.sh" "$ESTACK_SESSION_ID" <<'__ESTACK_TITLE__'
<chosen title>
__ESTACK_TITLE__
EOF
