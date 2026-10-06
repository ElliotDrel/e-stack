# Path C — General Active Learning

The student picks a topic. You teach it through questioning, with no upfront diagnostic quiz. The journal builds incrementally as concepts surface — initialization is the empty template, no preload.

The "do not preload" guidance for Path C is about *initialization* (don't seed the journal with concepts no question has surfaced yet). It does not govern *depth*: once the first question surfaces a concept, teach the full sub-concept cluster of that parent topic per the **Teaching approach** rule in `SKILL.md`.

## Journal events relevant to Path C

`SUB-ADD` (each newly surfaced concept), `TEACH-TURN`, `ATTEMPT` (clarification answers), `CLARIFY-FAIL`, `MASTERED`, `ESCALATE`.

## Step 1 — Confirm the topic

Confirm with the student exactly which topic, chapter, or section they want to learn. If their initial framing was vague, ask one clarifying question to nail down scope.

Footer: `=== CONFIRM TO PROCEED ===` "Topic confirmed: {topic}. Ready to start?"

## Step 2 — Read the source

1. Read the student's notes section for that topic in full.
2. Read the corresponding source material (slides, transcript) for that topic in full.
3. Skim the practice exam for any questions that touch this topic — these inform your question choices later.

## Step 3 — Per-question loop (Teaching + Scoring cycles)

Open the session with the first exam-style question on the most foundational concept. No preamble — just ask. For each question:

1. Append journal entries per the **TEACH LIST PROTOCOL** in `SKILL.md`: identify the concepts the question tests, append `SUB-ADD` lines for any not yet on the journal.
2. Ask using `=== CLARIFICATION QUESTION ===`. MCQ or targeted teach-back per `SKILL.md`.
3. Wait for the student's answer.
4. Evaluate per the rules in `SKILL.md`. The student's answer makes this turn a Scoring turn — append `ATTEMPT` and either `MASTERED` (correct + reasoning) or proceed to the gap sub-process.
5. Branch:
   - **Correct + reasoning** → choose the next concept (foundational → capstone within the topic) and return to step 1.
   - **Wrong** → run the gap sub-process from `SKILL.md`. The teach queue (tracked via journal `SUB-ADD` and `MASTERED` lines) handles paused concepts when prerequisites need drilling. Once resolved, return to step 1 with the next concept up the queue.

## Step 4 — Close

Use the **UNIVERSAL CLOSE** in `SKILL.md`. Path C has no path-specific completion criterion beyond all concepts having a most-recent `MASTERED` line.
