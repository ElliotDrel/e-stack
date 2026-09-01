---
name: estack-better-title
version: 1.3.0
description: (better-title) Suggest better chat session titles and rename the session
disable-model-invocation: true
allowed-tools:
  - Bash(bash */scripts/rename.sh*)
  - Bash(bash */scripts/current-title.sh*)
  - Bash(gh --version)
  - Bash(gh issue create *)
  - Bash(python3 -c *)
  - AskUserQuestion
---

# Better Title

The current session ID is: ${CLAUDE_SESSION_ID}

## Current title

```!
SID="${CLAUDE_SESSION_ID}"
[ -n "$SID" ] || SID="$CLAUDE_CODE_SESSION_ID"
DIR="${CLAUDE_SKILL_DIR}"
[ -n "$DIR" ] || DIR="$HOME/.claude/skills/estack-better-title"
bash "$DIR/scripts/current-title.sh" "$SID"
```

If the output above shows a current title, follow **Re-titling an existing session** below — it has the decision procedure for what to keep and what to replace. If it says no title is set, draft from scratch.

If you need to re-check the title later — e.g. the user paused mid-flow and asked you to finish the rename on a later turn — run the same lookup manually (it's pre-approved in this skill's `allowed-tools`):

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/current-title.sh" "${CLAUDE_SESSION_ID}"
```

## Your task

Suggest **3 titles** for this chat session based on the conversation so far. A title has **three zones separated by a spaced hyphen (` - `)**, and each zone has a different job:

```
<Subject> - <Locator> - <keywords>
```

| Zone | Job | Budget |
|---|---|---|
| 1. Subject | The one thing you'd read to decide "is this the session I want to resume?" | ≤40 chars |
| 2. Locator | Where the work lives: project/repo, sub-scope, PR and issue numbers | ≤25 chars |
| 3. Keywords | Bare search terms for grep and Ctrl-F | ≤60 chars |

Zone 1 is the only zone that has to stand alone — it's what survives truncation in `/resume` and the session list. Zones 2 and 3 exist so that a future search finds this session at all.

### Before drafting: reduce the session to three things

Silently answer these, then title from the answers — never from a chronological recap of the chat:

- **Subject:** What system, feature, or problem is this really about?
- **Outcome:** What did the user ultimately want to understand or change?
- **Incidental instructions:** What only describes *how* the agent should do the work?

Title the subject and outcome. Discard the incidental instructions entirely.

### Zone 1 — Subject (≤40 chars)

- Use a compact noun phrase or a clear action phrase, in Title Case.
- Capture the **umbrella goal** when the session covered several symptoms or steps.
- Name the **product change**, not the mock, plan, report, branch, or PR used to produce it.
- Models, subagents, tools, output formats, and monitoring instructions do not belong here unless they are themselves the topic.
- For reviews, name what was reviewed and the relevant concern. Never a generic "Review PR 123" when the conversation reveals the actual subject.
- For research, name the question domain, not the requested research process.
- Do not claim the work is complete.
- Do not copy and truncate the user's message.
- No project or repo name — zone 2 owns that, and zone 1 has no characters to spare.
- No numbers, quotes, labels, filler, or trailing punctuation.
- Use attached images as primary context for UI issues.

### Zone 2 — Locator (≤25 chars)

Plain text, no brackets. Project or repo name, a sub-scope when the repo alone is uninformative, then PR and issue numbers:

- `gbrain PR #127`
- `e-stack/manage-e-stack`
- `e-stack`

This zone deliberately keeps the numbers and project names zone 1 bans. Zone 1 is a label; zone 2 is context and a grep target. `#127` is one of the highest-value search strings a title can carry.

**Omit zone 2 entirely** when there's no repo and no PR. Never invent a scope to fill the slot.

### Zone 3 — Keywords (≤60 chars)

An index, not a sentence. Lowercase, comma-separated, no connective words, no "and":

- File names, function names, flags, env vars, error strings
- Tool, skill, and package names; version numbers
- Secondary outputs that don't fit under the zone 1 umbrella

Rules:
- Never repeat a word already in zone 1 or 2 — it wastes the budget.
- No dead ends, abandoned approaches, or mistakes. You won't search for them.
- **Omit zone 3 entirely** for a short single-output session. Padding to hit the format adds noise.

### Shortening

Use `&` and `+` anywhere they make a zone shorter and clearer — especially in zone 1, where the budget is tight. `Ship npx Installer & Change Detection` beats `Ship the npx Installer and Change Detection`. Never use them as zone separators; that's the hyphen's job.

### The hyphen gotcha

