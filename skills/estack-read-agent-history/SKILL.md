---
name: estack-read-agent-history
version: 4.0.0
description: >-
  (read-agent-history) Invoke for ANY task involving local AI coding-agent
  session history — Claude Code AND Codex (OpenAI codex-cli) transcripts or
  .jsonl files. Documents where each agent's session data lives, the pitfalls,
  and a CLI + Python library to build on — use the CLI when a mode fits
  (cross-agent modes take --agent claude|codex|both, default both), post-process
  its JSON when one almost fits, write a scratchpad script on the library when
  none does. Never use the Read tool on a raw .jsonl. Use for: recovering
  context after /compact, advisor responses, subagent outputs, cross-project
  keyword search, session listing and triage, UUID/title lookup, resume
  commands, file-edit and tool-call forensics, tool/skill-usage tallies, session
  diffs, work journal, day timeline of activity and idle gaps across BOTH
  agents, attention-time accounting (active vs elapsed, parallel-chat-safe,
  Claude+Codex merged), .claude-backups recovery, and reading the last message
  before a crash. Trigger phrases: "session history", "chat history", "before
  compact", "what did claude do", "what did codex do", "what did I work on",
  "search my sessions", "find that session", "list my sessions", "session
  journal", "resume previous", "what did I do yesterday", "where did my day go",
  "timeline of my day", "how much time on", "active time", "codex sessions",
  "codex history".
---

# Read Agent Session History

Search, read, recover, and analyze local AI coding-agent session history across **two agents** — **Claude Code** and **Codex** (OpenAI codex-cli): the current session, prior sessions, sibling subagents, all projects, and `.claude-backups` snapshots. One CLI reads both.

## The ladder — how to answer any session-history question

1. **A CLI mode fits** → use it. One deterministic command, done. Cross-agent modes read Claude **and** Codex by default (`--agent claude|codex|both`, default `both`).
2. **A mode almost fits** → run it with `--format json` and post-process the output (a python one-liner, jq, grep). Don't contort the question to fit the flags.
3. **No mode comes close** → write a one-off Python script in your scratchpad importing the primitives in `scripts/lib/` (`paths`, `parser`, `search`, `subagents`, `tools`, `codex` — the docstrings are the API reference). They encode the correctness traps below; never re-derive them.
4. **The same gap keeps recurring** → add a small mode or flag to the CLI itself and record it (see "Update this skill" below).

