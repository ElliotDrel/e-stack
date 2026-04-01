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
</objective>

<execution_context>
The skill directory containing workflows and references is located at the same path as
this file. Read the relevant workflow file before executing each phase.

Workflows:
- setup.md — First-time tracker creation (only if tracker file missing)
- workflows/check-issues.md — Main check-in workflow (Phases 1-4)
- workflows/save-issues.md — Save issues from conversation to tracker

References:
- references/tracker-schema.md — Tracker file format and field definitions
- references/gh-cli-patterns.md — gh CLI command templates for all API calls
- references/overview-template.md — Report format template for check-in output
- tracker-template.md — Blank tracker template for new setup
</execution_context>

<process>

## Phase 0: Router

1. Determine the skill directory path from this file's location.
2. Parse `$ARGUMENTS` for the mode:
   - If arguments contain `--save` → **Save mode**
   - Otherwise → **Check-in mode** (default)

### Save mode

1. Read the tracker file at `$HOME/OneDrive/Documents/github-tracker.md`.
2. If the file does not exist, tell the user to run `/github-issues-update` first to set up the tracker, then STOP.
3. Read `workflows/save-issues.md` and `references/tracker-schema.md` from the skill directory.
4. Execute the save workflow.

### Check-in mode

1. Read the tracker file at `$HOME/OneDrive/Documents/github-tracker.md`.
2. **If the file does not exist or is empty:**
   - Tell the user: "No tracker file found. Let's set one up."
   - Read `setup.md` from the skill directory.
   - Follow setup instructions end-to-end to create the tracker.
   - After setup completes, proceed to step 3 to run the first check-in automatically.
3. **If the file exists and has content:**
   - Extract the GitHub username from the file header.
   - Read `workflows/check-issues.md` from the skill directory.
   - Read `references/gh-cli-patterns.md` and `references/tracker-schema.md` from the skill directory.
   - Execute the check-in workflow.

</process>

<context>
$ARGUMENTS
</context>
