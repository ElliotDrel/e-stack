# Active Learning Skill — V3 → V4 Changes

**Date:** 2026-05-07
**Trigger:** V3 failed on the very first turn of the next study session. User triggered Path D, said "idk teach me risk" on Q1, and the skill misfired in five compounding ways.

---

## Why V4 happened

V3's failure modes (running AI's own diagnosis confirmed each):

1. **Variable isolation rule named values, missed logical structure.** Teaching renamed the numbers but reproduced the active question's comparative shape and inferential map.
2. **Answer key gravity well.** The correct option ended up sitting in `teach_list.md` (or the AI's working summary of it), and the teaching content drifted toward leaking it.
3. **Question-scope teaching instead of cluster-scope.** "Teach the whole concept" and "do not preload" contradicted each other; the AI resolved the contradiction by teaching only the sliver Q1 needed (just risk-averse), skipping EV, variance, the other two preference types, and the EV-independence trap.
4. **Teaching template ignored.** No headline, no formal definition, no formula — just prose answering Q1.
5. **Teach list stuck at `0 / 0 mastered`.** The per-turn Progress Summary recompute is an unrealistic ongoing obligation; the AI didn't fulfill it.

Cross-validated against an LLM Prompting Best Practices research sweep — the four diagnosed weaknesses map cleanly onto known anti-patterns: prohibition framing creates gravity wells, ALL-CAPS / MUST / NEVER are anti-patterns on Claude 4.6, append-only state outperforms rewrite-the-document, mode separation must be structural to be reliable.

---

## Design principles V4 follows

1. **Positive framing only.** Every rule states what success looks like with reasoning. No "do not", no MUST/NEVER, no "firewall."
2. **Two turn types, named and observable.** Teaching turns and Scoring turns are distinct, with different goals, inputs, and outputs. The journal entry written during a turn declares which type it was.
3. **Concept-general teaching.** A teaching turn produces material that would help any student facing any analogous problem. The active question's specifics belong only to the Scoring turn.
4. **Append-only journal teach list.** Each turn appends one or more lines. Status of any concept = its most recent line. No top recompute.
5. **Answer key stays in its original source.** Skill never transcribes it into a separate file. It is consulted only during a Scoring turn, just-in-time, by reading where the student first provided it. (Behavioral mitigation, since file-load gating is unavailable in single-context skills.)
6. **Show, don't just tell.** 2–3 worked example teaching turns are bundled in `references/teaching-turn-examples.md`.
7. **Stay under the context cliff.** SKILL.md = 417 lines (under the 500-line skill-creator guidance).

---

## Concrete changes

### SKILL.md
- `<role>` block adds the concept-general framing for teaching turns.
- **RULES section** uses XML `<rule>` tags around each rule. Every rule has Goal / Success criterion / Reasoning.
- **Teaching approach** rule now resolves the V3 contradiction explicitly: "do not preload" governs *initialization*, not *depth*. Once a question surfaces a concept, teach the full sub-concept cluster.
- **Teaching template** keeps headline/definition/bullets/formulas; reframes "exam traps" as concept-general traps demonstrated with invented scenarios.
- **NEW: `grounding-concepts-in-the-source` rule.** Every concept and cluster is shaped by the student's source materials, not training-data memory. Tells the AI to use whatever tools it has — file reads, project-file search, retrieval mechanisms — to maximize context before teaching. "If you have access to project file search, search thoroughly per topic and per concept." Closes a real V4-draft gap where cluster identification could happen from memory.
- **NEW: Gap sub-process section** restored at the bottom of RULES. Six-step flow (name → dependency check → teach → confirm → evaluate → repeated-misses signal). Each step ties to a journal action. Six places across SKILL.md and path files reference "the gap sub-process" — the actual step list is now back where they point.
- **NEW: TURN TYPES section.** Defines Teaching turns and Scoring turns with goal, success criterion, inputs, output shape, journal entry, and reasoning each. Mode is observable via the most recent journal line.
- **TEACH LIST PROTOCOL** — full rewrite. Replaced Progress Summary / Concept Map / per-topic counts / counters with an append-only journal under a 3-line `## Now` header. 10 named event types. Sub-concept granularity is AI-judged per question.
- **UNIVERSAL CLOSE** — drops the recompute validation step. New close generation: scan the journal bottom-up.
- **Pointer** added to `references/teaching-turn-examples.md`, with instruction to read it once per session before the first teaching segment.

### `paths/practice-walkthrough.md` (Path D)
- Removed the "firewall" framing entirely.
- New section: **Teaching turns during Path D**. Goal-driven success criterion (peer who never saw the active question could read the body and learn the concept). 6 concrete shape rules. GOOD vs. drift comparison shown for the same active question.
- **Step 2c** updated to append journal lines (`CLARIFY-ASK`, `TEACH-TURN`, `MASTERED`, etc.) at every stage.
- **Step 2d** Scoring turn looks up the answer key just-in-time from its original source location. Appends `ATTEMPT`, `MASTERED`, `Q-CLOSE`.
- **Early-close branch** added — if student is out of time, generate close from current journal state.

### `paths/diagnostic-quiz-generated.md` (Path A) — full rewrite
- Preload now happens as a sequence of `SUB-ADD` lines under each parent topic.
- Scoring step appends `ATTEMPT`, `MASTERED`, `STILL-OPEN` lines per question.
- Active learning step references journal events for tracking gap progress.

### `paths/diagnostic-quiz-imported.md` (Path B) — full rewrite
- Same model as Path A: preload via `SUB-ADD` at import time, score via journal lines.

### `paths/active-learning.md` (Path C) — full rewrite
- No preload. Journal builds incrementally as concepts surface.
- Cluster-depth still applies once a question surfaces a parent topic.

### NEW: `references/teaching-turn-examples.md`
3 fully written GOOD example teaching turns with annotation:
1. "teach me risk" cold start on the V3-failed risk-preferences MCQ — rewritten correctly. The headline example.
2. Wrong attempt on a multi-step calculation (production budget) — formula-then-dummy-example pattern.
3. "I don't get it" cold start on NPV — calculation-heavy concept-first pattern.

Each example shows the active question (header only), the student prompt, the teaching turn body, and a "why this passes" annotation.

### NEW: `assets/teach_list_template.md`
Minimal template the AI copies into the working directory at session start. Three placeholders to fill in.

---

## What V4 does *not* include (deliberate omissions)

- No `answer_key.md` or any other new state file (user rejected).
- No top-level Progress Summary in the teach list (replaced by the 3-line `## Now` header).
- No description optimization (auto-trigger is disabled; description irrelevant).
- No subagent delegation (single-context skill runtime).
- No Python initialization script (template file + manual fill instead).

---

## Files modified / created

**Modified:**
- `SKILL.md` (369 → 337 lines after KISS pass)
- `paths/practice-walkthrough.md` (full rewrite)
- `paths/diagnostic-quiz-generated.md` (full rewrite)
- `paths/diagnostic-quiz-imported.md` (full rewrite)
- `paths/active-learning.md` (full rewrite)

**Created:**
- `references/teaching-turn-examples.md` (202 lines)
- `assets/teach_list_template.md` (8 lines)

**Snapshot:** `C:\Users\2supe\All Coding\E-Stack\e-stack\V4-active-learning-tutor.zip`

---

## Verification (pre-flight, all passed)

- All files ≤ 500 lines (SKILL.md 417, others well under).
- Zero matches across the skill directory for `MUST`, `NEVER`, `ALWAYS`, `DO NOT`, or `firewall`.
- Every rule and turn type has Goal, Success criterion, and Reasoning.

The next study session is the empirical test — see `active-learning-skill-watch-list.md` (in the E-Stack folder) for what to watch for.
