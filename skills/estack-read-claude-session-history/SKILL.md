---
name: estack-read-claude-session-history
description: (read-claude-session-history) Invoke for ANY task involving Claude Code session history, transcripts, or .jsonl files — this is the only way to read, parse, or search them; do not attempt to use Bash or Read on .jsonl directly. Use for: recovering context after /compact ("what were we doing before compact"), advisor response retrieval ("what did the advisor say"), subagent output collection ("get all subagent finals"), cross-project session search by keyword, session listing and triage, UUID and title lookup, resume-command generation, file-edit and tool-call forensics, session diff between two sessions or subagents, weekly work journal, day timeline of activity blocks and idle gaps, recovering from .claude-backups after data loss, session count queries, and reading the last agent message before a crash or interrupt. Trigger phrases: "session history", "before compact", "what did claude do", "what did I work on", "search my sessions", "find that session", "what did the advisor say", "what did the agent edit", "from the backup", "list my sessions", "subagent outputs", "session journal", "resume previous", "which files did claude touch", "go back and look", "what did I do yesterday", "where did my day go", "timeline of my day", "how much time on".
---

# Read Claude Session History

Search, read, recover, and compare Claude Code session history — across the current session, prior sessions, sibling subagents, all projects, and `.claude-backups` snapshots.

Sessions are stored as `.jsonl` files. Reading them raw is hopeless: 1,000–5,000+ lines of dense JSON per session, 33+ project directories, hundreds of historical sessions. This skill wraps a single CLI that knows the entry schema and exposes ~20 modes.

## Quick start

```bash
PY="C:\Users\2supe\.claude\skills\read-claude-session-history\scripts\read_transcript.py"

# What was the last thing the agent said in this session?
python "$PY" --file <current-session.jsonl> --mode last

# Get a 6-line summary of any session (intent, last activity, edits, tool counts, subagent fanout)
python "$PY" --file <session.jsonl> --mode brief

# Recover what got cut off by the most recent /compact
python "$PY" --file <session.jsonl> --mode pre-compact

# Find a session by UUID prefix across all projects
python "$PY" --mode lookup --uuid abc123de

# Search every session in every project for a phrase
python "$PY" --mode search --all-projects --query "supabase migration"

# Pull subagent outputs from a fan-out investigation
python "$PY" --file <parent.jsonl> --mode subagent-finals

# Block-grouped timeline of a whole day across all sessions, with idle gaps
python "$PY" --mode timeline --date yesterday

# Any mode as structured JSON for piping into the next step
python "$PY" --mode list --project keel --since 7d --format json
```

## Time handling — READ THIS before doing anything with time

**Every time the CLI displays is already the user's local time.** JSONL files store
UTC; the script converts on output. Do NOT add or subtract timezone offsets
yourself, do NOT cross-reference file mtimes to infer the timezone, and do NOT
treat raw `"timestamp"` fields from a .jsonl (which ARE UTC) as comparable to CLI
output. If you need a different zone, pass `--tz` (IANA name like
`America/New_York`, `UTC`, or an offset like `-4`) — never convert manually.
`--since/--until/--date` specs are interpreted in that same display timezone.

## Decision tree

