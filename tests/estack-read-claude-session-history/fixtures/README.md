# Test fixtures

Hand-crafted minimal JSONL files, one scenario per file. Keep them small (≤50 lines) — they're easier to reason about than real session snapshots and don't carry PII.

| File | Purpose |
|---|---|
| `basic-session.jsonl` | One user + one assistant exchange. Sanity check for the parser. |
| `with-compact.jsonl` | Conversation interrupted by a single `/compact` marker. |
| `multi-compact.jsonl` | Two `/compact` markers — exercises "most recent" logic. |
| `with-advisor.jsonl` | Contains an `advisor_tool_result` block. |
| `with-thinking.jsonl` | Contains a `thinking` block plus normal text. |
| `all-noise.jsonl` | Only `ai-title` + `attachment` entries — should look empty to signal queries. |
| `subagent-parent.jsonl` | Parent session that spawns one subagent via the `Agent` tool. |
| `subagent-no-meta.jsonl` | Parent session with a sibling subagent file but no `.meta.json` sidecar — `load_meta` must fall back. |
| `tool-zoo.jsonl` | One call to each of Bash, Read, Edit, Write, Agent, Skill, Glob, Grep. |
| `time-spread.jsonl` | Six messages over a known time range — exercises `--since`/`--until`. |
| `truncated.jsonl` | Final line is missing its newline AND is malformed JSON — should be dropped silently. |
| `unicode.jsonl` | Contains emoji + CJK characters — exercises UTF-8 decoding. |
| `pending-user.jsonl` | Last assistant message ends with `?` — `infer_status` should return `pending-user`. |
| `interrupted.jsonl` | Final assistant message has a `tool_use` block with no matching `tool_result` — status `interrupted`. |
| `role-mix.jsonl` | Two real user prompts interleaved with an `isMeta` injection, a `tool_result` envelope, and a compact marker — exercises `--mode last --role user\|both` filtering. |
