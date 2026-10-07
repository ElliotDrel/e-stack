# Mode reference (convenience CLI)

Every mode of `read_transcript.py`, with all flags, exit codes, and worked examples.

When a question is close to a mode but not identical, run the mode with `--format json` and post-process, or read the mode's source and adapt it in a scratchpad script on `scripts/lib/` — don't contort the question to fit these flags.

For the JSONL schema, see `jsonl-schema.md`. For multi-step workflows, see `recipes.md`.

## CLI grammar

```
python read_transcript.py [--root <root>] [--cwd <path> | --all-projects | --project <name> | --file <path>]
                          [--since <spec>] [--until <spec>] [--tz <spec>] [--agent claude|codex|both]
                          --mode <mode> [mode-specific flags]
                          [--format json] [--exclude-current] [--include-subagents] [-n N]
                          [--force-dump]
```

Global flag notes:
- `--since <spec>` / `--until <spec>` — the time window is half-open `[since, until)`: `since` is inclusive, `until` is exclusive, so an event stamped exactly at `--until` is not included. This holds for every message-level mode (`search`, `timeline`, `engagement`, `session-report`, `tool-usage`). Session-level modes (`list`, `journal`, `count`) instead filter whole sessions by file mtime, so a session last written at or before `--until` is shown.
- `--project <name>` — case-insensitive substring filter on project directory names (encoded or decoded form). Applies to `list`, `journal`, `search`, `count`, `find`, `timeline`, `engagement`, `session-report`, `tool-usage`. Exit 1 when nothing matches.
- `--tz <spec>` — display timezone: IANA name (`America/New_York`), `UTC`, or fixed offset (`+5`, `-4`, `+05:30`, `UTC-4`). Default is system local time. All displayed timestamps AND `--since/--until/--date` interpretation use this zone.
- `--agent {claude,codex,both}` — which agent's history the **cross-session** modes read. Default `both`. Applies to `list`, `journal`, `timeline`, `engagement`, `session-report`, `count`, `tool-usage`, `lookup`, `find`, and `search`. Codex sessions live at `~/.codex/sessions` (see `codex-history.md`); they are folded into the SAME merged stream as Claude for timeline/engagement/session-report, so parallel Claude/Codex chats split the clock rather than double-count. `--agent` is ignored by Claude-only modes (`whoami`, `resume-cmd`, `subagent-*`) and by single-`--file` modes (a Codex rollout passed via `--file` is auto-detected). JSON output tags every session with `source: "claude"|"codex"`; text output prefixes Codex sessions with `codex ▹`. Codex discovery is enabled only against the live `--root` (or when `ESTACK_CODEX_SESSIONS_DIR` is set) — backups/custom roots have no Codex tree.
- **Clock format:** the report modes (`session-report`, `engagement`, `timeline`) render every time-of-day as 12-hour with the 24-hour value in parens — `7:00pm (19:00)` — and date-prefix it (`2026-06-19 7:00pm (19:00)`) when the window spans more than one day; their headers carry a `12h (24h)` label. Forensic modes (`changelog`, `tool-calls`) keep `HH:MM:SS` for density. JSON output is always ISO-8601 (unaffected by the 12-hour rendering).
- `--format json` — structured output on every mode. Shapes per mode are listed below.

---

## Single-session modes

### `last`

Last N messages with text, filtered by role.

```bash
python read_transcript.py --file <path> --mode last [-n 5] [--role user|assistant|both]
```

- Default N = 5; default role = `assistant` (backwards-compatible).
- `--role user` answers "what was the last thing *I* said" — real typed prompts only: compact continuations and hook/skill `isMeta` injections are excluded. `--role both` interleaves.
- With `--include-subagents`, appends each subagent's final assistant message tagged `[subagent <id-short> · <agentType>]` (text output only — on `last`/`dump` the JSON shape omits subagents; use `brief --format json --include-subagents` or `subagent-finals` for structured subagent output).
- JSON shape includes a `role` field per message.

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

Human-readable conversation dump, filtered by role and time window.

```bash
python read_transcript.py --file <path> --mode dump [--role user|assistant|both] \
    [--since T1] [--until T2] [-n N] [--include-subagents] [--force-dump]
```

