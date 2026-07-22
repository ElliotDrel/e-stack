---
name: estack-better-title
version: 1.2.0
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

If the output above shows a current title, factor it into your suggestions — keep whatever part of it still fits, refine the parts that don't, and don't propose something that just re-describes what it already says. If it says no title is set, draft from scratch.

If you need to re-check the title later — e.g. the user paused mid-flow and asked you to finish the rename on a later turn — run the same lookup manually (it's pre-approved in this skill's `allowed-tools`):

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/current-title.sh" "${CLAUDE_SESSION_ID}"
```

## Your task

Suggest **3 descriptive titles** for this chat session based on the conversation so far. The goal is to make sessions easy to find later.

### Before drafting, do this quick mental pass

Ask yourself:
1. What were the **goals** going in?
2. What **got built / decided / fixed** that the user might reference later?
3. What was **noise** — mistakes, abandoned approaches, things they had to redirect you on, dead ends? (These do NOT belong in the title.)
4. What's **temporary** vs. **lasting**? Temporary states should be mentioned briefly, not led with.
5. If there's a current title: does it still hold up, or has the conversation moved past what it describes?

Write the title from those answers, NOT from a chronological recap of the chat.

### Good titles

- Summarize **what was accomplished**, not what was attempted
- **Title the outputs, not the journey** — exclude mistakes, dead ends, and abandoned approaches. They're not searchable and not useful context for future-you.
- **Use plain language a future-you would search for.** Avoid jargon like "passthrough," "edge cases," "toggle logic," "auto-cd," "refactored," "overhaul." Say what it does in normal words.
- **Weight by long-term reference value.** If something will stop mattering in weeks or months (temporary fixes, current-state notes, "until X is available" workarounds), mention it briefly but don't lead with it.
- List key outputs separated by dashes, commas, or similar (e.g. "Reverse-Engineering /rename, PR #33165 Comment, and Building /estack-better-title Skill")
- Cover 2-4 main outputs. Resist cramming everything in — first-pass attempts tend to over-include.
- Are detailed enough that someone skimming a session list can tell exactly what they'd find inside
- Typically 8-20 words — longer is fine if it adds useful detail

## Format

Present the 3 options using `AskUserQuestion` with a single-select question (`multiSelect: false`):
- Each option's `label` is the full title text
- Each option's `description` is a brief rationale for why it's a good title
- The user can also select "Other" (provided automatically) to give feedback

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
