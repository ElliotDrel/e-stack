# Codex history — storage, schema, and gotchas

Everything specific to **Codex** (OpenAI codex-cli) session history. For the Claude
Code schema see `jsonl-schema.md`; for the CLI modes see `modes.md`. `lib/codex.py`
is the adapter that turns all of this into Claude-shaped entries — read its
docstrings for the API.

## Where it lives

```
~/.codex/sessions/YYYY/MM/DD/rollout-<ISO-ts>-<uuid>.jsonl
```

- One **rollout** file per session, partitioned by the date the session **started**
  (from the filename timestamp). A session that runs past midnight still lives in
  its start-date folder; its file **mtime** is the last write.
- The date folders ARE the index — `ls ~/.codex/sessions/2026/07/15/` lists that
  day's sessions with no decoding. (Contrast Claude's lossy encoded-cwd dirs.)
- Filename: `rollout-2026-07-15T13-32-50-<uuid>.jsonl`. The uuid is everything
  after the hyphenated ISO timestamp (`lib.codex.rollout_uuid`).
- Other Codex state under `~/.codex/` (not read by this skill): `history.jsonl`
  (cross-session command history), `session_index.jsonl`, `archived_sessions/`,
  and sqlite DBs (`state_*.sqlite`, `memories_*.sqlite`, `logs_*.sqlite`). Rollouts
  are the transcript source of truth; the rest is out of scope.

## Line schema

Every line is `{"timestamp": <UTC-ISO>, "type": <...>, "payload": {...}}`. Unlike
Claude, the **timestamp is top-level on every line** (UTC, e.g.
`2026-07-15T17:37:24.816Z`). Top-level `type`:

| `type` | count (typical) | what it is |
|---|---|---|
| `session_meta` | 1 (first line) | session id, cwd, originator, cli_version, model_provider |
| `event_msg` | many | the clean UI event stream (see below) |
| `response_item` | many | the raw model item stream (Responses API) |
| `turn_context` | a few | per-turn context |
| `world_state` | 1–2 | environment snapshot |
| `compacted` / `event_msg:context_compacted` | 0–1 | compaction marker |

### Two layers — the double-count trap

`event_msg` and `response_item` are **two views of the same conversation**. Take
messages from ONE layer or you double every count.

**`event_msg`** — the clean layer (this is what the adapter uses for messages,
edits, and accounting):

| `payload.type` | fields | meaning |
|---|---|---|
| `user_message` | `.message` (str) | the real typed prompt |
| `agent_message` | `.message` (str), `.phase` (`commentary`\|`final_answer`) | assistant-visible text |
| `patch_apply_end` | `.changes` (map path→`{type: add\|update\|delete}`), `.success`, `.stdout` | an applied file edit |
| `task_started` / `task_complete` | `.turn_id` | turn boundaries (one `final_answer` per turn) |
| `token_count` | `.info.total_token_usage`, `.rate_limits` | cumulative + last-turn usage |
| `thread_settings_applied`, `context_compacted` | — | bookkeeping |

**`response_item`** — full detail (the adapter uses it only for reasoning + tools,
never messages, to avoid the double-count):

| `payload.type` | fields | meaning |
|---|---|---|
| `message` | `.role` (user/assistant/developer), `.content[]` = `{type: input_text\|output_text, text}` | **mirrors** the event_msg messages — skipped by the adapter |
| `reasoning` | `.summary[]` (usually `[]`), `.encrypted_content` | model reasoning — **normally encrypted**, so no readable thinking |
| `function_call` | `.name`, `.arguments` (JSON string), `.call_id` | a built-in tool call (e.g. `wait`, `shell`) |
| `custom_tool_call` | `.name` (e.g. `exec`), `.input` (code/command string), `.call_id` | the JS-sandbox / MCP tool call |
| `function_call_output` / `custom_tool_call_output` | — | tool results — not mapped |

## How the adapter normalizes it

`lib.codex.normalize_rollout(path)` → Claude-shaped entries so
`classify_entry` / `get_messages` / `extract_tool_calls` / `files_touched` /
`_is_real_user_prompt` / `session_summary` all work unchanged:

- `user_message` → `{type:"user", message:{role:"user", content:[text]}}`
- `agent_message` (both phases) → `{type:"assistant", message:{role:"assistant", content:[text]}}`
- `patch_apply_end` → assistant entry with `tool_use` blocks (`add`→`Write`,
  `update`/`delete`→`Edit`, `file_path` = each changed path) so file-edit modes work
- `function_call` / `custom_tool_call` → assistant entry with a `tool_use` block
  (name = the Codex tool; `wait`, `exec`, `spawn_agent`, `send_message`, …)
- `reasoning` with non-empty `summary` → a `thinking` block (usually dropped, encrypted)
- everything else (`session_meta`, `response_item:message`, outputs, `turn_context`,
  `world_state`, `token_count`, `task_*`) → dropped as non-signal

Tool_use blocks are emitted **without an `id`** on purpose: `infer_status` treats a
`tool_use` id with no matching `tool_result` as a dangling call ("interrupted"), and
Codex outputs aren't mapped back — omitting the id keeps status inference honest.

## Gotchas

- **Don't `Read` a raw rollout.** They run to megabytes and the two-layer schema is
  noisy. Use `--file <rollout> --mode brief/dump/last/tool-calls/...` (auto-detected)
  or jq on `.payload`.
- **`jq: error: writing output failed: Invalid argument`** on Windows/git-bash is a
  harmless SIGPIPE artifact when piping jq into `head` — ignore it.
- **Message counts:** 25 `user_message` events ≠ 26 `response_item` user messages —
  the response layer includes injected `developer`/permission context. Count from
  `event_msg`. The adapter already does.
- **Reasoning is encrypted** (`summary: []`), so `--in thinking` on a Codex session
  is usually empty. Expected, not schema drift.
- **cwd** comes from `session_meta.payload.cwd`, not the folder path (the folder is a
  date). `session_summary` derives the project label from it.
- **Discovery honors `ESTACK_CODEX_SESSIONS_DIR`** (an env override) for tests; in
  normal use it reads `~/.codex/sessions`. Cross-agent CLI modes only enable Codex
  against the live root (or when that override is set) — backups have no Codex tree.

## Verifying the schema on a real rollout

```bash
CX=~/.codex/sessions/2026/07/15/rollout-*.jsonl
jq -r '.type' "$CX" | sort | uniq -c                               # top-level type mix
jq -r 'select(.type=="event_msg")|.payload.type' "$CX" | sort | uniq -c
jq -r 'select(.type=="response_item")|.payload.type' "$CX" | sort | uniq -c
jq -c 'select(.payload.type=="user_message")|.payload' "$CX" | head -1
```

If the distribution shows an unfamiliar `payload.type`, or the message layers stop
mirroring, the schema drifted — update `lib/codex.py` and this file at the source
repo (see SKILL.md § "Update this skill with what you learn").
