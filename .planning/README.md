# Execution Briefs — estack-github-issue-tracker open issues

Triage of all 7 open issues on `ElliotDrel/e-stack`, each investigated by a dedicated
Sonnet agent, root cause verified against source, and collapsed into 4 execution briefs.

## Issue → brief map

| Issue | Title (short) | Brief | Root verified |
|---|---|---|---|
| #1 | orphaned body when moving to Closed | **01** | yes — symptom of #5's regex bug |
| #5 | `sectionRe` `'m'` flag truncates section | **01** | yes — line 512, still in code |
| #6 | `extractSection` `'mi'` flag truncates | **01** | yes — line 482, still in code |
| #2 | PR merge-readiness missed + stale data trusted | **02** | yes — 4-file pipeline gap |
| #3 | update tracker incrementally, not in bulk | **03** | yes — no `append-history` command |
| #4 | write actions to a persistent queue | **04** | yes — actions are ephemeral chat text |
| #7 | post-check-in execution framework | **04** | yes — Step 5c has no "how" |

## Key triage findings

1. **#1, #5, #6 are one root, not three.** All are the `'m'`-flag / `$`-matches-end-of-line
   regex bug. #1 ("orphaned body") and #5 ("update-tracker writes nothing") are the **same
   line** (512). #6 is the sibling at line 482. The "Fixed on 2026-05-07" claims in #5 and #6
   are **false** — the buggy flags are still in the committed code. → Brief 01.

2. **#5 and #6 need _different_ fixes** despite the same bug class. #5's regex already uses
   `\n###`/`\n##` lookaheads → just drop `'m'`. #6 uses bare `^` anchors → dropping `'m'`
   alone breaks it; needs three coordinated changes. → Brief 01 spells out both.

3. **#3 depends on Brief 01.** The proposed `append-history` would reuse the section-finding
   logic that is currently broken by #5. Fix the regex first, extract a shared helper, then
   build `append-history` on top. → Brief 03 sequenced after 01.

4. **#4 and #7 must be co-authored** (both rewrite Step 5). They were investigated with a
   conflict: #4's agent recommended **against** `TaskCreate` (harness tasks may not survive
   across CLI sessions) in favor of a tracker-backed `## Pending Actions` section; #7's agent
   assumed `TaskCreate`. Brief 04 reconciles: tracker section is the authoritative
   cross-session queue; harness task list is an optional within-session focus mirror.

## Recommended execution order

1. **Brief 01** (regex bug) — unblocks everything; smallest diff; highest impact.
2. **Brief 02** (PR health) — independent; can run in parallel with 01.
3. **Brief 03** (append-history) — after 01 lands.
4. **Brief 04** (action queue + execution) — after 03 if reusing `append-history`; otherwise independent.