Never use the Read tool on a raw `.jsonl` (Claude **or** Codex), and never hand-roll parsing without `lib.parser` — both schemas have traps (noise entries, tool-result envelopes, UTC timestamps, and Codex's two-layer event/response streams). `lib.parser.parse_lines` auto-detects a Codex rollout and normalizes it into the same shape Claude emits, so every primitive works on both.

Scratch-script boilerplate:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path.home() / ".claude/skills/estack-read-agent-history/scripts"))
from lib import parser, paths, search, subagents, tools, codex
```

## Where sessions live

**Claude Code:**
```
~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl            # one file per session
~/.claude/projects/<encoded-cwd>/<uuid>/subagents/agent-*.jsonl  # subagent transcripts (+ .meta.json)
~/.claude-backups/{mirror,snapshot-24h,snapshot-1w,snapshot-1mo}/projects/…  # backups, same layout
```

`<encoded-cwd>` = the working directory with `:` `\` `/` and whitespace each replaced by `-`. The encoding is **lossy** — never reconstruct a real path from an encoded name; resolve by UUID or content.

**Codex:**
```
~/.codex/sessions/YYYY/MM/DD/rollout-<ISO-ts>-<uuid>.jsonl       # one "rollout" file per session, date-partitioned
```

Codex is date-partitioned (the folder IS the index — `ls ~/.codex/sessions/2026/07/15/`), and each rollout's real cwd/uuid live in its leading `session_meta` line. Both agents' entry schemas: `references/jsonl-schema.md`. The full Codex schema + traps: `references/codex-history.md`.

The current (Claude Code) session ID is: ${CLAUDE_SESSION_ID}
(In a context where that substitution isn't visible — e.g. a subagent — read the real env var `CLAUDE_CODE_SESSION_ID`, or run `--mode whoami`.)

## Quick lookups (CLI)

```bash
PY="$HOME/.claude/skills/estack-read-agent-history/scripts/read_transcript.py"
```

| Need | Command |
|---|---|
| THIS session's path | `python "$PY" --mode whoami --cwd "<cwd>"` |
| UUID prefix → path (either agent) | `python "$PY" --mode lookup --uuid abc123de` |
| List sessions (both agents) | `python "$PY" --mode list --all-projects --since 7d` |
| Keyword search everywhere | `python "$PY" --mode search --all-projects --query "supabase migration"` |
| 6-line session summary (either agent) | `python "$PY" --file <session-or-rollout.jsonl> --mode brief` |
| Last assistant / **user** message | `python "$PY" --file <s.jsonl> --mode last [--role user\|both]` |
| Pre-/compact recovery | `python "$PY" --file <session.jsonl> --mode pre-compact` |
| All subagent finals | `python "$PY" --file <parent.jsonl> --mode subagent-finals` |
| Day overview / "what did I do" | `python "$PY" --mode session-report --date yesterday` |
| Activity map with idle gaps | `python "$PY" --mode timeline --date yesterday` |
| My real attention time | `python "$PY" --mode engagement --date today` |
| Just one agent | add `--agent codex` (or `--agent claude`) to any cross-agent mode |
| `claude --resume` snippet | `python "$PY" --mode resume-cmd --uuid <prefix>` |

**Both agents by default.** The cross-session modes merge Claude Code **and** Codex over one deduped prompt stream (parallel chats split the clock, never double-count); narrow with `--agent claude|codex`. Single-file modes (`--file`) auto-detect a Codex rollout — no flag needed.

Every mode takes `--format json` (a `source: "claude"|"codex"` field tags each session). Full reference (every mode, flags, exit codes, JSON shapes, the time-accounting semantics, `--agent`, and presentation defaults for day reviews): `references/modes.md`. Codex schema + gotchas: `references/codex-history.md`. Multi-step workflows: `references/recipes.md`.

## Pitfalls

- **Timestamps in both agents' .jsonl files are UTC.** CLI output and `lib.parser` conversions are already local — never mix raw with converted, never hand-add offsets. (Codex conveniently puts a top-level `timestamp` on every line; Claude on every entry.) Report times to the user in 12-hour format unless asked otherwise.
- **Raw entry counts lie — in both agents.** Claude `type:user` includes tool-result envelopes and hook/skill `isMeta` injections; `type:assistant` includes tool-only turns. Codex has TWO parallel layers (`event_msg` vs `response_item`) that mirror the same messages — count from one, not both, or you double. The CLI/`lib.parser` already handle this; never hand-tally.
- **Never hand-roll cross-agent time math.** The shared top-level `timestamp` tempts a `grep`+`awk` hack with a hardcoded UTC offset — `timeline`/`engagement` already merge both agents correctly.
- **A live transcript's last line may be truncated** — `lib.parser.iter_lines` handles it (Claude and Codex); bare `json.loads` per line crashes.
- **Bound your output.** Cross-project/cross-agent sweeps can emit tens of thousands of tokens; summarize per session, expand selectively.
- **Windows:** use `python` (not `python3`); pass Windows-style paths into Python (POSIX paths from Bash cause `FileNotFoundError`); run JSON pipe chains in Bash — PowerShell 5.1 pipes inject a BOM.
- **Empty/weird results** → `--mode debug` prints the entry-type distribution and probes for schema drift. Codex reasoning is usually encrypted (`summary: []`), so `--in thinking` on a Codex session is often empty — that's expected, not drift.

## Backups

Four roots under `C:\Users\2supe\.claude-backups\` survive transcript-deletion incidents (like the March 2026 auto-update bug, GitHub #41591): `mirror`, `snapshot-24h`, `snapshot-1w`, `snapshot-1mo`. Every CLI mode accepts `--root <name>`; recovery playbook in `references/recipes.md`.

## Update this skill with what you learn

Every hard use is a field test. If a technique worked well, a documented claim misled you, the schema drifted (Claude **or** Codex), or you hit ladder step 4 (a recurring gap worth a deterministic fix), tell the user and update the skill at its source: the e-stack repo (`C:\Users\2supe\All Coding\E-Stack\e-stack`, `skills/estack-read-agent-history/`), via that repo's `manage-e-stack` flow. Techniques go in `references/recipes.md`, Claude schema findings in `references/jsonl-schema.md`, Codex schema findings in `references/codex-history.md`, new modes in the CLI + `references/modes.md`. Don't edit the installed copy under `~/.claude/skills/` — the installer overwrites it. No repo on this machine → offer to file it as a GitHub issue (below).
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-read-agent-history: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-read-agent-history: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