The zone separator is a **spaced** hyphen (` - `). Hyphens inside content must stay **unspaced**, or the zones become unparseable by eye and by script. `google-tools-mcp`, `30-day`, and `.claude-backups` are all fine. `google - tools - mcp` is not.

### Worked examples

```
Consolidate Google Recipes into One MCP - gbrain PR #127 - google-tools-mcp, issue #126, cross-link #124
Ship npx Installer & Change Detection - e-stack - install.cjs, checksum drift, SessionStart hook, merge backup
Recover Lost Claude Transcripts - 3629 sessions, 30-day retention disabled, .claude-backups, restore docs
```

The third drops zone 2: no repo, no PR, nothing real to put there.

### Re-titling an existing session

When a title already exists, decide in this order:

1. Read the **user's** messages first. Identify the latest explicit durable goal. The original subject stays the subject until the user clearly changes what the session is about.
2. Use your own earlier messages only to resolve vague references and unnamed code. Do not promote one finding of yours into the subject unless the user adopted it as a new goal.
3. Compare that subject to the current title. **Preserve** accurate scope words. **Replace** the title when it is generic, names an artifact instead of the product, is a stale completion update, or is contradicted by where the session actually went.
4. Title the durable subject and desired outcome, not the current workflow state.

A session that moved through research, planning, implementation, review, CI, merge, and monitoring has usually **not** changed subjects. Treat final cleanup, commits, and wrap-up summaries as weak evidence of what the session was about — they're the most recent thing that happened, not the point of it.

Return a meaningfully improved title, not a cosmetic paraphrase.

Examples of the distinction:
- A skill-audit session that ends in a merge stays `Audit Better-Title Skill`, not `Merge PR #41`.
- A subagent-monitoring review that turns up a roster bug stays `Review Subagent Monitoring Risks`, not `Fix Codex Roster Bug`.
- A vague "tests are failing" request later pinned to a thread-feed mismatch becomes `Fix Lazy Thread Feed Test`, not `Prevent Mobile Feed Regressions`.

## Format

Present the 3 options using `AskUserQuestion` with a single-select question (`multiSelect: false`):
- Each option's `label` is **zone 1 only** — the subject. Option labels render short, and a full three-zone title is far too long to read there.
- Each option's `description` is the **full title**, all zones, exactly as it will be written. The user picks on the subject and confirms on the whole string.
- The user can also select "Other" (provided automatically) to give feedback

Because the label is only zone 1, two options whose subjects are near-identical look like the same choice. Make the three subjects meaningfully different from each other, not three phrasings of one idea.

## Interaction loop

- If the user selects one of the 3 titles, use that title.
- If the user selects "Other" and provides feedback (e.g. "shorter", "more specific", "mention X"), generate 3 new suggestions incorporating their feedback and present again via `AskUserQuestion`.
- Keep iterating until the user selects a title or gives you an exact title.

## Renaming

Once the user has chosen a title, run the rename script using a quoted heredoc to pass the title safely:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/rename.sh" "${CLAUDE_SESSION_ID}" <<'__CLAUDE_TITLE__'
<chosen title>
__CLAUDE_TITLE__
```

Replace `<chosen title>` with the actual chosen title. The quoted heredoc (`<<'__CLAUDE_TITLE__'`) prevents the shell from interpreting any special characters in the title — quotes, apostrophes, dollar signs, backticks, etc. are all passed through literally. After running, confirm the rename succeeded.

**Important:** The live UI border won't update until the next session resume — the persisted title will show in the session list and on next `/resume`.

### If the append fails or is blocked

`rename.sh` already retries a locked append with exponential backoff (Windows can hold a transient exclusive lock on the session file it's actively writing to — the retry window runs up to ~16 seconds to reliably outlast it, since the live CLI writes to that same file on nearly every turn). If it still fails after all retries, or a permission prompt interrupts this exact command, do NOT go inspect, open, or probe the session `.jsonl` directly to figure out why — that departs from this skill's single sanctioned append operation and is far more likely to need manual approval or get blocked outright than the retry itself. Just tell the user the rename didn't go through and suggest running it again in a few seconds.

This skill's `allowed-tools` frontmatter pre-approves the rename command (and the feedback-section commands), so on the turn that invoked the skill it runs without a permission prompt. That grant clears when the user sends their next chat message — so if the title is chosen on a later turn (e.g. the user replied in chat instead of picking an `AskUserQuestion` option), the rename may prompt. If that's a recurring annoyance, the user can add a persistent allow rule scoped to just this invocation to `settings.json`:

```json
{
  "permissions": {
    "allow": ["Bash(bash */scripts/rename.sh*)"]
  }
}
```

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-better-title: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-better-title: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
