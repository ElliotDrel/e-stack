# Path A — Diagnostic Quiz (AI-Generated)

You read all source materials, generate a comprehensive MCQ quiz covering every testable concept, the student takes it, and active learning runs only on what they miss.

## Step 1 — Build and frame the quiz

1. Read every source material file for the chapter or topic in scope: slides, transcripts, practice exam, and the student's notes. Read fully — do not skim.
2. Inventory every testable concept. Include concepts in the notes, concepts in the slides/transcripts that aren't in the notes (flag these to the student), and concepts implied by the practice exam.
3. **Preload `teach_list.md`** with every identified concept as NOT STARTED, organized by Major Topic, foundational → capstone within each topic.
4. Generate one MCQ per concept following the question design rules in `SKILL.md`.
5. Tell the student: the total concept count, that the quiz is MCQ-only, that correct answers count toward mastery and are skipped in active learning, and that wrong answers become the active learning focus.

Footer: `=== CONFIRM TO PROCEED ===` "Ready to start the diagnostic quiz?"

## Step 2 — Administer the quiz

Present MCQs in groups of 3–5 per turn. List the questions in the body as numbered MCQs (Q1, Q2, Q3...), then use a `=== CLARIFICATION QUESTION ===` footer asking the student to submit their answers for that batch (e.g., "Submit your answers for Q1–Q5. Format: Q1: A, Q2: B, etc.").

Rules during administration:
- Do not give answers, explanations, or feedback between batches. Collect all answers first.
- After each batch, briefly acknowledge receipt and present the next batch.
- Do not deviate into teaching mode mid-quiz, even if a wrong answer is obvious.

Concepts stay NOT STARTED in `teach_list.md` until scoring in Step 3.

Continue until every concept has been asked and the student has answered them all.

## Step 3 — Score and debrief

After all answers are in:

1. Score each question.
2. For each correct answer with sound reasoning → status → MASTERED in `teach_list.md`.
3. For each incorrect answer → status → IN PROGRESS (the gap list).
4. Recompute the Progress Summary and per-topic mastered counts.
5. In your response body, present a results summary organized by Major Topic:
   - Score (e.g., "14 / 20 — you already own 70% of this material")
   - For each incorrect answer, state the correct answer and the misconception in one sentence each. Quick debrief, not a lesson.
6. Tell the student which concepts you'll work through together, in foundational → capstone order.

Footer: `=== CONFIRM TO PROCEED ===` "Ready to start active learning on these gaps?"

## Step 4 — Active learning on gaps

For each concept marked IN PROGRESS:

1. Re-read the notes entry and the relevant source material section before teaching.
2. Run the **gap sub-process** from `SKILL.md`.
3. Move foundational → capstone. Resolve prerequisite gaps before dependent ones — drill the concept stack as needed.

Continue until every concept on the teach list is MASTERED.

## Step 5 — Close

Use the **Universal Close** in `SKILL.md`. Path A has no path-specific completion criterion beyond all concepts MASTERED.