- **`--role`** filters to one speaker. `/compact` markers survive the filter — they're structure, not a turn. Default `both`.
- **`--since` / `--until`** bound the window, half-open `[since, until)`. Both apply to the message timestamps, not the file's mtime.
- **`-n`** caps the result to the last N messages *after* filtering; default 80, **`-n 0` = no limit**, and a negative value is rejected rather than silently chopping from the front. When a cap bites, a note goes to stderr naming how many were withheld — no note means you got the whole window. (`-n 5` means 5. Until 2026-08-17 the value 5 doubled as the "unspecified" sentinel, so an explicit `-n 5` silently returned 80.)
- The header line reports `(<shown> of <total> messages[ in window][, <role> only])` so the scope of what you're reading is always on the page.

**Size-aware fallback:** transcripts larger than 5 MB auto-degrade to `pre-compact` (or `last` if no compact marker), with a stderr note. Override with `--force-dump`. **A `--since`/`--until` window suppresses the fallback** — the window already bounds the output, so a big file on disk is not a reason to degrade.

*History: before 2026-08-17, `--role`, `--since`, and `--until` were accepted and silently ignored here — a 5-minute window returned the whole session's last 50 messages of both roles. If you find behavior like that in another mode, treat it as a bug and fix it rather than working around it; silent no-op flags are what push callers into hand-rolling parsers.*

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

### `whoami`

