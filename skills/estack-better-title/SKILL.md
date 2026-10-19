---
name: estack-better-title
version: 2.0.2
description: >-
  (better-title) Suggest better chat session titles and rename the session, in
  Claude Code or Codex.
disable-model-invocation: true
allowed-tools:
  - Bash(bash */scripts/session.sh*)
  - Bash(bash */scripts/rename.sh*)
  - Bash(gh --version)
  - Bash(gh issue create *)
  - Bash(python3 -c *)
  - AskUserQuestion
---

# Better Title

## Start here

This skill requires Bash and Node.js and runs in both Claude Code and Codex. Which one it is decides where the
session id comes from and how the title gets written, so the first step is
always this command. It reports the host, the session id, the title the session
has now, and the exact rename command to use later.

```!
DIR="${CLAUDE_SKILL_DIR}"
[ -f "$DIR/scripts/session.sh" ] || DIR="$HOME/.agents/skills/estack-better-title"
[ -f "$DIR/scripts/session.sh" ] || DIR="$HOME/.claude/skills/estack-better-title"
bash "$DIR/scripts/session.sh" || printf '\nSESSION_CHECK_FAILED: stop and follow the diagnostic above.\n'
```

If you are reading this in a host that does not run that block automatically,
run it yourself now, before anything else. Nothing below works without it.

**If it reports an error or `SESSION_CHECK_FAILED`, stop and follow the message
it printed.** Each failure mode says what it checked and what to work out before
telling the user anything. Do not invent a session id and do not try to rename
anything until it reports a host.

If it reported a current title, follow **Re-titling an existing session** below —
it has the decision procedure for what to keep and what to replace. If it says
no title is set, draft from scratch.

Re-run the same command whenever you need the id or the title again, for example
when the user paused mid-flow and asked you to finish the rename a turn later.
The host's tool permissions still apply.

## Codex sandbox access

Before running the startup command in Codex, check the tool sandbox's writable
roots. A private `codex app-server` starts under the same sandbox and can write
startup/state files in `CODEX_HOME` (normally `~/.codex`) even for `thread/read`.
If that directory is outside the writable roots, request the required access
through the host tool's approval/escalation mechanism for the startup command
and again for the later rename command. On a Codex shell tool that exposes it,
use `sandbox_permissions: "require_escalated"` with a justification naming the
session-title operation. The skill cannot grant this permission itself.

If startup or rename reports `APPROVAL_REQUIRED`, stop drafting and rerun the
same operation using that approval mechanism. Keep `CODEX_HOME` and the session
id unchanged. If approval is denied or unavailable, explain the limitation and
stop. Never disable the sandbox, redirect to another home, or write the state
database directly to get around the denial.

## Your task

If the user supplied an exact title, use it. Otherwise suggest **3 titles** based on the conversation so far. A title has **three zones separated by a spaced hyphen (` - `)**, and each zone has a different job:

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

When `AskUserQuestion` is available, present the 3 options with a single-select question (`multiSelect: false`):
- Each option's `label` is **zone 1 only** — the subject. Option labels render short, and a full three-zone title is far too long to read there.
- Each option's `description` is the **full title**, all zones, exactly as it will be written. The user picks on the subject and confirms on the whole string.
- The user can also select "Other" (provided automatically) to give feedback

**If you don't**, write the three options in chat as a numbered list. Each entry shows the subject on its own line and the full title underneath, then ask the user to reply with a number, or with feedback. Same information, same choice — just typed instead of picked.

Either way, because the user chooses on zone 1, two options whose subjects are near-identical look like the same choice. Make the three subjects meaningfully different from each other, not three phrasings of one idea.

Do not make a user who already supplied an exact title choose again.

## Interaction loop

- If the user picks one of the 3 titles, use that title.
- If the user gives feedback instead (e.g. "shorter", "more specific", "mention X"), generate 3 new suggestions incorporating it and present again the same way.
- Keep iterating until the user picks a title or gives you an exact title.

## Renaming

Once the user has chosen a title, run the rename command **exactly as the start-here
command printed it**, with `<chosen title>` replaced by the actual title. It already
has the right script path and the right session id filled in for this host. Keep
the quoted heredoc (`<<'__ESTACK_TITLE__'`): it stops the shell from interpreting
anything in the title, so quotes, apostrophes, dollar signs, and backticks all pass
through literally. After running, confirm the rename succeeded.

`rename.sh` refuses to run if the id you pass is not this session's id, so a stale
id from an earlier turn fails loudly instead of renaming the wrong session. If
that happens, re-run the start-here command and use the id it prints.

**When the new title shows up** depends on the host:

- **Claude Code** — the live UI border won't update until the next session resume. The persisted title shows in the session list and on the next `/resume`.
- **Codex** — the rename goes through the app-server. If the daemon serving the live session is reachable, the UI picks it up right away; otherwise it lands in Codex's thread store and shows once the thread list is reloaded.

### If the rename fails or is blocked

Both host paths already handle their own retries: on Claude Code, the append
retries a locked write with exponential backoff (Windows can hold a transient
exclusive lock on the session file it's actively writing to — the retry window
runs up to ~16 seconds to reliably outlast it, since the live CLI writes to that
same file on nearly every turn). On Codex it goes through the app-server daemon
when one is running and a private stdio app-server otherwise.

If it still fails, or a permission prompt interrupts this exact command, do NOT
go inspect, open, or probe the host's session store directly to figure out why —
not the Claude `.jsonl` transcript, not Codex's state database. That departs from
this skill's sanctioned operations and is far more likely to need manual approval
or get blocked outright than the retry itself. Just tell the user the rename
didn't go through and suggest running it again in a few seconds.

Tool permissions depend on the host and its configuration; `allowed-tools` is not a cross-host permission grant. On Claude Code, the user can add a persistent allow rule scoped to this invocation in `settings.json` if repeated prompts are a problem:

```json
{
  "permissions": {
    "allow": ["Bash(bash */scripts/rename.sh*)"]
  }
}
```

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-better-title:` and a body. File an
issue only when the user explicitly asks you to do so. If they have not asked,
offer the draft and issue page for their review; do not post or open anything
automatically.

When the user explicitly authorizes filing and `gh` is installed (`gh --version` succeeds), create the issue with structured arguments. Put the reviewed body in a UTF-8 temporary file and pass its literal path with `--body-file`; do not interpolate feedback into shell code.

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "<reviewed title>" \
  --body-file "<path-to-reviewed-UTF-8-body-file>"
```

If `gh` is unavailable, give the user the reviewed title and body to paste into a
new issue at `https://github.com/ElliotDrel/e-stack/issues/new`.
