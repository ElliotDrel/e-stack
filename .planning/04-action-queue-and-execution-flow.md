# Brief 04 — Persistent action queue + post-check-in execution framework

**Closes:** #4 and #7 (co-authored — one unified Step 5 rewrite)
**File:** `skills/estack-github-issue-tracker/SKILL.md` (+ `references/tracker-schema.md` for
the new section format)
**Size:** medium — holistic Step 5 rewrite. No script change required (optionally reuses
`append-history` from Brief 03).

---

## Why #4 and #7 are one brief

Both rewrite Step 5 and are causally sequential: #4 creates the action queue (before
execution), #7 executes against it (after approval). They share the seam "before spawning
agents." Editing them as two independent patches produces contradictory instructions (one adds
a task-list step, the other ignores it). The #7 investigation's explicit verdict: **merge —
one combined edit, one PR closing both.**

## Root cause (verified against source)

- **#4:** recommended actions are emitted as ephemeral markdown in the AI's chat reply (Step
  5a, SKILL.md:276-283) with no structured persistent store. As the conversation continues the
  AI re-derives the list from context, dropping items. The tracker *does* persist per-issue
  "Next steps" but there is **no unified, status-bearing action queue** and nothing surfaces
  carried-over items at the next run's start.
- **#7:** Step 5c (SKILL.md:299-309) specifies the *what* (present, approve, execute, log) but
  has **zero operational *how*** — no agent topology, no task persistence, no action-type
  routing, no git/temp-dir policy, no force-push auth model, no reporting contract. Verified:
  Step 2b's subagent pattern is well-specified; Step 5c never got the equivalent.

**Red-herring check passed:** #7 is a genuine missing-spec, not a symptom of a deeper flaw.
#4 and #7 are distinct problems (persistence vs execution) that touch the same step.

## Reconciled design decision (resolves a cross-agent conflict)

The two investigations disagreed on the action store:
- **#4 agent:** recommended **against** `TaskCreate`/`TaskList` — they are harness
  session-scoped tools and may return empty on a fresh CLI session, silently dropping the
  "Carried Over" feature. Recommended a **tracker-backed `## Pending Actions` section** (the
  tracker file is the only guaranteed cross-session store, and is already the skill's source of
  truth, SKILL.md:47).
- **#7 agent:** assumed `TaskCreate` for the task list.

**Resolution:** the tracker `## Pending Actions` section is the **authoritative cross-session
queue**; the harness task list is an **optional within-session focus mirror**. Cross-session
"Carried Over" reads from the tracker, never from `TaskList`. This keeps #4's durability
guarantee and #7's live-execution ergonomics without depending on uncertain task persistence.

## The fix — unified Step 5 (recommended)

Renumber Step 5:
- **5a Report** (unchanged) — also prepend a **Carried Over** section if
  `## Pending Actions` (read at Step 0) has unfinished `- [ ]` items.
- **5b Persist actions** — write every "Do Today" item to the tracker's `## Pending Actions`
  section as `- [ ] <action> (from <issue-ref>, <date>)`. Optionally mirror to the harness task
  list for within-session focus. Source of truth = tracker.
- **5c Execute approved actions** — the new execution framework, working from the 5b queue:
  1. **Mark before acting:** flip the queue item to in-progress (and `in_progress` on the
     mirrored task if used).
  2. **Parallel subagents:** one per approved action.
  3. **Action-type routing table:**
     | Action | Execution |
     |---|---|
     | Post comment / tag maintainer | `gh pr/issue comment` directly — no clone |
     | Rebase a PR branch | clone fork → temp dir → add upstream → rebase → force-push → `rm -rf` |
     | Fix PR review blockers | clone branch → temp dir → change → push → re-request review → `rm -rf` |
     | Watch / monitor | no action; note in report |
  4. **Temp-dir-only for git:** any clone goes into `mktemp -d`, work there, `rm -rf` when
     done. Never clone into the user's working directory.
  5. **Force-push auth:** a blanket "do all of them" approval authorizes force-pushing rebased
     PR branches — do not re-ask per branch.
  6. **Subagent model:** follow the global cascade (one tier below orchestrator); for complex
     code-fixing tasks (unfamiliar repo + test infra) floor at Sonnet even if cascade would
     pick Haiku. (Consistent with global CLAUDE.md `## Subagents`.)
  7. **Report back + persist immediately:** each agent returns what it did, conflicts resolved,
     push/comment success, blockers. On completion, flip the queue item to `- [x] <action>
     (<date>)` and write a history entry **immediately** (per Brief 03 — never batch). Prune
     `[x]` items older than 7 days.
- **5d Collect missing Goals** (current 5b, renumbered).
- **5e Cleanup** (current 5d, renumbered).

**Step 0 add:** read `## Pending Actions` → `$PENDING_ACTIONS`; `- [ ]` items carry over.
**tracker-schema.md add:** define the `## Pending Actions` section format.

### Consistency notes (verified against global CLAUDE.md)
Temp-dir policy and force-push auth are net-new skill-local policy (no global rule conflicts).
The Sonnet-floor override aligns with the global subagent cascade. The "persist immediately"
rule reinforces Brief 03 / #3 — frame them as the same invariant.

## Verification / test plan
1. Run a check-in that produces ≥3 Do Today items. Confirm all land in `## Pending Actions`
   as `- [ ]` with issue refs.
2. Approve "do all"; confirm parallel agents spawn, git work happens only in temp dirs (no
   clone in the working dir), and force-push proceeds without re-prompting.
3. Confirm each completed item flips to `- [x]` with a date and a history entry, written as it
   completes (kill mid-run → completed items already persisted).
4. Start a fresh session; confirm Step 5a's **Carried Over** lists the still-`[ ]` items from
   the tracker (not dependent on `TaskList`).

## Sequencing
Co-author #4 + #7 in one PR. Best landed after Brief 03 so 5c's "persist immediately" can call
`append-history`; can ship independently using the tracker section directly if 03 slips.

## Commit / PR
`feat(github-issue-tracker): persistent action queue + post-check-in execution framework (#4, #7)`
