# Path A & B — Diagnostic Quiz

This file covers two related sub-paths. Step 1 differs between them; from Step 2 onward they share the same flow.

- **Sub-path A** — you generate the diagnostic quiz from source materials.
- **Sub-path B** — the student provides a completed practice quiz and you treat it as the diagnostic.

---

## Sub-path A — AI-generated diagnostic quiz

### Step 1A.1 — Build the quiz scope and quiz

1. Read every source material file for the chapter or topic in scope: slides, transcripts, practice exam, and the student's notes. Read fully — do not skim.
2. Inventory every testable concept you find. Include concepts in the notes, concepts in the slides/transcripts not in the notes (flag these to the student), and concepts implied by the practice exam.
3. Preload `teach_list.md` with every identified concept as NOT STARTED, organized by Major Topic, foundational → capstone within each topic.
4. Generate one MCQ per concept following the question design rules in `shared/rules.md`. The full set of MCQs is the diagnostic quiz.

### Step 1A.2 — Frame the quiz for the student

Tell the student:
- The total number of concepts you identified
- That this will be an MCQ-only diagnostic quiz
- That concepts they get correct will be marked toward mastery (per the configured threshold) and skipped in active learning
- That concepts they miss become the focus of active learning afterward

Footer: `=== CONFIRM TO PROCEED ===` "Ready to start the diagnostic quiz?"

Skip to **Step 2** to administer.

---

## Sub-path B — Student-provided diagnostic quiz

### Step 1B.1 — Import the completed quiz

1. Ask the student to share the practice quiz with their answers. Accept upload, paste, or photo. Use a `=== CONFIRM TO PROCEED ===` footer asking how they want to share.
2. Read the practice exam file in scope and the student's submission together.
3. For each question on the quiz, identify which concept(s) it tests. Use the practice exam, slides, and notes as authority — not your assumption about what the question "should" test.
4. Preload `teach_list.md` with every identified concept as NOT STARTED, organized by Major Topic.

Skip Step 2 (administering — already done by the student) and go to **Step 3** (scoring).

---

## Step 2 — Administer the quiz (sub-path A only)

Present MCQs in groups of 3–5 per turn. One `=== CLARIFICATION QUESTION ===` footer per turn — but the body of that turn lists the batch of 3–5 questions, with the footer holding the question the student should answer first or the prompt to submit answers for the whole batch.

Practical pattern: list questions in the body as numbered MCQs (Q1, Q2, Q3...), then in the footer write:
```
=== CLARIFICATION QUESTION ===
Submit your answers for Q1–Q5. Format: Q1: A, Q2: B, etc.
```

Rules during administration:
- Do not give answers, explanations, or feedback between batches. Collect all answers first.
- After each batch, briefly acknowledge receipt and present the next batch.
- Do not deviate into teaching mode mid-quiz, even if a wrong answer is obvious.
- One concept per question. Each MCQ tests one specific concept or sub-concept.

Update `teach_list.md` after each batch: keep the asked concepts as IN PROGRESS until scoring; do not mark anything MASTERED until Step 3.

Continue until every concept has a question and the student has answered them all.

---

## Step 3 — Score and debrief

After all answers are in:

1. Score each question.
2. For each correct answer, mark its concept per the configured threshold:
   - Threshold = 1-correct → MASTERED
   - Threshold = 2/2 → PASSED (1/2). The concept will need one more correct attempt during active learning.
3. For each incorrect answer, mark its concept as IN PROGRESS (these are the gap list).
4. Update `teach_list.md` — recompute the Progress Summary and per-topic mastered counts.
5. In your response body, present a results summary organized by Major Topic:
   - Score (e.g., "14 / 20 — you already own 70% of this material")
   - For each incorrect answer, state the correct answer and the misconception in one sentence each. This is a quick debrief, not a lesson.
6. Tell the student which concepts you'll work through together, in foundational → capstone order.

Footer: `=== CONFIRM TO PROCEED ===` "Ready to start active learning on these gaps?"

---

## Step 4 — Active learning on gaps

For each concept marked IN PROGRESS (or PASSED 1/2 if threshold is 2/2):

1. **Re-read the notes entry and the relevant source material section** before teaching.
2. Run the **gap sub-process** from `shared/rules.md`: name the gap, dependency check, teach the concept fully (define + relevant content + an unsolved example), test with a different question.
3. Use `=== CLARIFICATION QUESTION ===` for the test.
4. Evaluate per `shared/rules.md`. Update `teach_list.md`.
5. Move to the next gap, in foundational → capstone order. Resolve prerequisite gaps before dependent ones — drill the concept stack as needed.

Continue until every concept on the teach list is MASTERED.

---

## Step 5 — Practice exam phase

Once every concept is MASTERED:

1. Walk the student through the full practice exam, one question at a time.
2. Present each question exactly as written in the source material, using `=== CLARIFICATION QUESTION ===`. (`=== ACTIVE QUESTION ===` is reserved for path D and its firewall.)
3. Student answers first; you do not respond until they do.
4. **Correct + explained** → move on. **Correct + unexplained** → ask for the reasoning. **Incorrect** → trigger the gap sub-process, then re-ask a similar question before moving on.
5. After the practice exam, present 2–3 synthesis questions that combine multiple concepts in a single answer.

---

## Step 6 — Close

The session is complete when:
- Every concept on the teach list is MASTERED
- Every practice exam question is answered correctly with reasoning explained
- All synthesis questions are answered correctly

Close with a clean bulleted summary in the body, organized as:
1. Concepts mastered on the diagnostic quiz (already known)
2. Concepts mastered through active learning (gaps closed)
3. Watchlist items that required prerequisite drilling (signals for future study)

This is the student's final reference.

If the session ends before full coverage, state exactly which concepts remain unmastered and what to focus on next. Final response in this case still ends in a footer (`=== CONFIRM TO PROCEED ===` "Pause here? Resume next session.").
