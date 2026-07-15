---
name: estack-read-claude-session-history
version: 2.0.0
description: >-
  (read-claude-session-history) Invoke for ANY task involving Claude Code
  session history, transcripts, or .jsonl files. Documents where session data
  lives, the pitfalls, and a CLI + Python library to build on — use the CLI
  when a mode fits, post-process its JSON when one almost fits, write a
  scratchpad script on the library when none does. Never use the Read tool on
  a .jsonl directly (1,000–5,000+ lines of dense JSON per session). Use for:
  recovering context after /compact ("what were we doing before compact"),
  advisor response retrieval ("what did the advisor say"), subagent output
  collection ("get all subagent finals"), cross-project session search by
  keyword, session listing and triage, UUID and title lookup, resume-command
  generation, file-edit and tool-call forensics, tool- and skill-usage tallies
  ("which skills do I actually use"), session diff between two sessions or
  subagents, weekly work journal, day timeline of activity blocks and idle
  gaps, engagement/attention-time accounting (active vs elapsed time, break
  detection, parallel-chat-safe totals), recovering from .claude-backups after
  data loss, session count queries, and reading the last user or agent message
  before a crash or interrupt. Trigger phrases: "session history", "before
  compact", "what did claude do", "what did I work on", "search my sessions",
  "find that session", "what did the advisor say", "what did the agent edit",
  "from the backup", "list my sessions", "subagent outputs", "session
  journal", "resume previous", "which files did claude touch", "go back and
  look", "what did I do yesterday", "where did my day go", "timeline of my
  day", "give me an overview", "how much time on", "how long did that actually
  take", "how much did I actually work", "active time", "time I spent".
---

# Read Claude Session History

Search, read, recover, and analyze Claude Code session history — the current session, prior sessions, sibling subagents, all projects, and `.claude-backups` snapshots.

## The ladder — how to answer any session-history question

1. **A CLI mode fits** → use it. One deterministic command, done.
2. **A mode almost fits** → run it with `--format json` and post-process the output (a python one-liner, jq, grep). Don't contort the question to fit the flags.
3. **No mode comes close** → write a one-off Python script in your scratchpad importing the primitives in `scripts/lib/` (`paths`, `parser`, `search`, `subagents`, `tools` — the docstrings are the API reference). They encode the correctness traps below; never re-derive them.
4. **The same gap keeps recurring** → add a small mode or flag to the CLI itself and record it (see "Update this skill" below).

Never use the Read tool on a raw `.jsonl`, and never hand-roll parsing without `lib.parser` — the schema has traps (noise entries, tool-result envelopes, UTC timestamps).

Scratch-script boilerplate:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path.home() / ".claude/skills/estack-read-claude-session-history/scripts"))
from lib import parser, paths, search, subagents, tools
```

## Where sessions live

```
~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl            # one file per session
~/.claude/projects/<encoded-cwd>/<uuid>/subagents/agent-*.jsonl  # subagent transcripts (+ .meta.json)
~/.claude-backups/{mirror,snapshot-24h,snapshot-1w,snapshot-1mo}/projects/…  # backups, same layout
```

`<encoded-cwd>` = the working directory with `:` `\` `/` and whitespace each replaced by `-`. The encoding is **lossy** — never reconstruct a real path from an encoded name; resolve by UUID or content. Entry/block schema: `references/jsonl-schema.md`.

The current session ID is: ${CLAUDE_SESSION_ID}
(In a context where that substitution isn't visible — e.g. a subagent — read the real env var `CLAUDE_CODE_SESSION_ID`, or run `--mode whoami`.)

## Quick lookups (CLI)

```bash
PY="$HOME/.claude/skills/estack-read-claude-session-history/scripts/read_transcript.py"
```

| Need | Command |
|---|---|
| THIS session's path | `python "$PY" --mode whoami --cwd "<cwd>"` |
| UUID prefix → path | `python "$PY" --mode lookup --uuid abc123de` |
| List sessions | `python "$PY" --mode list --project keel --since 7d` |
| Keyword search everywhere | `python "$PY" --mode search --all-projects --query "supabase migration"` |
| 6-line session summary | `python "$PY" --file <session.jsonl> --mode brief` |
| Last assistant / **user** message | `python "$PY" --file <s.jsonl> --mode last [--role user\|both]` |
| Pre-/compact recovery | `python "$PY" --file <session.jsonl> --mode pre-compact` |
| All subagent finals | `python "$PY" --file <parent.jsonl> --mode subagent-finals` |
| Day overview / "what did I do" | `python "$PY" --mode session-report --date yesterday` |
| Activity map with idle gaps | `python "$PY" --mode timeline --date yesterday` |
| My real attention time | `python "$PY" --mode engagement --date today` |
| `claude --resume` snippet | `python "$PY" --mode resume-cmd --uuid <prefix>` |

Every mode takes `--format json`. Full reference (all ~20 modes, flags, exit codes, JSON shapes, the time-accounting semantics, and presentation defaults for day reviews): `references/modes.md`. Multi-step workflows: `references/recipes.md`.

## Pitfalls

- **Timestamps inside .jsonl files are UTC.** CLI output and `lib.parser` conversions are already local — never mix raw with converted, never hand-add offsets. Report times to the user in 12-hour format unless asked otherwise.
- **Raw entry counts lie.** `type:user` includes tool-result envelopes and hook/skill `isMeta` injections; `type:assistant` includes tool-only turns. Use the CLI's counts or `lib.parser` classification.
- **A live transcript's last line may be truncated** — `lib.parser.iter_lines` handles it; bare `json.loads` per line crashes.
- **Bound your output.** Cross-project sweeps can emit tens of thousands of tokens; summarize per session, expand selectively.
- **Windows:** use `python` (not `python3`); pass Windows-style paths into Python (POSIX paths from Bash cause `FileNotFoundError`); run JSON pipe chains in Bash — PowerShell 5.1 pipes inject a BOM.
- **Empty/weird results** → `--mode debug` prints the entry-type distribution and probes for schema drift.

## Backups

Four roots under `C:\Users\2supe\.claude-backups\` survive transcript-deletion incidents (like the March 2026 auto-update bug, GitHub #41591): `mirror`, `snapshot-24h`, `snapshot-1w`, `snapshot-1mo`. Every CLI mode accepts `--root <name>`; recovery playbook in `references/recipes.md`.

## Update this skill with what you learn

Every hard use is a field test. If a technique worked well, a documented claim misled you, the schema drifted, or you hit ladder step 4 (a recurring gap worth a deterministic fix), tell the user and update the skill at its source: the e-stack repo (`C:\Users\2supe\All Coding\E-Stack\e-stack`, `skills/estack-read-claude-session-history/`), via that repo's `manage-e-stack` flow. Techniques go in `references/recipes.md`, schema findings in `references/jsonl-schema.md`, new modes in the CLI + `references/modes.md`. Don't edit the installed copy under `~/.claude/skills/` — the installer overwrites it. No repo on this machine → offer to file it as a GitHub issue (below).
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
