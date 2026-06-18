# V4 Build History — Conversation Log

**Date:** 2026-05-07
**Outcome:** V3 → V4 rewrite of the `active-learning-tutor` skill.

---

## How the conversation went

### 1. The trigger

Reported a real failure from the next study session after V3 shipped. User had triggered Path D, said "idk teach me risk" on Q1, and watched the skill misfire in several ways. Pasted the running AI's own self-diagnosis as the starting evidence.

### 2. Diagnosis phase

Identified five failure modes in V3:

1. Variable isolation rule named values, missed logical structure.
2. Answer key gravity well from the answer sitting in `teach_list.md`.
3. Question-scope teaching instead of cluster-scope (contradiction between "teach the whole concept" and "do not preload" — AI resolved as scope, not depth).
4. Teaching template skipped (no headline, no formal definition, no formula).
5. Teach list stuck at `0 / 0 mastered` — Progress Summary recompute was an unrealistic per-turn obligation.

User wanted diagnostic prompts to send to the running session before declaring V4 — confirmed all five failures with the AI under fire.

### 3. Grounding principle from user

> "Tell the skill what to do with goal-based prompts and clear success criteria, and, if needed, reasoning... instead of telling it what not to do. Don't put bad ideas in its head by even mentioning prohibited behaviors."

### 4. Research phase

