---
name: github-issues-update
description: >
  Daily GitHub issue check-in. Reads tracker, checks all active issues for updates,
  finds new duplicates/related issues, identifies next steps, and executes actions
  after user approval. Run with no args for full check-in.
argument-hint: "[--dry-run] [--skip-dupes]"
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
Check all GitHub issues the user is tracking for updates, discover related/duplicate
issues, plan actions, and execute after approval. Four phases: gather → report → act → update.
</objective>

<execution_context>
The skill directory containing workflows and references is located at the same path as
this file. Read the relevant workflow file before executing each phase.

Workflows:
- setup.md — First-time tracker creation (only if tracker file missing)
- workflows/check-issues.md — Main check-in workflow (Phases 1-4)

References:
- references/tracker-schema.md — Tracker file format and field definitions
- references/gh-cli-patterns.md — gh CLI command templates for all API calls
- references/overview-template.md — Report format template for check-in output
- tracker-template.md — Blank tracker template for new setup
</execution_context>

<process>

## Phase 0: Router

1. Determine the skill directory path from this file's location.
2. Read the tracker file at `$HOME/Documents/github-tracker.md`.
3. **If the file does not exist or is empty:**
   - Tell the user: "No tracker file found. Let's set one up."
   - Read `setup.md` from the skill directory.
   - Follow setup instructions end-to-end to create the tracker.
   - After setup completes, proceed to step 4 to run the first check-in automatically.
4. **If the file exists and has content:**
   - Extract the GitHub username from the file header.
   - Parse `$ARGUMENTS` for flags:
     - `--dry-run` — run Phases 1-2 only, skip posting and tracker updates
     - `--skip-dupes` — skip duplicate/related issue search (faster check-in)
   - Read `workflows/check-issues.md` from the skill directory.
   - Read `references/gh-cli-patterns.md` and `references/tracker-schema.md` from the skill directory.
   - Execute the check-in workflow.

</process>

<context>
$ARGUMENTS
</context>
