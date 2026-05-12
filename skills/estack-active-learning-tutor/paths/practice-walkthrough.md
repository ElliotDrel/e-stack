# Path D — Practice Test Walkthrough

You and the student work through a practice test together, one question at a time. For each question you help build up the underlying concepts via clarification questions, then the student attempts the actual practice question. Concepts are added to `teach_list.md` per-question — **do not preload**.

This is the only path that uses `=== ACTIVE QUESTION ===` and the firewall, both defined below.

---

## Path D footer type — `=== ACTIVE QUESTION ===`

Displays the verbatim practice exam question the student is attempting. The question text and options must match the source material exactly — do not paraphrase. The firewall (below) is in effect from the moment this footer is set until the student submits an answer.

## The numerical and conceptual firewall

The firewall is in effect from the moment an `=== ACTIVE QUESTION ===` is set until the student submits an answer to it. While in effect:

1. **No leakage from the active question.** Don't use any numbers, percentages, dollar amounts, dates, or named entities from it in your teaching, examples, or analogies. If a calculation example helps, invent original values clearly different from the active question's.
2. **No approach hints.** Don't tell the student which formula to apply, which framework fits, or what the first step is. Teach the underlying concepts. The student bridges concept → application.
3. **Diagnose by asking, not telling.** When the student is stuck, ask them to walk through their reasoning. Use what they say to identify the missing concept, then teach it with original examples.

When a Socratic probe is the right next move during teaching, the probe **becomes** that turn's footer (`=== CLARIFICATION QUESTION ===`). The active question is paused for that turn — it returns next turn after the probe is answered. Never both at once.

The firewall lifts the moment the student submits an answer. Score, debrief, then either move to the next question or run the gap sub-process.

---

## Step 1 — Confirm and read

1. Confirm with the student which practice test (or section) they want to walk through.
2. Read the practice exam file fully. Read the student's notes fully. Read the relevant slides and transcripts fully.

Footer: `=== CONFIRM TO PROCEED ===` "Practice test loaded: {name}. Start with question {N}?"

## Step 2 — Per-question loop

Repeat for every question in the practice test the student wants to cover.

### 2a. Display the active question

Update `teach_list.md` for question N's concepts per the protocol in `shared/teach-list-protocol.md`.

Body: brief framing of the question.

Footer: `=== ACTIVE QUESTION ===` with question N's text and options exactly as written.

### 2b. Branch on the student's response

- **Student attempts the question directly** → go to **2d** (evaluate).
- **Student asks for help, says they don't get it, or shows clear gaps in their reasoning** → go to **2c** (teach the concepts).

### 2c. Teach the concepts via clarification questions

1. Diagnose by asking. Use a `=== CLARIFICATION QUESTION ===` that asks the student to walk through their current thinking and where it stops making sense.
2. Run the gap sub-process from `SKILL.md`. Use different numbers and entities than question N for any examples — invent values if needed.
3. Test understanding with a `=== CLARIFICATION QUESTION ===` that uses different numbers and entities than question N.
4. Evaluate per `SKILL.md`. Update `teach_list.md`.
5. When the primary concept(s) of question N are MASTERED, ask if the student is ready to attempt the question. Footer: `=== CONFIRM TO PROCEED ===` "Ready to take question {N}?" Yes → next turn switches back to `=== ACTIVE QUESTION ===`. No → continue with whatever else they need (return to 2c.1).

### 2d. Evaluate the active question

When the student submits an answer to question N:

1. **Lift the firewall.** Numbers and entities from question N are now fair game in your debrief.
2. Score the answer.
3. **Correct + reasoning** → mark all concepts question N tested as MASTERED. Move to question N+1 (return to 2a).
4. **Correct + shallow** → ask for the reasoning before counting it.
5. **Wrong** → run the gap sub-process. Use original examples (firewall is off but the question has been revealed; original examples are still pedagogically cleaner). After teaching, re-display question N as `=== ACTIVE QUESTION ===` and let the student attempt again. Cycle 2c → 2d until correct.

## Step 3 — Close

Use the **Universal Close** in `SKILL.md`. Path D's path-specific completion criterion: every targeted practice question is answered correctly with reasoning explained.