Spawned a Sonnet subagent on the LLM Prompting Best Practices Research folder. Findings synthesized — all four V4 design directions confirmed:
- Negative-prohibition framing creates gravity wells; ALL CAPS / MUST / NEVER are now anti-patterns on Claude 4.6.
- Append-only file state outperforms rewrite-the-document state.
- Phase-aware context selection is the structural fix for "answer in context while teaching."
- Single-context skills must compensate for the lack of fresh-context isolation via observable structural cues (the journal's most recent entry declaring the mode).

### 5. Plan phase

Created a structured plan as `C:\Users\2supe\.claude\plans\one-thing-to-note-sequential-honey.md`. Covered: design principles, concrete changes per file, files to create, files to modify, what V4 will *not* include, verification procedure.

User vetoed two proposed structures during plan refinement:
- Rejected a proposed `answer_key.md` separate file ("We are not adding any additional files. We are not making an answer key.md or anything else like that.") — replaced with behavioral discipline rule.
- Rejected a proposed Python init script — replaced with a bundled template file + copy instruction.

User confirmed sub-concept granularity decision: AI judges per question (default 1, decompose multi-concept clusters).

### 6. Implementation

Wrote V4 in this order:
1. `SKILL.md` rewrite — XML-tagged role / goal / rules / turn-types, append-only journal protocol.
2. `paths/practice-walkthrough.md` rewrite — firewall replaced with "Teaching turns during Path D"; Step 2d looks up answer key just-in-time; early-close branch added.
3. `paths/diagnostic-quiz-generated.md`, `diagnostic-quiz-imported.md`, `active-learning.md` — full rewrites against journal model.
4. `references/teaching-turn-examples.md` — 3 worked examples with annotations.
5. `assets/teach_list_template.md` — minimal session-start template.

User explicitly skipped V3 snapshot ("you don't need a snapshot V3, I already have one") and re-pasted the prompting best practices doc to keep V4 anchored to the principles during build.

### 7. Verification

Pre-flight checks all passed:
- All files ≤ 500 lines.
- Zero matches across the skill directory for `MUST`, `NEVER`, `ALWAYS`, `DO NOT`, or `firewall`.
- Every rule and turn type carries Goal / Success criterion / Reasoning.

### 8. Post-build review — two real gaps caught and folded into V4

After declaring V4 done, user asked whether the skill still grounds concept teaching in source materials. Honest answer: partially. Two real holes existed in the V4 draft:

1. **Cluster identification wasn't tied to source-material search.** The Teaching approach rule said "identify the full sub-concept cluster of the parent topic" but didn't say *how*. With nothing constraining it, the AI could build the cluster from training-data memory — same family of failure as V3.
2. **Gap sub-process was referenced six times across SKILL.md and path files but the actual numbered step list got dropped.** "Run the gap sub-process from `SKILL.md`" pointed at nothing.

User wanted these folded into V4 (not bumped to V5), kept high-level, and framed positively as "use whatever tools you have to maximize context — and if you have project file search, use it thoroughly."

**Fixes folded in:**
- New `<rule name="grounding-concepts-in-the-source">` between source-material-discipline and question-design. Goal: every concept and cluster is shaped by the student's source materials, not training-data memory. Success criterion: the cluster matches what's in the documents. How: use whatever tools you have — file reads, project-file search, retrieval mechanisms — to maximize context before teaching. If you have access to project file search, search thoroughly per topic and per concept.
- New `## Gap sub-process` section at the end of RULES (positively framed, six steps, each tied to a journal action: name → dependency check → teach → confirm → evaluate → repeated-misses signal).

Post-fix verification re-ran clean: SKILL.md now 451 lines (still under 500); zero MUST/NEVER/ALWAYS/DO NOT/firewall matches; both new sections carry Goal / Success criterion / Reasoning where applicable. V4 zip rebuilt with the updates.

### 9. KISS pass — V4 final trim

User asked for an honest "keep it simple, stupid" pass over the whole skill — anything over-engineered, surface it. Identified seven items and folded all of them in.

**Cuts applied:**
1. **Dropped the `## Now` 3-line snapshot header** in `teach_list.md`. The journal is the source of truth and is read bottom-up; the snapshot was a second source of truth that needed per-turn synchronization. Template now opens straight to `## Journal`.
2. **Trimmed journal events from 10 → 7.** Removed `STILL-OPEN` (absence of `MASTERED` already implies open), `CLARIFY-PASS` (a passing clarification appends `MASTERED` directly), `CLARIFY-ASK` (the next outcome line implies a clarification happened), and `Q-CLOSE` (the next `Q-OPEN` implies the previous question is done). Kept `Q-OPEN`, `SUB-ADD`, `TEACH-TURN`, `ATTEMPT`, `CLARIFY-FAIL`, `MASTERED`, `ESCALATE`.
3. **Compressed TURN TYPES** from two heavy 6-field blocks (Goal / Success / Inputs / Output shape / Journal entry / Reasoning each) to two short paragraphs each. Dropped the "Mode is observable" closing meta-paragraph.
4. **Simplified UNIVERSAL CLOSE summary** from four pattern-mining bullets (mastered / prereq-drilled / escalated / unmastered) to two (mastered / not yet mastered).
5. **Folded three thin rules**: dropped the standalone `<rule name="visuals">` (one line in teaching-template now), dropped `<rule name="what-counts-as-a-correct-answer">` (folded into evaluating-answers), dropped `<rule name="personalization">` (folded into the `<role>` block).
6. **Merged FOOTER PROTOCOL overlap**: collapsed "Core principle" and "One footer in flight at a time" into one paragraph.
7. **Dropped `=== OPEN QUESTION ===` footer type.** Free-form prompts can use plain prose or fold into `=== CLARIFICATION QUESTION ===`.

Net effect: SKILL.md 451 → 337 lines (~25% smaller). Path files lightly trimmed where they referenced dropped events. Total skill ~770 → 599 lines. V4 zip rebuilt with the trimmed files.

Final verification:
- All files ≤ 500 lines (SKILL.md 337).
- Zero `MUST` / `NEVER` / `ALWAYS` / `DO NOT` / `firewall` matches.
- Zero references to dropped events (`## Now`, `CLARIFY-ASK`, `CLARIFY-PASS`, `STILL-OPEN`, `Q-CLOSE`).

---

## Decisions confirmed during the chat

1. Sub-concept decomposition: AI judgment per question.
2. Scope: rewrite all four path files for consistency.
3. Initialization: bundled template file + manual copy. No script.
4. No new state files (no `answer_key.md`, etc.). Behavioral discipline on answer key access during Teaching turns.
5. Worked examples: 3 in `references/teaching-turn-examples.md`.
6. V3 snapshot: skipped (user already had it).

---

## Artifacts produced during this chat

- `v3-to-v4-changes.md` (this folder) — concrete change summary.
- `v4-build-history.md` (this file) — conversation log.
- Updated `active-learning-skill-watch-list.md` (E-Stack folder) — V4-aligned watch items.
- `V4-active-learning-tutor.zip` (E-Stack folder) — snapshot of the V4 skill files.

The next study session is the empirical test of V4. Findings from that session feed the next iteration.
