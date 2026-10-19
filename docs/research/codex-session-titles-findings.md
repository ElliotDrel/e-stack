# Codex session titles — how the rename actually works

The research record behind `estack-better-title` 2.0.1, which adds Codex support.
The original observations below came from codex-cli 0.153.4 on Windows
(2026-09-06). They are historical unless explicitly reverified below.

## Current audit — 2026-10-19

Verified with **codex-cli 0.162.1 on Windows**:

- Generated the installed app-server JSON schema. `thread/read` accepts
  `threadId` and `includeTurns`; its thread response has a nullable `name`.
- Started an app-server with a disposable `CODEX_HOME`, created a throwaway
  thread without a model turn, then round-tripped `thread/name/set` and
  `thread/read`. The skill helper also read, renamed, and read that thread
  through separate server processes. No existing user chat was renamed.
- Both `CODEX_THREAD_ID` and `CODEX_SESSION_ID` are present in this host.
- `node --test tests/estack-better-title/test-routing.cjs` verifies Claude
  transcript writes in temporary homes, host detection, nested overrides,
  stale-id rejection, and a simulated Codex protocol over real process pipes.

The audit supersedes two old assumptions: a host override must never disable
session-id validation, and finding frontmatter strings in a binary does not
prove that a host enforces those permissions. Permission behavior and UI repaint
latency were not runtime-tested. Claude was tested against disposable transcript
fixtures, not an active Claude UI. The proxy path was simulated; only the private
stdio transport was exercised against the real Codex binary.

The current implementation stops on backend read errors instead of treating a
missing thread or malformed response as an unnamed session. It preserves split
UTF-8 output and literal title whitespace. A nested Claude marker without an id
still counts as an ambiguous host, and conflicting id aliases are rejected.


Current official docs were fetched on 2026-10-19:

