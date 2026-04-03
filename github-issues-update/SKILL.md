---
name: github-issues-update
description: >
  GitHub issue tracker management. Run with no args for daily check-in (checks all
  active issues for updates, finds duplicates, identifies next steps). Run with `--save`
  to add issues from the current conversation to the tracker.
argument-hint: "[--save]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
---

<objective>
Route to the correct workflow based on arguments and context. Two modes:
- **Check-in** (default): Check tracked issues for updates, discover duplicates, plan actions.
- **Save**: Add issues from the current conversation to the tracker.

This skill uses a Node script (`bin/tracker-tools.cjs`) as its data service layer.
All parsing, report compilation, tracker updates, and validation are handled by the script.
The agent orchestrates and calls the script — it does NOT parse or compile manually.
</objective>

<execution_context>
The skill directory containing workflows, references, and scripts is located at the same
path as this file. Resolve the skill directory path from this file's location FIRST.

**Script:** `bin/tracker-tools.cjs` — MUST be invoked via:
```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" <command> [options]
```

**Workflows:**
- `setup.md` — First-time tracker creation (only if tracker file missing)
- `workflows/check-issues.md` — Main check-in workflow
- `workflows/save-issues.md` — Save issues from conversation to tracker

**References (agent reads these, NOT the script):**
- `references/tracker-schema.md` — Tracker file format and field definitions
- `references/gh-cli-patterns.md` — gh CLI command templates for ALL API calls
- `references/result-file-schema.md` — Standardized result file format for agent analysis
- `tracker-template.md` — Blank tracker template for new setup
</execution_context>

<process>

<step name="startup_and_route" priority="first">

## Step 1: Startup and Route

1. Determine `$SKILL_DIR` from this file's location.
2. Verify the script exists:
   ```bash
   test -f "$SKILL_DIR/bin/tracker-tools.cjs" && echo "OK" || echo "MISSING"
   ```
   If MISSING, error: "tracker-tools.cjs not found at $SKILL_DIR/bin/. Skill may be corrupted."
3. Set `$TRACKER_PATH` to `$HOME/OneDrive/Documents/github-tracker.md`.
4. Parse `$ARGUMENTS` for mode:
   - If arguments contain `--save` -> **Save mode**
   - Otherwise -> **Check-in mode** (default)
5. Run startup:
   ```bash
   node "$SKILL_DIR/bin/tracker-tools.cjs" startup --tracker "$TRACKER_PATH"
   ```
6. Store entire response as `$STARTUP`. Extract: `auth`, `username`, `tracker_exists`,
   `tracker_data`, `new_issues`, `reopened_issues`, `recently_closed`.
7. If `auth` is false -> tell user to run `gh auth login`, **STOP**.

### Save mode

- If `tracker_exists` is false -> tell user to run `/github-issues-update` first, **STOP**.
- Read `workflows/save-issues.md` and `references/tracker-schema.md` from `$SKILL_DIR`.
- Execute save workflow passing `$STARTUP`, `$SKILL_DIR`, `$TRACKER_PATH`.

### Check-in mode

- **If `tracker_exists` is false or `tracker_data` has no issues:**
  - Tell the user: "No tracker file found. Let's set one up."
  - Read `setup.md` from `$SKILL_DIR`.
  - Follow setup, passing `$STARTUP` (already has username and auth confirmed).
  - After setup completes, proceed to check-in.
- **If tracker exists with content:**
  - Store `$STARTUP` as context (replaces old `$TRACKER_DATA`).
  - Read `workflows/check-issues.md` from `$SKILL_DIR`.
  - Read `references/gh-cli-patterns.md` and `references/tracker-schema.md` from `$SKILL_DIR`.
  - Execute check-in passing `$STARTUP`, `$SKILL_DIR`, `$TRACKER_PATH`.

</step>

</process>

<context>
$ARGUMENTS
</context>