```
What are you trying to do?
│
├─ Read the current session / one specific session
│  ├─ Last assistant message ──────────────────── --mode last
│  ├─ All advisor responses ───────────────────── --mode advisor
│  ├─ Content cut off by /compact ─────────────── --mode pre-compact
│  ├─ Full human-readable dump ────────────────── --mode dump (size-aware)
│  ├─ 6-line summary for triage ───────────────── --mode brief
│  └─ Schema/structural diagnosis ─────────────── --mode debug
│
├─ Find a session I don't have the path for
│  ├─ By UUID prefix ──────────────────────────── --mode lookup --uuid <prefix>
│  ├─ By title or first prompt ────────────────── --mode find --title|--first-prompt
│  └─ Generate a `claude --resume` command ───── --mode resume-cmd --uuid <prefix>
│
├─ Search content
│  ├─ One session ─────────────────────────────── --mode search --file …
│  ├─ One project ─────────────────────────────── --mode search --cwd …
│  ├─ All projects ────────────────────────────── --mode search --all-projects
│  └─ Filter to user msgs / tool-use inputs ──── --role user --in tool_use
│
├─ Forensics on a session
│  ├─ Chronological tool-call log ────────────── --mode changelog
│  ├─ Every file touched ─────────────────────── --mode file-edits
│  └─ Every tool call (optionally filtered) ──── --mode tool-calls --tool Bash,Edit
│
├─ Subagent (fan-out) work
│  ├─ List spawned subagents ─────────────────── --mode subagent-list
│  ├─ Get every subagent's final message ─────── --mode subagent-finals
│  └─ Forensics on one subagent ──────────────── --mode subagent-tools|subagent-files --subagent …
│
├─ Cross-cutting reporting
│  ├─ "What did I do this week?" ──────────────── --mode journal --since 7d
│  ├─ "Where did my day go?" / day timeline ───── --mode timeline --date yesterday
│  ├─ "How much time on <project>?" ───────────── --mode timeline --project <name> --date …
│  ├─ Count sessions matching a query ─────────── --mode count --query …
│  └─ Resume where I left off in this project ─── --mode resume-prev --cwd …
│
└─ Compare two sessions or two sibling subagents
   └─ Interleaved diff ──────────────────────── --mode diff --file-a … --file-b …  (or --subagents-of …)
```

## Quick reference

| Mode | Required flags | Returns |
|---|---|---|
| `last` | `--file` | Last N assistant text outputs |
| `advisor` | `--file` | All `advisor_tool_result` payloads |
| `pre-compact` | `--file` | 40 exchanges before the most recent `/compact` |
| `dump` | `--file` | Human-readable dump (auto-degrades on transcripts >5MB) |
| `search` | `--query` + scope | Matches windowed for context (supports `--role`, `--in text|tool_use|thinking|all`) |
| `debug` | `--file` | Entry/block type distributions + probes |
| `brief` | `--file` | 6-line summary: uuid·project·mtime·status / intent / last / edits / tools / subagents |
| `list` | `--cwd` or `--all-projects` | Rich table: mtime, size, uuid, msg count, flags, status, title |
| `lookup` | `--uuid <prefix>` | Absolute path (exit 1 missing, exit 2 ambiguous) |
| `find` | `--title` or `--first-prompt` | Sessions ranked by recency |
| `resume-cmd` | `--uuid <prefix>` | `cd <cwd>; claude --resume <uuid>` snippet |
| `changelog` | `--file` | `HH:MM:SS  TOOL  one-line-summary`, day-grouped |
| `file-edits` | `--file` | Unique paths sorted with op tags |
| `tool-calls` | `--file` (+ `--tool` filter) | Timestamped per-call blocks |
| `subagent-list` | `--file` | List sibling subagents with agentType + description |
| `subagent-finals` | `--file` | Every subagent's final assistant message |
| `subagent-tools` | `--subagent` | Forensics on one subagent |
| `subagent-files` | `--subagent` | Files one subagent touched |
| `resume-prev` | `--cwd` | Banner + dump-style tail of last 10 exchanges |
| `count` | `--query` (+ scope) | `<N>` to stdout, summary to stderr |
| `journal` | `--since` (+ scope) | Per-session 5-line block: date·uuid / prompt / ended / edits / tools |
| `timeline` | `--date` or `--since/--until` (defaults: today, all projects) | Block-grouped day timeline across sessions with idle gaps + active-time totals |
| `diff` | `--file-a` + `--file-b` OR `--subagents-of` | Timestamp-interleaved A>/B> output |

## Global flags

