# Mode reference

Every mode of `read_transcript.py`, with all flags, exit codes, and worked examples.

For the high-level decision tree, see `../SKILL.md`. For the JSONL schema, see `jsonl-schema.md`. For multi-step workflows, see `recipes.md`.

## CLI grammar

```
python read_transcript.py [--root <root>] [--cwd <path> | --all-projects | --file <path>]
                          [--since <spec>] [--until <spec>]
                          --mode <mode> [mode-specific flags]
                          [--exclude-current] [--include-subagents] [-n N]
                          [--force-dump]
```

Legacy flags are preserved unchanged:
- `--list` (alias for `--mode list` with the v1 column layout)
- `--list-subagents` (alias for `--mode subagent-list` with the v1 column layout)

---

## Single-session modes

### `last`

Last N assistant text outputs.

```bash
python read_transcript.py --file <path> --mode last [-n 5]
```

- Default N = 5.
- With `--include-subagents`, appends each subagent's final assistant message tagged `[subagent <id-short> · <agentType>]`.

### `advisor`

All advisor responses (the contents of every `advisor_tool_result` block).

```bash
python read_transcript.py --file <path> --mode advisor
```

### `pre-compact`

40 message-exchanges before the most recent `/compact`.

```bash
python read_transcript.py --file <path> --mode pre-compact
```

If no `/compact` marker is present, falls back to `mode_last(10)` with a note.

### `dump`

Human-readable conversation dump (text only, last 80 messages by default).

```bash
python read_transcript.py --file <path> --mode dump [--include-subagents] [--force-dump]
```

**Size-aware fallback:** transcripts larger than 5 MB auto-degrade to `pre-compact` (or `last` if no compact marker), with a stderr note. Override with `--force-dump`.

### `debug`

Structural diagnostic — prints entry type distribution, content block types, advisor probe, compact-marker probe, and sample signal entries. Use this first when a mode returns empty/unexpected results.

```bash
python read_transcript.py --file <path> --mode debug
```

### `brief`

6-line single-session summary. Designed for fan-out triage: 14 parallel `brief` calls reproduce a 14-subagent investigation deterministically.

```bash
python read_transcript.py --file <path> --mode brief [--include-subagents]
```

Output format:
```
<uuid> · <decoded-project> · <mtime> · <status> [*]<if current>
intent:    <first user prompt, 200ch>
last:      <last assistant text, 200ch>
edits:     <N> files — <top-3 paths>
tools:     Bash=X Edit=Y Read=Z …
subagents: <N> spawned [<agentType counts>]
```

With `--include-subagents`, appends each subagent's final assistant message.

### `changelog`

`HH:MM:SS  TOOL  one-line-summary`, day-grouped.

```bash
python read_transcript.py --file <path> --mode changelog
```

### `file-edits`

Unique file paths touched, sorted alphabetically. Multiple operations on the same file get a count suffix.

```bash
python read_transcript.py --file <path> --mode file-edits
```

### `tool-calls`

Timestamped per-call blocks, with formatted args.

```bash
python read_transcript.py --file <path> --mode tool-calls [--tool Bash,Edit]
```

`--tool` filters to a comma-separated subset.

---

## Discovery modes

### `list`

Enriched session table.

```bash
# Single project
python read_transcript.py --cwd <path> --mode list [--since 7d] [--exclude-current]

# All projects
python read_transcript.py --all-projects --mode list [--since today]
```

Columns: marker (`[*]` if current), mtime, size, uuid-short, msg count, flags (`[C]`=compact, `[S]`=subagents), status (✓!?●), decoded project name (when multi-project), title.

For byte-identical v1 output, use the legacy `--list` flag.

### `lookup`

Resolve a UUID prefix to an absolute path.

```bash
python read_transcript.py --mode lookup --uuid <prefix>
```

- Exit 0: prints absolute path.
- Exit 1: no match.
- Exit 2: ambiguous prefix — prints all matches.

### `find`

Search session metadata by title or first prompt.

```bash
python read_transcript.py --mode find --title "supabase"
python read_transcript.py --mode find --first-prompt "fix the bug"
```

### `resume-cmd`

Generate a `cd <cwd>; claude --resume <uuid>` snippet for a UUID prefix.

```bash
python read_transcript.py --mode resume-cmd --uuid <prefix>
```

The original CWD cannot be unambiguously recovered from the encoded directory name; the snippet includes a `<original cwd>` placeholder plus the decoded display name as a hint.

---

## Search modes

### `search`

Cross-scope search with role + channel filters.

```bash
# Single file
python read_transcript.py --file <path> --mode search --query "<q>"

# Whole project
python read_transcript.py --cwd <path> --mode search --query "<q>"

# All projects
python read_transcript.py --all-projects --mode search --query "<q>"
```

Flags:
- `--role {user,assistant,both}` (default `both`)
- `--in {text,tool_use,thinking,all}` (default `text`)
- `--since` / `--until`

`--in tool_use` searches the `name + JSON-stringified input` of every `tool_use` block — useful for finding "the session where I ran `git push --force`".

`--in thinking` searches `thinking` blocks (model reasoning).

### `count`

Count sessions matching a query.

```bash
python read_transcript.py --mode count --query "<q>" [--all-projects] [--since 30d]
```

stdout: integer session count.
stderr: `<N> sessions, <M> total messages, <K> matches`.

---

## Subagent modes

### `subagent-list`

List sibling subagents for a parent session.

```bash
python read_transcript.py --file <parent> --mode subagent-list
```

Output: `mtime  size  agent-id  type=<agentType>  "<description>"`. The legacy `--list-subagents` flag preserves v1's simpler columns.

### `subagent-finals`

Every subagent's final assistant message, separated by `=== agent-<id> (<type>) ===` headers.

```bash
python read_transcript.py --file <parent> --mode subagent-finals
```

### `subagent-tools`

Tool-call forensics on a single subagent (same output shape as `tool-calls`).

```bash
python read_transcript.py --mode subagent-tools --subagent <subagent-path>
```

### `subagent-files`

Files touched by a single subagent (same output shape as `file-edits`).

```bash
python read_transcript.py --mode subagent-files --subagent <subagent-path>
```

---

## Resume modes

### `resume-prev`

Banner + dump-style tail of the last 10 exchanges from the most-recent prior session in a project.

```bash
python read_transcript.py --cwd <path> --mode resume-prev [-n 10]
```

---

## Aggregation modes

### `journal`

Per-session 5-line block: date·uuid·project / prompt / ended / edits / tools.

```bash
python read_transcript.py --mode journal --since 7d [--cwd <path> | --all-projects]
```

---

## Comparison modes

### `diff`

Timestamp-interleaved comparison of two sessions.

```bash
python read_transcript.py --mode diff --file-a <s1> --file-b <s2>
```

For sibling-subagent comparison (when a fan-out spawned multiple agents with similar tasks):

```bash
python read_transcript.py --mode diff --subagents-of <parent>
```

Output is prefixed `A>` / `B>` (or with subagent id shorts).

---

## Exit codes

- `0`: success
- `1`: missing required flag, no match, or file not found
- `2`: ambiguous result (e.g. UUID prefix matches multiple sessions)

## Reserved flags

- `--json` — reserved for a future structured output mode. Currently no-op.