Resolve the CURRENT live session (via the `CLAUDE_CODE_SESSION_ID` env var — the real OS variable Claude Code sets in a live session's process environment, checked first; `CLAUDE_SESSION_ID` is checked second as a compatibility fallback) to its absolute `.jsonl` path — no listing, no eyeballing timestamps.

```bash
python read_transcript.py --mode whoami [--cwd <path>]
```

- `--cwd` scopes the lookup to one project first (fast path); if that misses (wrong or nonexistent project dir) or is omitted, it scans every project under `--root` until the UUID matches — never fails just because `--cwd` didn't resolve.
- Exit 0: prints `<uuid>` / `<path>` / `project: <name>` (three lines), or the JSON equivalent with `--format json`.
- Exit 1: neither env var is set (not running inside a live session), or one is set but no matching file was found under `--root`.
- SKILL.md's `${CLAUDE_SESSION_ID}` template variable already gives you the raw UUID for free when this skill's Markdown is loaded — that's a *different* mechanism (a text substitution the harness performs on SKILL.md itself, never a real env var). Reach for `whoami` when you need the actual file *path* (or a JSON-shaped result), or when resolving from a context (e.g. a subagent) where that substitution isn't visible.

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

# Expand a wide search to full match windows
python read_transcript.py --all-projects --mode search --query "<q>" --full
```

Flags:
- `--role {user,assistant,both}` (default `both`)
- `--in {text,tool_use,tool_result,thinking,all}` (default `text`)
- `--full` — wide scope only (see Output below)
- `--since` / `--until`

`--in tool_use` searches the `name + JSON-stringified input` of every `tool_use` block — useful for finding "the session where I ran `git push --force`".

`--in thinking` searches `thinking` blocks (model reasoning).

`--in tool_result` searches the text content of `tool_result` blocks (what tools returned). `--in all` covers text + tool_use + tool_result + thinking.

**Output.** A single-file search (`--file`) prints full match windows. A wide search (`--cwd` / `--project` / `--all-projects`) prints a **per-session summary** by default — one line per session (`mtime · uuid8 · project · hit-count · first snippet`), sorted newest first, with a header counting total hits and sessions. This keeps cross-project searches well under the harness's ~25k-token Read cap instead of dumping tens of thousands of tokens that the reader then refuses. Add `--full` to expand a wide search into full windows. In every case the full view (single-file, or wide + `--full`) is bounded by a character budget (~10k tokens) and degrades back to the summary with a note if it would overflow — so even a single huge session can't blow the Read cap. Sessions past the 200-line summary cap are counted in a footer, never silently dropped. JSON mirrors this: wide scope returns compact per-session metadata (`uuid`, `project`, `hits`, `first_snippet`) by default, full per-match objects (with `window`) under `--full`.

Progress (`Searching i/N…`) prints to stderr only when stderr is an interactive terminal — captured/piped runs stay clean.

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

Output: `mtime  size  agent-id  type=<agentType>  "<description>"`.

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
python read_transcript.py --mode journal --since 7d [--cwd <path> | --all-projects | --project <name>]
```

JSON shape: array of session-summary objects (same fields as `list`).

### `timeline`

Block-grouped activity timeline across all sessions in a time window, with idle
gaps. Answers "what was I doing, when?". It is a *map* of session activity —
Claude's work included — and makes no claim about attention time; for "how much
time did this consume?" use `engagement`. Defaults to all projects and today.

```bash
# Yesterday, everything
python read_transcript.py --mode timeline --date yesterday

# One project, today, stricter idle threshold
python read_transcript.py --mode timeline --project keel --date today --gap 5m

# Arbitrary window
python read_transcript.py --mode timeline --since 2026-06-01 --until 2026-06-03

# A busy day, kept readable: 4 busiest sessions per block
python read_transcript.py --mode timeline --date yesterday --max-per-block 4
```

**Codex review gates are filtered out by default** (here and in `session-report`). Codex records its internal review/approval step as a session of its own, titled `The following is the Codex agent history…`; on a heavy day these outnumber the real sessions and bury the shape of the day. The footer names how many were hidden. `--keep-review-gates` includes them.

**`--max-per-block N`** lists only the N busiest sessions in each block and collapses the rest to one `… N quieter session(s) — M msgs` line. `0` (default) shows everything. Useful when a single block holds a dozen parallel chats. It trims the **text render only**: `--format json` returns every session, because a JSON caller asked for the data. Gate filtering does apply to JSON, and `totals.review_gates_hidden` reports it there.

How it works: every signal-message timestamp in the window is an activity event;
events across all sessions are merged chronologically and grouped into blocks
separated by gaps longer than `--gap` (default 15m). Each block lists the sessions
active in it with message counts; idle gaps are printed between blocks; a totals
line gives block count, span, and session count.

Flags:
- `--date <spec>` — single-day window (midnight to midnight). Wins over `--since/--until`.
- `--since/--until` — arbitrary window (until defaults to now).
- `--gap <spec>` — idle threshold: `15m`, `20`, `1h`.
- `--cwd` / `--project` / `--all-projects` — scope (default: all projects).
- `--tz` — display timezone (timestamps render in it; the window is interpreted in it).

JSON shape: `{since, until, gap_minutes, blocks: [{start, end, duration_minutes,
sessions: [{uuid, project, title, path, events}]}], totals: {blocks,
span_minutes, sessions}}`.

### `engagement`

Attention-time accounting: how much focused time a window, project, or session
actually consumed — *your* time, not Claude's. Answers "how long did X actually
take me?". Defaults to all projects and today; with `--file` and no time flags,
the window is the session's own first→last prompt.

```bash
# Today's real work time, everything
python read_transcript.py --mode engagement --date today

# One project over a week
python read_transcript.py --mode engagement --project keel --since 7d

# One session, strict 5-minute break threshold
python read_transcript.py --mode engagement --file <session.jsonl> --break 5m
```

How it works — three deterministic rules over ONE merged stream:

1. Real user prompts (typed messages and slash commands — not tool results,
   hook/skill injections, or compact continuations) from EVERY project are
   merged into a single chronological stream. A gap between consecutive prompts
   ≤ `--break` (default 10m) counts fully as active time, attributed to the
   session of the *later* prompt — the chat being read/typed in. One stream
   means a moment of wall clock is never counted twice across parallel chats.
2. A longer gap still counts in full if Claude was working in that session
   during the gap and the user replied within `--break` of Claude's last event
   (sitting-there-waiting credit). Long runs you walked away from get nothing.
3. Everything else is a break and contributes zero. A session left open with no
   prompts accrues nothing.

Output: one row per session (active, ratio = active/elapsed, `you`/`ai` message
counts, first–last), a totals line (already interval-merged — safe to quote),
breaks in the merged stream, and (single-session view) median/p90 prompt gaps.
Ratio is capped at 1.0: composing time leading into a chat's first prompt is
credited to that chat, so raw active can slightly exceed its first–last span.

Message counts are honest, not raw entry counts: `you` (`user_messages`) is real
typed prompts only — tool-result envelopes, hook/skill `isMeta` injections, and
compact continuations are excluded; `ai` (`assistant_messages`) is assistant
turns bearing visible text — tool-only turns don't count. Both are windowed to
`[since, until)`.

Scoping caveat: `--project`/`--cwd`/`--file` filter which sessions are
*reported*; the stream is always computed across all projects under `--root` so
parallel-chat math stays correct. A scoped total can be less than the global
total for the same window.

Flags:
- `--break <spec>` — break threshold: `5m`, `20m`, `1h` (default 10m).
- `--date` / `--since` / `--until` — window (same semantics as timeline).
- `--cwd` / `--project` / `--all-projects` / `--file` — reporting scope.
- `--tz` — display timezone.
- `--exclude-current` — drop the current session from stream and report.

JSON shape: `{since, until, break_minutes, sessions: [{uuid, project, title,
path, first, last, elapsed_minutes, active_minutes, active_seconds, ratio,
user_messages, assistant_messages}], totals: {sessions, active_minutes,
active_seconds, span_minutes}, stream_breaks: [{start, end, minutes}]}`.

### `session-report`

The per-session "what did I do" day review. Same windowed, overlap-safe
attention engine as `engagement`, but rendered as one numbered block per
session, **chronological** (oldest first by first prompt), carrying everything a
human review needs in a single call — so a "break down my day" answer doesn't
require stitching `timeline` + `lookup` + `engagement` + raw message counts by
hand.

```bash
# Yesterday, every project
python read_transcript.py --mode session-report --date yesterday

# Just the evening — omit --date so --since/--until take effect
python read_transcript.py --mode session-report --since "2026-06-19 19:00" --until "2026-06-20 00:00"

# Include Codex's internal review-gate pseudo-sessions (hidden by default)
python read_transcript.py --mode session-report --date yesterday --keep-review-gates
```

**Hidden review gates leave the list, not the total.** A gate's attention time was already deduped against the global stream, so subtracting it would understate the day. The rendered total and `totals.active_minutes` both count hidden sessions; the footer and `totals.review_gates_hidden` say how many rows were held back. Only the session *rows* disappear.

```bash
# One project
python read_transcript.py --mode session-report --project keel --date today
```

Each block shows: title, project, first–last span with **both clocks** —
`ran` (the session's own first→last elapsed, which can overlap other sessions)
and `active` (deduped attention, parallel chats never double-counted) — then
`you`/`assistant` message counts (same honest definitions as `engagement`),
files edited, the `intent` (first prompt) and `last` (final assistant message).
The intent/last are raw inputs for you to synthesize a one-sentence description
from, not the description itself. A totals line closes with deduped active time
and the overlap-inclusive span.

Flags: same as `engagement` (`--break`, `--date`/`--since`/`--until`,
`--cwd`/`--project`/`--all-projects`, `--tz`, `--exclude-current`). As with
`engagement`, `--date` takes precedence over `--since`/`--until`; to scope to a
sub-window of a day, pass `--since`/`--until` and omit `--date`.

JSON shape: `{since, until, break_minutes, sessions: [{uuid, project, title,
path, first, last, elapsed_minutes, active_minutes, user_messages,
assistant_messages, edits, intent, last_message}], totals: {sessions,
active_minutes, span_minutes}}`. Sessions are ordered chronologically.

#### Presentation defaults for a human day-review

When the user asks a natural-language "what did I do" / "review my day" question, lead with `session-report` and present it this way unless told otherwise:

- **Number the sessions** into clear blocks; drop UUIDs (noise in a human review — surface them only for resume/lookup).
- **One to two sentences per session**, synthesized from `intent` + `last` + files — not a raw dump of either.
- **Show both clocks and name the overlap once**: `active` is deduped attention (parallel chats never double-counted); `ran`/elapsed is the session's own span and *will* overlap others.
- **Trust the mode's counts** — never hand-count raw `type:user`/`type:assistant` entries (tool-result envelopes inflate "user"; multi-block turns inflate "assistant").
- **12-hour time** as the report modes emit it (`7:00pm (19:00)`); switch to 24-hour only on request.
- Sub-window of a day: pass `--since/--until` and omit `--date` (`--date` wins).

For a normal day (16–20 sessions) `session-report` text output stays well within the read budget; prefer it over `--mode list --format json`.

### `tool-usage`

Tally tool calls by tool name; `Skill` calls are sub-tallied by skill name. Answers "which tools / skills do I actually use".

```bash
# Every tool across one session
python read_transcript.py --file <path> --mode tool-usage

# Skill usage across every project (the "what skills do I actually use" question)
python read_transcript.py --all-projects --mode tool-usage --tool Skill

# One project, last 30 days
python read_transcript.py --project keel --mode tool-usage --since 30d
```

Scope is `--file` (one session) or `--cwd` / `--project` / `--all-projects`. `--tool` narrows to a comma-separated subset (e.g. `--tool Skill` for a skills-only view, `--tool Bash,Edit`). `--since/--until` bound the calls by their own timestamp (not file mtime — a session modified after `--until` is still read so in-window calls are counted). `--exclude-current` drops the current session so the commands you're running now don't skew the count. `--include-subagents` folds each session's `agent-*.jsonl` tool calls into its tally — needed to capture skills invoked inside fan-out subagents (the subagent is not counted as a separate session).

Why this exists: it counts real **invocations** — a `tool_use` block whose `name` is the tool (and, for skills, `input.skill`). Text-based modes like `search --in tool_use` and `count` match the *string* "ast-grep" wherever it appears (a `CLAUDE.md` instruction, a bash command, even your own search commands this session), so they over-count. `tool-usage` keys on structure and is immune to that.

Text output: one `<count>  <ToolName>` row per tool, sorted by count descending; under the `Skill` row, a tree of `<count> <skill-name>` sub-rows. A leading line gives the grand total and number of sessions with calls.

```
Tool calls (66 total across 43 session(s)):
     66  Skill
         ├ 38 manage-e-stack
         ├ 9 commit
         └ ...
```

JSON shape: `{total, sessions, tools: [{tool, count}], skills: [{skill, count}]}` (both lists sorted by count descending; `skills` is empty unless `Skill` calls were counted).

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

## JSON shapes per mode (`--format json`)

| Mode | Shape |
|---|---|
| `last` | `[{n_from_end, role, timestamp, text}]` |
| `advisor` | `[<advisor text>, …]` |
| `pre-compact` | `{found_compact, messages: [{role, timestamp, is_compact, text}]}` |
| `dump` | `[{role, timestamp, is_compact, text}]` |
| `debug` | `{entry_types, block_types, advisor_blocks, compact_markers}` |
| `brief` | session-summary object (+ `subagent_finals` with `--include-subagents`) |
| `list` / `journal` / `find` | array of session-summary objects |
| `lookup` | `{prefix, path, matches}` (same exit codes as text) |
| `resume-cmd` | `{uuid, path, project, encoded, command}` |
| `changelog` | `[{timestamp, tool, summary}]` |
| `tool-calls` / `subagent-tools` | `[{timestamp, tool, summary, input}]` |
| `tool-usage` | `{total, sessions, tools: [{tool, count}], skills: [{skill, count}]}` |
| `file-edits` / `subagent-files` | `[{path, ops}]` |
| `search` | single-file or `--full`: `[{session, mtime_iso, role, where, timestamp, window}]`; wide scope default: `[{session, uuid, project, mtime_iso, hits, first_snippet}]` |
| `count` | `{sessions, messages, matches}` |
| `subagent-list` | `[{id, agentType, description, path, size_kb, mtime_iso}]` |
| `subagent-finals` | `[{id, agentType, text}]` |
| `resume-prev` | `{session, path, mtime_iso, messages}` |
| `diff` | `{a, b, messages: [{source, role, timestamp, text}]}` |
| `timeline` | see the `timeline` section above |
| `engagement` | see the `engagement` section above |
| `session-report` | see the `session-report` section above |

Session-summary object fields: `path, uuid, mtime, mtime_iso, size, exists, title,
first_prompt, last_assistant, last_activity, msg_count, edit_count, tool_counts,
files_touched, subagent_count, subagent_types, has_compact, has_subagents, cwd,
decoded_project, status, is_current`.

## Exit codes

- `0`: success
- `1`: missing required flag, no match (including `--project` with zero matches), or file not found
- `2`: ambiguous result (e.g. UUID prefix matches multiple sessions)
