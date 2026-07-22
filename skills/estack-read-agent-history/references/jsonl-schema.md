# JSONL schema reference

What's actually inside a **Claude Code** session `.jsonl`. Only relevant when extending the script or debugging an unexpected empty result. For **Codex** rollouts (a different schema — top-level `{timestamp, type, payload}` with `event_msg`/`response_item` layers) see `codex-history.md`.

## File location

```
C:\Users\<user>\.claude\projects\<encoded-cwd>\<session-uuid>.jsonl
```

The `<encoded-cwd>` is the original working directory with every `:`, `\`, `/`, and whitespace character replaced by `-`. Examples on this machine:

| Original CWD | Encoded directory |
|---|---|
| `C:\Users\2supe\Other Claude Code` | `C--Users-2supe-Other-Claude-Code` |
| `C:\Users\2supe\Other Claude Code\Personal Brand Project` | `C--Users-2supe-Other-Claude-Code-Personal-Brand-Project` |
| `C:\Users\2supe\AppData\Local\Temp` | `C--Users-2supe-AppData-Local-Temp` |

The encoding is lossy — single hyphens in the original path collapse into the same hyphens that separate segments. Use `--mode lookup` / `--mode find` to recover the actual session path; `decode_project_name()` produces a display-only approximation.

## Backup roots

The same encoded-directory layout exists under each `.claude-backups\<name>\projects\` root:

```
C:\Users\2supe\.claude-backups\
  ├── mirror\projects\<encoded-cwd>\<uuid>.jsonl
  ├── snapshot-24h\projects\<encoded-cwd>\<uuid>.jsonl
  ├── snapshot-1w\projects\<encoded-cwd>\<uuid>.jsonl
  └── snapshot-1mo\projects\<encoded-cwd>\<uuid>.jsonl
```

`--root mirror|snapshot-24h|snapshot-1w|snapshot-1mo` rebases all path resolution to that snapshot. An absolute path argument is also accepted.

## Subagent transcripts

When a session spawns subagents (via the `Agent` / `Task` tool), each subagent's own transcript is written to:

```
<project-dir>\<session-uuid>\subagents\agent-<id>.jsonl
```

A sidecar metadata file lives next to it:

```
<project-dir>\<session-uuid>\subagents\agent-<id>.meta.json
```

The meta file contains:

```json
{
  "agentType": "Explore",
  "description": "Find every reference to X"
}
```

When the meta file is missing, `subagents.load_meta` returns `{"agentType": "unknown", "description": ""}`.

Subagent entries inside the parent transcript are marked with `isSidechain: true` and carry an `agentId` field.

## Entry types

Each line in a `.jsonl` is a JSON object with a `type` field. Entry classifications:

| `type` value | Classification | Notes |
|---|---|---|
| `user` | signal (user) | `message.content` may be string or array. Compact markers live here. |
| `assistant` | signal (assistant) | `message.content` is always an array of blocks. |
| `ai-title` / `custom-title` | title | `aiTitle` / `customTitle` field carries the session title. |
| `permission-mode` | noise | mode change events |
| `attachment` | noise | file attachments |
| `last-prompt` | noise | cached last prompt |
| `queue-operation` | noise | internal queueing |
| `file-history-snapshot` | noise | file state snapshots |
| `system` | noise | system events |
| `agent-name` | noise | agent name metadata |
| `pr-link` | noise | PR linkage |

The `noise` and `title` entries are skipped by `get_messages()`. `debug` mode prints the full distribution.

## Assistant content block types

The `message.content` array for assistant entries can hold:

| Block `type` | Field of interest | Meaning |
|---|---|---|
| `text` | `text` | The actual assistant text output. |
| `thinking` | `thinking` (or `text`) | Model internal reasoning. |
| `tool_use` | `name`, `input`, `id` | A regular tool call. `id` is the matching id for any later `tool_result`. |
| `server_tool_use` | `name`, `input` | Server-side tool call (e.g., advisor invocation). |
| `advisor_tool_result` | `content.text` | The advisor's reply. Always nested as `block.content.text`. |
| `tool_result` | `tool_use_id`, `content` | Result for a prior `tool_use`. `content` is a string or an array of `{type:"text", text:"..."}`. |

## Compact marker

A `/compact` event appears as a `type:"user"` entry whose first text content starts with:

> `"This session is being continued from a previous conversation"`

`classify_entry` returns `"compact"` for these. Everything before the most-recent compact marker is the pre-compact conversation.

## Timestamps

Most entries carry a `timestamp` field in ISO-8601 form (`2026-05-01T10:00:05Z`). `_parse_timestamp` accepts ISO strings, naive ISO, and numeric epoch values, and converts aware values to the display timezone (system local, or `--tz`) as naive datetimes — the same zone `--since`/`--until` are interpreted in, so comparisons line up.

## Title entries

Both `ai-title` and `custom-title` entries surface a `aiTitle` / `customTitle` string. `session_summary()` prefers `aiTitle` when both are present.

## Truncation behavior

`iter_lines` drops the final line if it lacks a trailing newline AND fails to parse as JSON, printing `[note: dropped truncated trailing line in <name>]` to stderr. Malformed mid-file lines are dropped silently.

## Status inference

`infer_status(lines, mtime, current_session_id, session_uuid)` returns one of:

| Status | Glyph | Heuristic |
|---|---|---|
| `active` | ● | `current_session_id == session_uuid` AND `mtime` within 5 minutes |
| `interrupted` | ! | Any `tool_use` block lacks a paired `tool_result` |
| `pending-user` | ? | Last assistant text message ends with `?` |
| `clean` | ✓ | none of the above |

This is heuristic — it's correct for the majority of real sessions on this machine but can be fooled by, e.g., an assistant message that legitimately ends with a question.
