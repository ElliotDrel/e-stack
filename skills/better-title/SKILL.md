---
name: estack:better-title
description: Suggest better chat session titles and rename the session
disable-model-invocation: true
allowed-tools: Bash, AskUserQuestion
---

# Better Title

The current session ID is: ${CLAUDE_SESSION_ID}

## Your task

Suggest **3 descriptive titles** for this chat session based on the conversation so far. The goal is to make sessions easy to find later. Good titles:
- Summarize **what was accomplished** in the chat, not just the topic
- List key actions/outcomes separated by dashes, commas, or similar (e.g. "Reverse-Engineering /rename, PR #33165 Comment, and Building /better-title Skill")
- Are detailed enough that someone skimming a session list can tell exactly what happened
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
