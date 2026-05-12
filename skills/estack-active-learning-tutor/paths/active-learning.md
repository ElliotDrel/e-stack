# Path C — General Active Learning

The student picks a topic. You teach it through questioning, with no upfront diagnostic quiz. Concepts are added to `teach_list.md` incrementally as they come up — **do not preload**.

## Step 1 — Confirm the topic

Confirm with the student exactly which topic, chapter, or section they want to learn. If their initial framing was vague, ask one clarifying question to nail down scope.

Footer: `=== CONFIRM TO PROCEED ===` "Topic confirmed: {topic}. Ready to start?"

## Step 2 — Read the source

1. Read the student's notes section for that topic in full.
2. Read the corresponding source material (slides, transcript) for that topic in full.
3. Skim the practice exam for any questions that touch this topic — these inform your question choices later.

## Step 3 — Per-question loop

Open the session with the first exam-style question on the most foundational concept. No preamble — just ask. For each question:

1. Update `teach_list.md` per the **Teach List Protocol** in `SKILL.md` (identify concepts, add absent ones as NOT STARTED, mark the primary concept as IN PROGRESS).
2. Ask using `=== CLARIFICATION QUESTION ===`. MCQ or targeted teach-back per `SKILL.md`.
3. Wait for the student's answer.
4. Evaluate per the rules in `SKILL.md`.
5. Update `teach_list.md`.
6. Branch:
   - **Correct** → choose the next concept (foundational → capstone within the topic) and return to step 1.
   - **Wrong** → run the gap sub-process from `SKILL.md`. The concept stack tracks paused concepts when prerequisites need drilling. Once resolved, return to step 1 with the next concept up the stack.

## Step 4 — Close

Use the **Universal Close** in `SKILL.md`. Path C has no path-specific completion criterion beyond all concepts MASTERED.
