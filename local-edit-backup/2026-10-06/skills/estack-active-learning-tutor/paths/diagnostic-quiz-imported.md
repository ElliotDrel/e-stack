# Path B — Diagnostic Quiz (Student-Provided)

The student shares a completed practice quiz with their answers; you treat it as the diagnostic and run active learning on what they missed.

Path B **preloads** the journal — the quiz defines the concept inventory, and every concept tested by the quiz gets a `SUB-ADD` line at import time. Status transitions to `MASTERED` (correct on the quiz) or to a teaching cycle (incorrect on the quiz) happen during scoring in Step 2.

## Journal events relevant to Path B

`SUB-ADD` (preload + any newly surfaced concepts during teaching), `ATTEMPT` (per-question quiz answer), `TEACH-TURN`, `CLARIFY-FAIL`, `MASTERED`, `ESCALATE`.

## Step 1 — Import the completed quiz

1. Ask the student to share the practice quiz with their answers. Accept upload, paste, or photo.

   Footer: `=== CONFIRM TO PROCEED ===` "How would you like to share your quiz?"

2. Once shared, read the practice exam file in scope and the student's submission together.
3. For each question on the quiz, identify which concept(s) it tests. Use the practice exam, slides, and notes as authority — not your assumption about what the question "should" test.
4. **Preload the journal** per the **TEACH LIST PROTOCOL** in `SKILL.md`:
   - Initialize `teach_list.md` from `assets/teach_list_template.md` and fill in placeholders.
   - For each parent topic, append a `SUB-ADD` line per identified concept. Order foundational → capstone within each topic.

Status assignment happens in Step 2 (scoring).

## Step 2 — Score and debrief (Scoring turn)

1. Score each question on the student's quiz by reading the answer key from its original source location (the practice exam file the student shared, the project file, or wherever the canonical answer lives). Look it up just-in-time; don't transcribe it elsewhere.
2. For each correct answer with sound reasoning → append `ATTEMPT correct` and `MASTERED` lines for the concept(s) tested.
3. For each incorrect answer → append `ATTEMPT incorrect`. With no `MASTERED` line, the concept remains in the queue for active learning.
5. In your response body, present a results summary organized by parent topic:
   - Score (e.g., "14 / 20 — you already own 70% of this material")
   - For each incorrect answer, state the correct answer and the misconception in one sentence each. Quick debrief, not a lesson.
6. Tell the student which concepts you'll work through together, in foundational → capstone order.

Footer: `=== CONFIRM TO PROCEED ===` "Ready to start active learning on these gaps?"

## Step 3 — Active learning on gaps (Teaching + Scoring cycles)

For each concept whose most recent journal line is `ATTEMPT incorrect` (no `MASTERED` after it):

1. Re-read the notes entry and the relevant source material section before teaching.
2. Run the **gap sub-process** from `SKILL.md`. Append `TEACH-TURN`, `CLARIFY-FAIL` (on misses), and `MASTERED` lines as the cycle progresses.
3. Move foundational → capstone. Resolve prerequisite gaps before dependent ones — push prerequisites to the front of the queue when needed.

Continue until every concept on the journal has a most-recent `MASTERED` line.

## Step 4 — Close

Use the **UNIVERSAL CLOSE** in `SKILL.md`. Path B has no path-specific completion criterion beyond all concepts having a most-recent `MASTERED` line.
