# Path A — Diagnostic Quiz (AI-Generated)

You read all source materials, generate a comprehensive MCQ quiz covering every testable concept, the student takes it, and active learning runs only on what they miss.

Path A is the one path that **preloads** the journal. The full concept inventory is added as `SUB-ADD` lines at session start (organized by parent topic) so the diagnostic can target every testable idea. Status transitions to `MASTERED` (correct on the quiz) or to a teaching cycle (incorrect on the quiz) happen during scoring in Step 3.

## Journal events relevant to Path A

`SUB-ADD` (preload + any newly surfaced concepts during teaching), `ATTEMPT` (per-question quiz answer), `TEACH-TURN`, `CLARIFY-FAIL`, `MASTERED`, `ESCALATE`.

## Step 1 — Build and frame the quiz

1. Read every source material file for the chapter or topic in scope: slides, transcripts, practice exam, and the student's notes. Read fully — partial reads cause silent failures.
2. Inventory every testable concept. Include concepts in the notes, concepts in the slides/transcripts that aren't in the notes (flag these to the student), and concepts implied by the practice exam.
3. **Preload the journal** per the **TEACH LIST PROTOCOL** in `SKILL.md`:
   - Initialize `teach_list.md` from `assets/teach_list_template.md` and fill in placeholders.
   - For each parent topic, append a `SUB-ADD` line per identified concept. Order each topic foundational → capstone within itself.
4. Generate one MCQ per concept following the question design rules in `SKILL.md`.
5. Tell the student: the total concept count, that the quiz is MCQ-only, that correct answers count toward mastery and are skipped in active learning, and that wrong answers become the active learning focus.

Footer: `=== CONFIRM TO PROCEED ===` "Ready to start the diagnostic quiz?"

## Step 2 — Administer the quiz

Present MCQs in groups of 3–5 per turn. List the questions in the body as numbered MCQs (Q1, Q2, Q3...), then use a `=== CLARIFICATION QUESTION ===` footer asking the student to submit their answers for that batch (e.g., "Submit your answers for Q1–Q5. Format: Q1: A, Q2: B, etc.").

Each batch turn is a Teaching-style administration turn (no scoring yet). No journal entries needed during administration — scoring in Step 3 is what writes the events.

Rules during administration:

- Collect all answers first; feedback waits for Step 3.
- After each batch, briefly acknowledge receipt and present the next batch.
- Stay in administration mode for the full quiz — teaching detours wait for scoring.

Continue until every concept has been asked and the student has answered them all.

## Step 3 — Score and debrief (Scoring turn)

After all answers are in:

1. Score each question by reading the answer key from its original source (the question generation context, the source file, or the practice exam — whichever holds the canonical answer). Look it up just-in-time; don't transcribe it elsewhere.
2. For each correct answer with sound reasoning → append `ATTEMPT correct` and `MASTERED` lines for the concept(s) tested.
3. For each incorrect answer → append `ATTEMPT incorrect`. With no `MASTERED` line, the concept remains in the queue for active learning.
4. In your response body, present a results summary organized by parent topic:
   - Score (e.g., "14 / 20 — you already own 70% of this material")
   - For each incorrect answer, state the correct answer and the misconception in one sentence each. Quick debrief, not a lesson.
5. Tell the student which concepts you'll work through together, in foundational → capstone order.

Footer: `=== CONFIRM TO PROCEED ===` "Ready to start active learning on these gaps?"

## Step 4 — Active learning on gaps (Teaching + Scoring cycles)

For each concept whose most recent journal line is `ATTEMPT incorrect` (no `MASTERED` after it):

1. Re-read the notes entry and the relevant source material section before teaching.
2. Run the **gap sub-process** from `SKILL.md`. Append `TEACH-TURN`, `CLARIFY-FAIL` (on misses), and `MASTERED` lines as the cycle progresses.
3. Move foundational → capstone. Resolve prerequisite gaps before dependent ones — push prerequisites to the front of the queue when needed.

Continue until every concept on the journal has a most-recent `MASTERED` line.

## Step 5 — Close

Use the **UNIVERSAL CLOSE** in `SKILL.md`. Path A has no path-specific completion criterion beyond all concepts having a most-recent `MASTERED` line.
