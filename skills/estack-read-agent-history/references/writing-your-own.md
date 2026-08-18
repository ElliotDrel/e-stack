# Writing your own script against session history

The CLI covers the common questions. Yours will often be narrower than any mode — "how many minutes between his first and last message in this stretch," "which prompts mention the waitlist," "line up two sessions on one clock." Write the script. This page is how to write a good one in fifteen lines instead of a bad one in fifty.

Start here, always:

```python
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path.home() / ".claude/skills/estack-read-agent-history/scripts"))
from lib import parser, paths, search, subagents, tools, codex

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
```

Both lines earn their place: the `sys.path` insert is what gets you the schema handling, and the `reconfigure` is what stops a cp1252 console from killing the script on the first em dash. `errors="replace"` also absorbs unpaired surrogates, which plain UTF-8 does not.

## The four calls that cover most scripts

```python
lines = parser.parse_lines(Path(session_path))   # Path — not str, not an open file
msgs  = parser.get_messages(lines)               # drops noise, tool envelopes, isMeta injections
msgs  = parser.filter_by_time(msgs, since, until)  # local datetimes, half-open [since, until)
msgs  = parser.filter_by_role(msgs, "user")        # "user" | "assistant" | "both"
```

`get_messages` returns dicts shaped like:

```python
{
  "role": "user",              # or "assistant"
  "texts": ["...", "..."],     # human-readable text blocks, already extracted
  "timestamp": "2026-08-17T14:41:21.768000",   # already local
  "is_compact": False,         # True for a /compact boundary marker
  "line_index": 12,            # index back into `lines`, for reaching the raw entry
}
```

Three things that save you from re-deriving them:

- **`texts` is already extracted.** Don't walk `entry["message"]["content"]` yourself; `parser.extract_text_blocks` did it, including advisor results and (optionally) thinking and tool_use blocks.
- **Timestamps are already local.** They arrive UTC in the file; `parser` converts. Never add an offset by hand, and never compare a converted timestamp against a raw one.
- **`get_messages` already excludes the liars** — tool-result envelopes that look like user messages, hook/skill `isMeta` injections, and tool-only assistant turns. Counting raw `type:user` entries overcounts badly.

## Worked example — the one people rewrite most

"What did Elliot actually ask for between 4:50pm and 5:05pm, and how long was that?"

```python
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path.home() / ".claude/skills/estack-read-agent-history/scripts"))
from lib import parser

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SESSION = Path(r"C:\Users\2supe\.claude\projects\C--Users-2supe-Some-Project\<uuid>.jsonl")
SINCE = datetime(2026, 8, 17, 16, 50)
UNTIL = datetime(2026, 8, 17, 17, 5)

msgs = parser.filter_by_role(
    parser.filter_by_time(parser.get_messages(parser.parse_lines(SESSION)), SINCE, UNTIL),
    "user",
)

for m in msgs:
    print(m["timestamp"][11:19], "|", " ".join(m["texts"])[:100].replace("\n", " "))

if msgs:
    span = (datetime.fromisoformat(msgs[-1]["timestamp"][:19])
            - datetime.fromisoformat(msgs[0]["timestamp"][:19]))
    print(f"\n{len(msgs)} prompts across {span}")
```

Before writing this one: `--mode dump --role user --since --until` already does it. Reach for the script when you need the *numbers* out of it, not the text.

## Subagents and Codex

```python
subs = paths.list_subagents(parent_path)      # agent-*.jsonl sidecars next to a session
lines = parser.parse_lines(sub)               # same shape — sidecars parse identically
```

Codex rollouts (`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`) need no special handling: `parse_lines` detects them and normalizes into the Claude shape, so every snippet above works unchanged. Its two-layer `event_msg`/`response_item` duplication is already collapsed — hand-tallying a Codex file doubles every count.

## Where to put intermediate files

The session scratchpad, with a full Windows path. Never `/tmp`: Bash writes it to `AppData\Local\Temp` while Python reads `C:\tmp`, and since `os.path.isdir('/tmp')` returns True the failure surfaces as an empty result rather than an obvious error.

## When to stop scripting

If you write the same script twice, it wants to be a CLI mode or flag. Add it, document it in `modes.md`, and say so — that's ladder step 4.
