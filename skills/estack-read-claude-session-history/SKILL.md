---
name: estack-read-claude-session-history
version: 1.2.1
description: >-
  (read-claude-session-history) Invoke for ANY task involving Claude Code
  session history, transcripts, or .jsonl files - this is the only way to read,
  parse, or search them; do not attempt to use Bash or Read on .jsonl directly.
  Use for: recovering context after /compact ("what were we doing before
  compact"), advisor response retrieval ("what did the advisor say"), subagent
  output collection ("get all subagent finals"), cross-project session search by
  keyword, session listing and triage, UUID and title lookup, resume-command
  generation, file-edit and tool-call forensics, tool- and skill-usage tallies
  ("which skills do I actually use"), session diff between two
  sessions or subagents, weekly work journal, day timeline of activity blocks
  and idle gaps, engagement/attention-time accounting (active vs elapsed time,
  break detection, parallel-chat-safe totals), recovering from .claude-backups
  after data loss, session count queries, and reading the last agent message
  before a crash or interrupt. Trigger phrases: "session history", "before
  compact", "what did claude do", "what did I work on", "search my sessions",
  "find that session", "what did the advisor say", "what did the agent edit",
  "from the backup", "list my sessions", "subagent outputs", "session journal",
  "resume previous", "which files did claude touch", "go back and look", "what
  did I do yesterday", "where did my day go", "timeline of my day", "how much
  time on", "how long did that actually take", "how much did I actually work",
  "active time", "time I spent".
---

# Read Claude Session History

Search, read, recover, and compare Claude Code session history — across the current session, prior sessions, sibling subagents, all projects, and `.claude-backups` snapshots.

Sessions are stored as `.jsonl` files. Reading them raw is hopeless: 1,000–5,000+ lines of dense JSON per session, 33+ project directories, hundreds of historical sessions. This skill wraps a single CLI that knows the entry schema and exposes ~20 modes.

## Quick start

```bash
PY="$HOME/.claude/skills/estack-read-claude-session-history/scripts/read_transcript.py"

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

# How much focused time did today actually consume? (your attention, not Claude's)
python "$PY" --mode engagement --date today

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
│  ├─ Expand a wide search to full windows ───── --full
│  └─ Filter to user msgs / tool-use inputs ──── --role user --in tool_use
│
├─ Forensics on a session
│  ├─ Chronological tool-call log ────────────── --mode changelog
│  ├─ Every file touched ─────────────────────── --mode file-edits
│  ├─ Every tool call (optionally filtered) ──── --mode tool-calls --tool Bash,Edit
│  └─ Which tools/skills do I actually use? ───── --mode tool-usage (+ scope; --tool Skill)
│
├─ Subagent (fan-out) work
│  ├─ List spawned subagents ─────────────────── --mode subagent-list
│  ├─ Get every subagent's final message ─────── --mode subagent-finals
│  └─ Forensics on one subagent ──────────────── --mode subagent-tools|subagent-files --subagent …
│
├─ Cross-cutting reporting
│  ├─ "What did I do this week?" ──────────────── --mode journal --since 7d
│  ├─ "What was I doing, when?" / day map ─────── --mode timeline --date yesterday
│  ├─ "How long did X actually take ME?" ──────── --mode engagement --date … | --project … | --file …
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
| `search` | `--query` + scope | Single file: full match windows. Wide scope (`--cwd`/`--project`/`--all-projects`): per-session summary by default; `--full` expands to windows. Either way the full view is bounded by a char budget and degrades back to a summary (with a note) if it would overflow. Supports `--role`, `--in text\|tool_use\|tool_result\|thinking\|all` |
| `debug` | `--file` | Entry/block type distributions + probes |
| `brief` | `--file` | 6-line summary: uuid·project·mtime·status / intent / last / edits / tools / subagents |
| `list` | `--cwd` or `--all-projects` | Rich table: mtime, size, uuid, msg count, flags, status, title |
| `lookup` | `--uuid <prefix>` | Absolute path (exit 1 missing, exit 2 ambiguous) |
| `find` | `--title` or `--first-prompt` | Sessions ranked by recency |
| `resume-cmd` | `--uuid <prefix>` | `cd <cwd>; claude --resume <uuid>` snippet |
| `changelog` | `--file` | `HH:MM:SS  TOOL  one-line-summary`, day-grouped |
| `file-edits` | `--file` | Unique paths sorted with op tags |
| `tool-calls` | `--file` (+ `--tool` filter) | Timestamped per-call blocks |
| `tool-usage` | `--file` or scope (+ `--tool` filter, `--include-subagents`) | Tool-call tallies by name; `Skill` calls sub-tallied by skill name (counts real invocations, not text) |
| `subagent-list` | `--file` | List sibling subagents with agentType + description |
| `subagent-finals` | `--file` | Every subagent's final assistant message |
| `subagent-tools` | `--subagent` | Forensics on one subagent |
| `subagent-files` | `--subagent` | Files one subagent touched |
| `resume-prev` | `--cwd` | Banner + dump-style tail of last 10 exchanges |
| `count` | `--query` (+ scope) | `<N>` to stdout, summary to stderr |
| `journal` | `--since` (+ scope) | Per-session 5-line block: date·uuid / prompt / ended / edits / tools |
| `timeline` | `--date` or `--since/--until` (defaults: today, all projects) | Map of WHAT was active WHEN: blocks + idle gaps (no attention claim — that's `engagement`) |
| `engagement` | `--date` or `--since/--until` or `--file` (defaults: today, all projects) | YOUR attention time: active vs elapsed + ratio per session, parallel-chat-safe totals, breaks |
| `diff` | `--file-a` + `--file-b` OR `--subagents-of` | Timestamp-interleaved A>/B> output |

## Global flags

- `--root {live|mirror|snapshot-24h|snapshot-1w|snapshot-1mo|<abs-path>}` — read from a `.claude-backups` mirror or snapshot instead of live. Default `live`.
- `--cwd <path>` — single-project scope. Use the original working directory (e.g. `"C:\Users\2supe\Other Claude Code"`).
- `--all-projects` — walk every project under `--root`.
- `--project <name>` — filter projects by name substring, case-insensitive, matches encoded or decoded form (`--project keel`, `--project "Other Claude Code"`). Works on `list`, `journal`, `search`, `count`, `find`, `timeline`, `engagement`, `tool-usage`. Use this instead of `--cwd` when you know the project's name but not its exact path. (Note: for `engagement`, scope filters which sessions are *reported* — the attention stream is always computed across all projects so parallel chats never double-count.)
- `--file <path>` — single-session scope.
- `--full` — for wide-scope `search` (`--cwd`/`--project`/`--all-projects`), expand the default per-session summary into full match windows. Single-file searches (`--file`) are always full and ignore this flag. In every case the full view is bounded by a character budget (~10k tokens); if the windows would overflow it, the output degrades back to the summary with a note.
- `--since <spec>` / `--until <spec>` — accepts ISO date, ISO datetime, relative (`30m`, `24h`, `7d`, `1w`, `1mo`), named (`today`, `yesterday`, `now`).
- `--date <spec>` — single-day window for `timeline` (`--date yesterday`, `--date 2026-06-01`).
- `--gap <spec>` — idle-gap threshold for `timeline` blocks (`15m` default, `1h`).
- `--break <spec>` — break threshold for `engagement` (`10m` default; `5m` strict, `20m` forgiving). Gaps between your prompts longer than this count as breaks unless you replied right after Claude finished working.
- `--tz <spec>` — display timezone override (IANA name, `UTC`, or offset like `-4`). Default: system local time.
- `--format json` (or `--json`) — structured JSON output on every mode (except the legacy `--list`/`--list-subagents` aliases). Pipe-friendly: paths are strings, timestamps ISO.
- `--exclude-current` — drop the current session (detected via `CLAUDE_SESSION_ID`) from `list`, `journal`, `search`, `count`, `timeline`, `engagement`, and `tool-usage`. Useful for `tool-usage` so the very commands you're running now don't skew the tally.
- `--include-subagents` — fold subagent finals into `brief`, `last`, `dump` output, each tagged `[subagent <id-short> · <agentType>]`. For `tool-usage`, folds each session's subagent `tool_use` calls into the tally (the subagent is not counted as a separate session).
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
| "Where did yesterday go?" (map of activity) | `--mode timeline --date yesterday` |
| "How much did I actually work today?" | `--mode engagement --date today` |
| "How much time on Keel today?" | `--mode engagement --project keel --date today` |
| "How long did that session take me?" | `--mode engagement --file <session.jsonl>` |
| "Which skills do I actually use?" | `--mode tool-usage --all-projects --tool Skill` |
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
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-read-claude-session-history: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-read-claude-session-history: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
