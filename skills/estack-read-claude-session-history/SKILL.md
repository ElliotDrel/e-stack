---
name: estack-read-claude-session-history
description: (read-claude-session-history) Use when you need to look back at a Claude Code session transcript — after a /compact, to recover advisor output, agent output, a review, a specific earlier message, or anything that was lost from context. Invoke whenever the user says "go back and look", "what did the advisor say", "what happened before compact", "read the transcript", "check what the agent did", "recover the workflow from", or references something from earlier in the session that's no longer visible. Also use at the start of a new session that explicitly asks you to continue from a previous one.
---

# Read Transcript

Claude Code sessions are stored as `.jsonl` files — one JSON object per line. Most lines are noise. This skill tells you exactly what to look for and how to extract it fast.

## Finding the right file

**Transcript location:**
```
C:\Users\<user>\.claude\projects\<encoded-path>\<session-uuid>.jsonl
```

**Path encoding:** Replace every `:`, `\`, `/`, and space in the CWD with `-`.

Quick examples:
- `C:\Users\2supe\Other Claude Code` → `C--Users-2supe-Other-Claude-Code`
- `C:\Users\2supe\All Coding\my-app` → `C--Users-2supe-All-Coding-my-app`

**Finding the current session:** The most recently modified `.jsonl` in the project directory is almost always the current session.

**Subagent transcripts** (for advisor or spawned agents) live at:
```
<project-dir>/<session-uuid>/subagents/agent-<id>.jsonl
```

## Use the bundled script — don't read raw JSONL

Raw JSONL files are 1,000–5,000+ lines of dense JSON. Use the script instead:

```bash
# List all transcripts for a project
python "C:\Users\2supe\.claude\skills\read-transcript\scripts\read_transcript.py" --cwd "C:\path\to\project" --list

# Get the last 5 assistant outputs
python "C:\Users\2supe\.claude\skills\read-transcript\scripts\read_transcript.py" --file <path.jsonl> --mode last

# Get all advisor responses
python "C:\Users\2supe\.claude\skills\read-transcript\scripts\read_transcript.py" --file <path.jsonl> --mode advisor

# Get content just before the most recent /compact
python "C:\Users\2supe\.claude\skills\read-transcript\scripts\read_transcript.py" --file <path.jsonl> --mode pre-compact

# Full readable conversation dump (last 80 text messages)
python "C:\Users\2supe\.claude\skills\read-transcript\scripts\read_transcript.py" --file <path.jsonl> --mode dump

# Search for a specific term in one session
python "C:\Users\2supe\.claude\skills\read-transcript\scripts\read_transcript.py" --file <path.jsonl> --mode search --query "review"

# Search across ALL sessions in a project directory
python "C:\Users\2supe\.claude\skills\read-transcript\scripts\read_transcript.py" --cwd "C:\path\to\project" --mode search --query "notes.md"

# List subagent files for a session
python "C:\Users\2supe\.claude\skills\read-transcript\scripts\read_transcript.py" --file <path.jsonl> --list-subagents
```

## What the modes return

| Mode | Returns | Use when |
|------|---------|----------|
| `last` | Last 5 assistant text outputs | "What did it do?" default |
| `advisor` | All advisor responses in full | "What did the advisor say?" |
| `pre-compact` | 40 exchanges before the most recent /compact | "What happened before compact?" |
| `dump` | Last 80 text messages, human-readable | Want the full picture |
| `search` | Every assistant message matching a keyword | Looking for specific output |
| `debug` | Entry type distribution, block types, advisor probe, compact probe, sample messages | A mode returns empty/unexpected results — check if transcript format has drifted |

## Transcript structure (for context)

You usually won't read raw JSONL, but knowing the structure helps if the script doesn't cover an edge case.

**Entry types to care about:**
- `"user"` — user messages and tool results
- `"assistant"` — AI outputs, tool calls, advisor results

**Skip entirely:** `permission-mode`, `ai-title`, `custom-title`, `attachment`, `last-prompt`, `queue-operation`, `file-history-snapshot`, `system`, `agent-name`

**Assistant message content block types:**
```
"text"                — the actual output text
"thinking"            — internal reasoning (skip unless debugging)
"tool_use"            — regular tool calls (Read, Edit, Bash, etc.)
"server_tool_use"     — server-side tools like advisor (name: "advisor")
"advisor_tool_result" — the advisor's response → content.text has the advice
```

**Compact marker:** A `type:"user"` entry where content starts with:
> `"This session is being continued from a previous conversation that ran out of context."`

Everything before this line is the pre-compact conversation.

**Advisor result path:** `obj.message.content[].type == "advisor_tool_result"` → `content.content.text`

## Common workflows

### Recover what the advisor said
```bash
python read_transcript.py --file <current-session.jsonl> --mode advisor
```

### Get what happened right before a /compact
```bash
python read_transcript.py --file <session.jsonl> --mode pre-compact
```

### Get an agent's final output
```bash
# Step 1: find the session's subagent files
python read_transcript.py --file <session.jsonl> --list-subagents

# Step 2: get the last message from the relevant agent
python read_transcript.py --file <subagent.jsonl> --mode last
```

### Find the review output that's no longer in context
```bash
python read_transcript.py --file <session.jsonl> --mode search --query "review"
# Or if you know it was an advisor:
python read_transcript.py --file <session.jsonl> --mode advisor
```

### Start fresh session continuing previous work
```bash
# List and pick the right session
python read_transcript.py --cwd "C:\path\to\project" --list

# Dump the end of the prior session
python read_transcript.py --file <prior-session.jsonl> --mode last -n 10
```

## Windows notes

- Always use `python` (not `python3`) on this Windows setup
- The script handles UTF-8 encoding internally — both PowerShell and Bash tools work fine
