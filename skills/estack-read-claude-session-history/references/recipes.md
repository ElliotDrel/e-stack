# Recipes

Multi-step workflows. For per-mode flag reference, see `modes.md`. For schema, see `jsonl-schema.md`.

In all examples, `$PY` refers to:
```
C:\Users\2supe\.claude\skills\read-claude-session-history\scripts\read_transcript.py
```

---

## 1. Post-`/compact` recovery

When `/compact` has rolled the conversation and you need what fell off the back end:

```bash
# Step 1: Recover the long version of recent assistant output
python "$PY" --file <current-session.jsonl> --mode pre-compact

# Step 2: If advisor responses were involved, grab those separately
python "$PY" --file <current-session.jsonl> --mode advisor

# Step 3: If a search would be faster than reading the whole pre-compact section
python "$PY" --file <current-session.jsonl> --mode search --query "<keyword>"
```

The `pre-compact` window is 40 message-exchanges before the most recent compact. If multiple `/compact` events fired, only the most recent is used as the anchor.

---

## 2. Find-then-dump (resume work from a session you can't name)

```bash
# Step 1: Find by partial title or first prompt
python "$PY" --mode find --title "supabase"
#   → returns a list, including the full session UUIDs

# Step 2: Get a 6-line summary to confirm it's the right one
python "$PY" --file <picked-session>.jsonl --mode brief

# Step 3: Dump the recent context to ground yourself
python "$PY" --file <picked-session>.jsonl --mode dump -n 20

# Step 4: Get the resume command for that session
python "$PY" --mode resume-cmd --uuid <8-char-prefix>
```

---

## 3. Fan-out triage (you spawned N parallel subagents and want every output)

```bash
# Option A: Get all subagent finals in one shot, separated by headers
python "$PY" --file <parent-session>.jsonl --mode subagent-finals

# Option B: Triage with a brief that includes subagent finals folded in
python "$PY" --file <parent-session>.jsonl --mode brief --include-subagents

# Option C: List first to see what types of agents ran
python "$PY" --file <parent-session>.jsonl --mode subagent-list

# Drill into one specific subagent's tools / files
python "$PY" --mode subagent-tools --subagent <subagent-path>
python "$PY" --mode subagent-files --subagent <subagent-path>
```

The `brief --include-subagents` output is the densest form of the standard "what did all my agents do" question and was designed for fan-out reproduction (14 parallel briefs ≡ a 14-subagent investigation).

---

## 4. Deletion-incident recovery (March 2026 auto-update bug, GitHub #41591)

When a live `.jsonl` has been wiped but the backup is intact:

```bash
# Step 1: Find what's missing — list live vs snapshot side by side
python "$PY" --root live        --cwd "C:\Users\2supe\Other Claude Code" --list > live.txt
python "$PY" --root snapshot-24h --cwd "C:\Users\2supe\Other Claude Code" --list > snap.txt
diff live.txt snap.txt

# Step 2: For each missing UUID, locate it in the snapshot
python "$PY" --root snapshot-24h --mode lookup --uuid <prefix>

# Step 3: Read it directly from the snapshot path
python "$PY" --file <snapshot-path>.jsonl --mode brief
python "$PY" --file <snapshot-path>.jsonl --mode dump

# Step 4: If the 24h snapshot is also affected, walk back further
python "$PY" --root snapshot-1w  --mode lookup --uuid <prefix>
python "$PY" --root snapshot-1mo --mode lookup --uuid <prefix>
```

The four backup roots (`mirror`, `snapshot-24h`, `snapshot-1w`, `snapshot-1mo`) are managed by the daily backup task documented in `reference_claude_backup_system.md`.

---

## 5. Week-in-review journal

```bash
# Every session in every project from the last 7 days
python "$PY" --all-projects --mode journal --since 7d

# Single project, with a hard upper bound
python "$PY" --cwd "C:\Users\2supe\Other Claude Code" \
  --mode journal --since 2026-05-13 --until 2026-05-20

# By project name instead of path
python "$PY" --project keel --mode journal --since 7d

# Count how many sessions touched a topic
python "$PY" --all-projects --mode count --query "linkedin"
```