- [Claude Code skill context injection](https://code.claude.com/docs/en/skills#inject-dynamic-context)
  documents both inline and fenced shell blocks. A nonzero injected command
  aborts skill loading, so the entry block preserves the diagnostic as text and
  prints `SESSION_CHECK_FAILED` while allowing the agent to explain it. Direct
  calls to `session.sh` retain their nonzero exit codes.
- [Codex skill invocation policy](https://learn.chatgpt.com/docs/build-skills)
  documents `agents/openai.yaml` with `policy.allow_implicit_invocation: false`.
  This supplies the Codex equivalent of the Claude-only
  `disable-model-invocation` setting.

## Host detection

Codex exports both of these into every shell it runs a command in, set to the
same value:

```
CODEX_SESSION_ID=01a0773b-bc21-7420-8afe-9945c2309c91
CODEX_THREAD_ID=01a0773b-bc21-7420-8afe-9945c2309c91
```

Claude Code exports `CLAUDE_CODE_SESSION_ID` and `CLAUDECODE=1`. It does **not**
always export `CLAUDE_SESSION_ID` — under the Claude Agent SDK (which is what
third-party harnesses embed) only `CLAUDE_CODE_SESSION_ID` is present. The old
skill read `${CLAUDE_SESSION_ID}` via SKILL.md interpolation, which is why the
id could come back blank there.

Host variables identify the session in ordinary tool shells. When one CLI drives the other (`codex exec` from Claude Code, or
`claude -p` from Codex), the inner agent inherits the outer agent's environment
and both sets are visible at once. There is no reliable way to tell which is the
inner one from the environment alone, so `lib/host.sh` treats that as an error
and asks rather than guessing.

## Historical storage observations (not reverified in the current audit)

`~/.codex/state_<N>.sqlite`, table `threads`, and there are two relevant columns:

| Column | What it is |
|---|---|
| `title` | Falls back to the first user message. Not the user-facing name. |
| `name` | The user-set thread name. `NULL` until something sets it. This is the one. |

The `<N>` in the filename is a schema generation that Codex bumps
(`state_5.sqlite` at the time of writing), and the table gained columns as
recently as this version — `name`, `is_pinned`, `project_id`, and
`thread_section_id` all sit after the original block. `~/.codex/session_index.jsonl`
(`{id, thread_name, updated_at}`) is a **legacy** index, last written 2026-08-29
on this machine; do not write it.

**Do not write the database.** A live Codex process owns it, the filename moves
with the schema generation, and the columns are not a stable interface. Use the
protocol below instead.

## The protocol

`codex app-server` speaks newline-delimited JSON-RPC. The relevant methods:

| Method | Params | Notes |
|---|---|---|
| `initialize` | `{clientInfo: {name, version}}` | Must be first. Reply carries `codexHome`, platform info. |
| `initialized` | — | A notification, not a request. Send it before anything else. |
| `thread/read` | `{threadId, includeTurns: false}` | Returns `{thread}` with `id` and `name`, straight from the state DB. Unknown id errors with `thread not loaded: <id>`. **This is the read to use.** |
| `thread/name/set` | `{threadId, name}` | Sets the name. Result is `{}`. Also emits a `thread/name/updated` notification. Unknown id errors with `no rollout found for thread id <id>`. |
| `thread/list` | `{limit, sortKey, sortDirection, sourceKinds, useStateDbOnly, cursor}` | Returns `{data, nextCursor, backwardsCursor}`; each thread carries `id` and `name`. Not needed for a by-id read, see below. |

Generate the full schema for any of this with:

```bash
codex app-server generate-json-schema --out <dir>   # v1/ and v2/ subdirs
```

### Gotchas

1. **Use `thread/read`, not `thread/list`, for a by-id lookup.** The first
   version of the script paged `thread/list` because the method table did not
   list a direct read; the audit found `thread/read` in the generated schema.
   If you ever do need `thread/list`, two traps: it has no by-id filter, and it
   **hides `exec` and subagent threads by default**. The default `sourceKinds`
   filter covers the interactive kinds only; pass every kind explicitly (`cli,
   vscode, exec, appServer, subAgent, subAgentReview, subAgentCompact,
   subAgentThreadSpawn, subAgentOther, unknown`) or a thread that is plainly in
   the database comes back "not found".
2. **Every `codex` process start costs ~3.5 s on this machine**, before it does
   anything. `codex --version` alone measured 3.6 s. Budget one spawn per
   operation, not one per attempt.

### Two transports

- `codex app-server proxy` — forwards to the app-server daemon already serving
  the live session, so a running UI repaints immediately. When no daemon is
  listening it fails with `failed to connect to socket at
  ~/.codex/app-server-control/app-server-control.sock`, but only after the full
  ~3.5 s process start, and that is the common case for a plain CLI session
  (the `app-server-control/` directory did not even exist here).
- `codex app-server` — starts a private stdio server. Writes the same state, but
  a session that is already open won't repaint until the thread list reloads.

`scripts/codex-title.js` checks for the control socket on disk first and only
tries the proxy when it is there, so the no-daemon case is one spawn instead of
two. A JSON-RPC error from a method the server actually answered is surfaced
as-is rather than retried on the other transport; only a failure of the
connection itself (spawn error, exit before the handshake, timeout) falls
through.

## Historical skill-loader observations (permission claims superseded)

| | Claude Code | Codex |
|---|---|---|
| Reads skills from | `~/.claude/skills/` (symlink to `~/.agents/skills/`) | `~/.agents/skills/` |
| `allowed-tools` permissions | Host-specific; verify behavior | Not established by the old binary string-table probe; do not promise a permission grant |
| Interpolates `${CLAUDE_SESSION_ID}` / `${CLAUDE_SKILL_DIR}` in the body | yes | **no** |
| Runs ` ```! ` auto-run blocks on load | yes | **no** — the string does not appear in the binary |
| Choice tools | Use a choice tool when exposed | Tool availability varies by host and mode; fall back to numbered chat options |

The practical consequence for any cross-host skill: put the work in a script,
have the script find its own directory from `$BASH_SOURCE`, and have it print
whatever the model needs — including the exact follow-up command with paths and
ids already filled in. Then the ` ```! ` block is a nice-to-have on Claude Code
and a plain "run this first" instruction everywhere else.

## Nested hosts

When one CLI drives the other (`codex exec` from Claude Code, or `claude -p`
from Codex) both variable sets are visible and `lib/host.sh` exits 2. The way
out is `ESTACK_BETTER_TITLE_HOST=claude|codex`, which is read *before* the
both-visible guard and skips it. The first version of the script checked in the
other order, so the escape hatch its own error message named could never be
reached; that is what the audit caught. Keep the override first. It selects only a host; missing, conflicting, invalid,
or stale session ids still fail before any write.

## Re-verifying

```bash
# Does Codex still export a thread id into command shells?
codex exec --skip-git-repo-check -s read-only \
  "Run exactly this and paste raw stdout: env | sort" < /dev/null | grep CODEX_

# Is the state schema still shaped this way?
python -c "import sqlite3,os,glob;p=sorted(glob.glob(os.path.expanduser('~/.codex/state_*.sqlite')))[-1];\
print(sqlite3.connect('file:'+p.replace(os.sep,'/')+'?mode=ro',uri=True).execute(\
\"select sql from sqlite_master where name='threads'\").fetchone()[0])"

# Run deterministic fixture tests without accessing live session stores.
node --test tests/estack-better-title/test-routing.cjs

# For a live round trip, first start a throwaway thread in a disposable
# CODEX_HOME. Never substitute an existing user chat for a test thread.
```
