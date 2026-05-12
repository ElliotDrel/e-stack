# Path D — Practice Test Walkthrough

You and the student work through a practice test together, one question at a time. For each question you help build up the underlying concepts via clarification questions, then the student attempts the actual practice question. Concepts are added to `teach_list.md` per-question — **do not preload**.

This is the only path that uses `=== ACTIVE QUESTION ===` and the firewall, both defined below.

---

## Path D footer type — `=== ACTIVE QUESTION ===`

Displays the verbatim practice exam question the student is attempting. The question text and options must match the source material exactly — do not paraphrase.

The footer holds everything the student needs to answer: question text, data tables, answer choices, setup context. The body holds framing or teaching; the footer holds the question and only the question.

The firewall (below) is in effect from the moment this footer is set until the student submits an answer.

---

## The numerical and conceptual firewall

**Goal while the firewall is in effect:** Teach the student the concepts they need so they can independently bridge to the active question. Their reasoning, not yours, is what gets them to the answer.

**Success criterion:** The student arrives at the answer through their own reasoning. Your teaching gave them the conceptual material to do it; your turns never narrated the active question's setup, reused its data, or walked through its arithmetic.

### What this looks like in practice

1. **Strict variable isolation.** When teaching a concept triggered by the active question, use entirely different names, dates, percentages, and dollar/unit values. If the active question is about March collections at 35/45/20, your teaching uses something like August collections at 10/60/30.

2. **Lead with the concept, not a worked example.** The default teaching segment per `SKILL.md` is concept → definition → mechanics → formula → exam traps. A worked example is added only after two genuine teaching attempts using different angles haven't landed (per the **Teaching approach** rule in `SKILL.md`). When you do escalate, the dummy scenario still follows variable isolation above.

3. **For MCQ active questions, teach the concept, not the option labels.** When the active question is multiple choice, your teaching does not enumerate the option labels (A/B/C/D's content) one-by-one. Teach the underlying concept and let the student map options to concept themselves. Walking through each option's category is functionally giving the answer.

4. **Confirmation before the active question returns.** After teaching, run the **Confirming understanding** flow from `SKILL.md`: a `=== CLARIFICATION QUESTION ===` on a fresh dummy scenario, or — if the student spontaneously demonstrates the concept by answering the active question correctly with reasoning — that satisfies the checkpoint.

5. **One footer in flight at a time.** Per `SKILL.md`'s footer protocol: when a Socratic probe is the right next move, the probe **becomes** that turn's footer (`=== CLARIFICATION QUESTION ===`). The active question is paused for that turn — not duplicated. It returns next turn after the probe resolves. Never both footers at once.

6. **Diagnose by asking, not telling.** When the student is stuck, ask them to walk through their reasoning. Use what they say to identify the missing concept, then teach it.

The firewall lifts the moment the student submits an answer. Score, debrief, then either move to the next question or run the gap sub-process.

---

## Step 1 — Confirm and read

1. Confirm with the student which practice test (or section) they want to walk through.
2. Read the practice exam file fully. Read the student's notes fully. Read the relevant slides and transcripts fully.

Footer: `=== CONFIRM TO PROCEED ===` "Practice test loaded: {name}. Start with question {N}?"

## Step 2 — Per-question loop

Repeat for every question in the practice test the student wants to cover.

### 2a. Display the active question

Update `teach_list.md` for question N's concepts per the **Teach List Protocol** in `SKILL.md`.

Body: brief framing of the question — no setup hints, no formula previews.

Footer: `=== ACTIVE QUESTION ===` with question N's text, data tables, and options exactly as written.

### 2b. Branch on the student's response

- **Student attempts the question directly** → go to **2d** (evaluate).
- **Student asks for help, says they don't get it, or shows clear gaps in their reasoning** → go to **2c** (teach the concepts).

### 2c. Teach the concepts

1. Diagnose by asking. Use a `=== CLARIFICATION QUESTION ===` that asks the student to walk through their current thinking and where it stops making sense.
2. Run the gap sub-process from `SKILL.md`. Teach using the **Teaching template** with strict variable isolation. The teach queue handles any prerequisite or adjacent gaps that surface — the active question does not return until the queue is empty.
3. Confirm understanding per `SKILL.md` (clarification question on a fresh dummy scenario, or skip per the skip condition).
4. Update `teach_list.md` at every stage per the gap sub-process actions.
5. When the primary concept(s) of question N are MASTERED and the teach queue is empty, ask if the student is ready to attempt the question.
   - Footer: `=== CONFIRM TO PROCEED ===` "Ready to take question {N}?"
   - Yes → next turn switches back to `=== ACTIVE QUESTION ===`. No → continue with whatever else they need (return to 2c.1).

### 2d. Evaluate the active question

When the student submits an answer to question N:

1. **Lift the firewall.** Numbers and entities from question N are now fair game in your debrief.
2. Score the answer. State the verdict on the active question (correct/incorrect, and which option) before discussing reasoning.
3. **Correct + reasoning** → mark all concepts question N tested as MASTERED. Move to question N+1 (return to 2a).
4. **Correct + shallow** → ask for the reasoning before counting it.
5. **Wrong** → run the gap sub-process. Apply the **Helping the student arrive at the answer themselves** rule from `SKILL.md`: don't disclose the answer. Teach, confirm understanding, then re-display question N as `=== ACTIVE QUESTION ===` for a retry. Cycle 2c → 2d until the student reaches the answer themselves.

The retry result and the next question are always different turns — never present Question N+1 in the same turn as scoring Question N's retry.

## Step 3 — Close

Use the **Universal Close** in `SKILL.md`. Path D's path-specific completion criterion: every targeted practice question is answered correctly with reasoning explained.