The output is one 5-line block per session: `date·uuid·project` / first prompt / last assistant message / N files edited / top tools.

---

## 5b. Day accounting ("where did my day go?")

```bash
# Block-grouped timeline of yesterday across ALL projects, with idle gaps
python "$PY" --mode timeline --date yesterday

# How much time on one project today
python "$PY" --mode timeline --project keel --date today

# Tighter idle threshold (treat >5m quiet as a break between blocks)
python "$PY" --mode timeline --date today --gap 5m

# Multi-day window
python "$PY" --mode timeline --since 2026-06-01 --until 2026-06-03
```

Reading the output: each block is a contiguous stretch of activity (events ≤ gap
apart); the sessions inside it are listed with message counts; `── idle Xm ──`
lines mark the breaks; the totals line gives summed active time vs. span.

Caveat: this measures *Claude-visible* activity only — message timestamps, not
attention or time spent away from Claude.

---

## 5c. Piping structured output into a next step

Every mode supports `--format json`. **Run pipe chains in Bash** (the Bash tool /
git-bash) — they work exactly as written:

```bash
# Pull the paths of yesterday's sessions for batch processing
python "$PY" --mode list --all-projects --since yesterday --format json \
  | python -c "import json,sys; [print(s['path']) for s in json.load(sys.stdin)]"

# Machine-readable day totals
python "$PY" --mode timeline --date yesterday --format json \
  | python -c "import json,sys; t=json.load(sys.stdin)['totals']; print(t['active_minutes'], 'min across', t['sessions'], 'sessions')"
```

PowerShell warnings (5.1):
- Piping between native commands injects a UTF-8 BOM and re-encodes through the
  console codepage (can corrupt non-ASCII transcript content). If you must pipe
  in PowerShell, read stdin as `utf-8-sig`:
  `python -c "import io,json,sys; data=json.load(io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8-sig'))"`
- `>` redirection writes UTF-16 — read redirected files with `encoding='utf-16'`.

Prefer Bash for any JSON chaining; prefer either shell for plain single commands.

---

## 6. Sibling-agent diff

When you ran two subagents on the same task and want to see where they diverged:

```bash
# Auto-pick the first two subagents of a session
python "$PY" --mode diff --subagents-of <parent-session>.jsonl

# Explicit pairing
python "$PY" --mode diff \
  --file-a <parent-uuid>/subagents/agent-aaa.jsonl \
  --file-b <parent-uuid>/subagents/agent-bbb.jsonl
```

Output is timestamp-interleaved, prefixed `A>` / `B>`. Use it to spot disagreement (e.g. one agent recommended X and the other recommended Y) without reading both transcripts in full.

---

## 7. "What is this session actually for?" (cold open on a stale UUID)

```bash
# Single-shot orientation in under a second
python "$PY" --file <unknown-session>.jsonl --mode brief

# If you need more than 200 chars of context per line
python "$PY" --file <unknown-session>.jsonl --mode last -n 3
python "$PY" --file <unknown-session>.jsonl --mode changelog | tail -30
```

`brief` is the recommended default for triaging a session you've never read.

---

## 8. Tool-call forensics ("when did I last `git push --force`?")

```bash
# Find every tool_use whose JSON args contain a substring, across all sessions
python "$PY" --all-projects --mode search --query "git push --force" --in tool_use

# Get full forensics on the session that matched
python "$PY" --file <matching-session>.jsonl --mode tool-calls --tool Bash
```

---

## 9. Resume previous session in the current project

If you just `cd`'d into a project and want to pick up where you left off:

```bash
python "$PY" --cwd "$(pwd)" --mode resume-prev -n 15
```

Prints `--- Resuming from <uuid> (<mtime>) ---` then the last 15 exchanges.

---

## 10. Schema drift / silent empty results

When a mode returns nothing and you don't know why:

```bash
python "$PY" --file <session>.jsonl --mode debug
```

Look for:
- Unfamiliar `type:` values appearing in the distribution (parser might be dropping them as noise).
- An absent `advisor_tool_result` block when you expected advisor output.
- Missing `compact` markers in a session you know got compacted.
