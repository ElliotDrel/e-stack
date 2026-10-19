#!/usr/bin/env bash
# Shared host detection for estack-better-title. Source it; don't run it.
#
# Every host names its own session differently and stores the title somewhere
# else, so both entry scripts (session.sh, rename.sh) start here and branch on
# the result rather than assuming Claude Code.
#
# Sets on success:
#   ESTACK_HOST        claude | codex
#   ESTACK_SESSION_ID  the id to read or rename
#   ESTACK_HOST_LABEL  human-readable host name
#
# Exits non-zero with an explanation aimed at the agent when it cannot tell.

# Claude Code exports CLAUDE_CODE_SESSION_ID in every shell it spawns.
# CLAUDE_SESSION_ID is the name SKILL.md interpolation uses and is not always in
# the environment (it is absent under the Agent SDK), so check both.
CLAUDE_ID="${CLAUDE_SESSION_ID:-}"
[ -n "$CLAUDE_ID" ] || CLAUDE_ID="${CLAUDE_CODE_SESSION_ID:-}"

# Codex exports both of these, set to the same thread id.
CODEX_ID="${CODEX_THREAD_ID:-}"
[ -n "$CODEX_ID" ] || CODEX_ID="${CODEX_SESSION_ID:-}"

# CLAUDECODE marks a Claude Code shell even when the id is missing, which lets
# "right host, no id" report differently from "no idea what host this is".
CLAUDE_MARKER="${CLAUDECODE:-}"

# An explicit override is read first. It exists for the nested case below and
# for testing. It selects only the host; the session id still must match
# that host's environment so stale ids cannot rename another session.
ESTACK_HOST_EXPLICIT=0
case "${ESTACK_BETTER_TITLE_HOST:-}" in
  claude) ESTACK_HOST=claude; ESTACK_HOST_EXPLICIT=1 ;;
  codex)  ESTACK_HOST=codex;  ESTACK_HOST_EXPLICIT=1 ;;
  '')     ESTACK_HOST='' ;;
  *)
    echo "Error: ESTACK_BETTER_TITLE_HOST must be 'claude' or 'codex', got '${ESTACK_BETTER_TITLE_HOST}'." >&2
    exit 1
    ;;
esac

if [ "$ESTACK_HOST_EXPLICIT" = 0 ] && { [ -n "$CLAUDE_ID" ] || [ -n "$CLAUDE_MARKER" ]; } && [ -n "$CODEX_ID" ]; then
  cat >&2 <<EOF
Error: both a Claude Code session and a Codex thread are visible in this shell.

  Claude Code session: $CLAUDE_ID
  Codex thread:        $CODEX_ID

That normally means one CLI is driving the other (for example Claude Code
running \`codex exec\`, or Codex running \`claude -p\`), so the inner agent
inherits the outer agent's environment and this skill cannot tell which
session the user is actually looking at.

Do not guess. Ask the user which session they want renamed, then re-run with
ESTACK_BETTER_TITLE_HOST set to that host, which skips this check:

  ESTACK_BETTER_TITLE_HOST=codex bash <skill-dir>/scripts/session.sh
  ESTACK_BETTER_TITLE_HOST=codex bash <skill-dir>/scripts/rename.sh <session-id> <<'__ESTACK_TITLE__'
  <chosen title>
  __ESTACK_TITLE__
EOF
  exit 2
fi

if [ -z "$ESTACK_HOST" ]; then
  if [ -n "$CLAUDE_ID" ] || [ -n "$CLAUDE_MARKER" ]; then
    ESTACK_HOST=claude
  elif [ -n "$CODEX_ID" ]; then
    ESTACK_HOST=codex
  fi
fi

if [ -z "$ESTACK_HOST" ]; then
  cat >&2 <<'EOF'
Error: this skill could not tell which agent it is running in.

It looks for these environment variables and found none of them:
  CLAUDE_SESSION_ID / CLAUDE_CODE_SESSION_ID / CLAUDECODE  -> Claude Code
  CODEX_THREAD_ID / CODEX_SESSION_ID                       -> Codex

estack-better-title only knows how to rename a Claude Code session or a Codex
thread, because renaming means writing to that host's own session store. It has
no way to title a session in a host it does not recognize.

Agent: work out what is actually going on before telling the user anything.
Useful checks:
  - `env | grep -iE 'claude|codex'` - is any session variable set at all?
  - Are you a subagent or a headless run? Those often have no session to rename.
  - Is this a third-party harness that embeds one of these CLIs? If so it may
    strip the session variables, and the user has to rename the chat in that
    tool's own UI instead.

Then tell the user which of those it is, in one sentence, and what they can do:
rename in their host's UI, or re-run this skill from a normal interactive
Claude Code or Codex session.
EOF
  exit 3
fi

if [ "$ESTACK_HOST" = claude ]; then
  ESTACK_SESSION_ID="$CLAUDE_ID"
  ESTACK_HOST_LABEL="Claude Code"
else
  ESTACK_SESSION_ID="$CODEX_ID"
  ESTACK_HOST_LABEL="Codex"
fi

if [ -z "$ESTACK_SESSION_ID" ]; then
  cat >&2 <<EOF
Error: this looks like a ${ESTACK_HOST_LABEL} shell, but no session id is set.

Claude Code sets CLAUDE_CODE_SESSION_ID and Codex sets CODEX_THREAD_ID in every
shell they spawn. One of those is missing here, so there is no session to rename.

Agent: this usually means the command ran somewhere other than the host's own
tool call - a detached shell, a nested process that dropped the environment, or
a harness that does not forward it. Check with \`env | grep -iE 'claude|codex'\`,
then tell the user this session cannot be renamed from here and why.
EOF
  exit 4
fi

# Aliases should identify the same session. Refuse inconsistent harness state.
if { [ "$ESTACK_HOST" = claude ] && [ -n "${CLAUDE_SESSION_ID:-}" ] && [ -n "${CLAUDE_CODE_SESSION_ID:-}" ] && [ "$CLAUDE_SESSION_ID" != "$CLAUDE_CODE_SESSION_ID" ]; } ||
   { [ "$ESTACK_HOST" = codex ] && [ -n "${CODEX_THREAD_ID:-}" ] && [ -n "${CODEX_SESSION_ID:-}" ] && [ "$CODEX_THREAD_ID" != "$CODEX_SESSION_ID" ]; }; then
  echo "Error: conflicting session ids for $ESTACK_HOST_LABEL. Check the host environment before retrying." >&2
  exit 2
fi

# Both supported hosts use UUIDs. Validate before any transcript path lookup.
if [[ ! "$ESTACK_SESSION_ID" =~ ^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$ ]]; then
  echo "Error: invalid session id for $ESTACK_HOST_LABEL. Check the host environment before retrying." >&2
  exit 1
fi

export ESTACK_HOST ESTACK_SESSION_ID ESTACK_HOST_LABEL ESTACK_HOST_EXPLICIT