- `--root {live|mirror|snapshot-24h|snapshot-1w|snapshot-1mo|<abs-path>}` — read from a `.claude-backups` mirror or snapshot instead of live. Default `live`.
- `--cwd <path>` — single-project scope. Use the original working directory (e.g. `"C:\Users\2supe\Other Claude Code"`).
- `--all-projects` — walk every project under `--root`.
- `--project <name>` — filter projects by name substring, case-insensitive, matches encoded or decoded form (`--project keel`, `--project "Other Claude Code"`). Works on `list`, `journal`, `search`, `count`, `find`, `timeline`. Use this instead of `--cwd` when you know the project's name but not its exact path.
- `--file <path>` — single-session scope.
- `--since <spec>` / `--until <spec>` — accepts ISO date, ISO datetime, relative (`30m`, `24h`, `7d`, `1w`, `1mo`), named (`today`, `yesterday`, `now`).
- `--date <spec>` — single-day window for `timeline` (`--date yesterday`, `--date 2026-06-01`).
- `--gap <spec>` — idle-gap threshold for `timeline` blocks (`15m` default, `1h`).
- `--tz <spec>` — display timezone override (IANA name, `UTC`, or offset like `-4`). Default: system local time.
- `--format json` (or `--json`) — structured JSON output on every mode (except the legacy `--list`/`--list-subagents` aliases). Pipe-friendly: paths are strings, timestamps ISO.
- `--exclude-current` — drop the current session (detected via `CLAUDE_SESSION_ID`) from `list`, `journal`, `search`, `count`, and `timeline`.
- `--include-subagents` — fold subagent finals into `brief`, `last`, `dump` output, each tagged `[subagent <id-short> · <agentType>]`.
- `--force-dump` — bypass the 5 MB `dump` guard.
- `-n N` — count modifier (default 5 for `last`, 80 for `dump`, 10 for `resume-prev`).

The current session is marked with `[*]` in `list` output. Status glyphs: ✓ clean, ! interrupted, ? pending-user, ● active. Sessions with a compact marker get `[C]`; sessions with subagents get `[S]`.

## Backup-aware reads

In March 2026 a Claude Code auto-update deleted live `.jsonl` transcripts (GitHub #41591). To survive that class of incident, this machine maintains four backup roots under `C:\Users\2supe\.claude-backups\`:

- `mirror` — continuous mirror
- `snapshot-24h` — 24-hour-old snapshot
- `snapshot-1w` — 1-week-old snapshot
- `snapshot-1mo` — 1-month-old snapshot

Any mode accepts `--root <name>`. The resolved root is printed to stderr.

```bash
# Find a session that was deleted from live but still in yesterday's snapshot
python "$PY" --root snapshot-24h --mode lookup --uuid <prefix>

# Compare today's mirror against a week ago to confirm what was lost
python "$PY" --root snapshot-1w --cwd "C:\Users\2supe\Other Claude Code" --list
```

See `references/recipes.md` → "Deletion-incident recovery" for the full playbook.

## Common workflows

| Need | Command |
|---|---|
| Recover advisor output that scrolled out of context | `--file <session> --mode advisor` |
| Get back to what you were doing before `/compact` | `--file <session> --mode pre-compact` |
| Fan-out triage: 14 subagents, want all of their finals | `--file <parent> --mode subagent-finals` (or `--mode brief --include-subagents`) |
| Find "that session where I asked about supabase rate limits" | `--mode search --all-projects --query "supabase rate limits"` |
| Resume a project after a few days away | `--mode resume-prev --cwd "<project path>"` |
| Daily/weekly journal | `--mode journal --since 7d --all-projects` |
| "Where did yesterday go?" | `--mode timeline --date yesterday` |
| "How much time on Keel today?" | `--mode timeline --project keel --date today` |
| Feed session data into a script | any mode + `--format json` |

See `references/recipes.md` for fuller multi-step workflows.

## Windows notes

- Use `python` (not `python3`) on this Windows setup.
- The script handles UTF-8 stdout/stderr internally — both PowerShell and Bash work fine for single commands.
- **Piping `--format json` into another command: use Bash.** PowerShell 5.1 pipes inject a UTF-8 BOM and re-encode through the console codepage, breaking `json.load` (see `references/recipes.md` §5c for the PowerShell workaround).
- File paths with spaces need quoting: `--cwd "C:\Users\2supe\Other Claude Code"`.

## Reference docs

- `references/modes.md` — complete per-mode reference (every flag, every example, exit codes).
- `references/jsonl-schema.md` — entry/block schema, subagent meta sidecars, compact-marker shape.
- `references/recipes.md` — multi-step workflows (post-compact recovery, find-then-dump, deletion recovery, week-in-review journal, sibling-agent diff).

## When the modes return empty

If a mode returns empty/unexpected output, run `--mode debug` first. It prints the entry-type distribution, content-block types, and probes for advisor + compact markers — useful when the transcript schema has drifted or when a session was truncated.
