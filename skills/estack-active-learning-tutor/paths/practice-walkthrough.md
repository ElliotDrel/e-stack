# Path D — Practice Test Walkthrough

You and the student work through a practice test together, one question at a time. For each question you help build up the underlying concepts via clarification questions, then the student attempts the actual practice question. Concepts are added to `teach_list.md` per-question — the journal builds incrementally as questions surface them. The "do not preload" guidance is about *initialization* (don't seed the journal with concepts no question has surfaced yet); once a question surfaces a concept, teach the full sub-concept cluster of its parent topic per the **Teaching approach** rule in `SKILL.md`.

This is the only path that uses the `=== ACTIVE QUESTION ===` footer.

---

## Path D footer type — `=== ACTIVE QUESTION ===`

Displays the verbatim practice exam question the student is attempting. The question text and options match the source material exactly — no paraphrasing, no transcribed answer key, no reasoning hints in the footer block.

The footer holds everything the student needs to answer: question text, data tables, answer choices, setup context. The body holds framing or teaching; the footer holds the question and only the question.

While the `=== ACTIVE QUESTION ===` footer is in flight, every turn until the student submits an attempt is a **Teaching turn** (see SKILL.md's TURN TYPES section). The student submitting an attempt is what flips the next turn to a **Scoring turn**.

---

## Teaching turns during Path D

<goal>
When the active question is in flight and the student needs teaching, the teaching turn produces concept-general material that equips the student to bridge to *any* analogous problem on this concept.
</goal>

<success-criterion>
Take the teaching turn in isolation. A peer who has never seen the active question could read the body and learn the concept fully. Every sentence is concept-general — applicable to any analogous problem. If a sentence only makes sense given the active question's specific setup (its variables, comparative structure, inferential map, MCQ option logic), that sentence belongs in a Scoring turn instead.
</success-criterion>

<reasoning>
The student's job is to bridge concept → specific problem. If the teaching turn does the bridging for them, the student parrots rather than learns. This generalizes the V3 "variable isolation" idea (rename numbers and dates) to cover *logical* structure, not just values: the comparative shape of the question, the way the options carve up the concept space, and the inferential chain to the answer all live in the active question's territory. They belong to scoring.
</reasoning>

### Concrete shape of a Teaching turn during Path D

1. **Lead with the concept cluster, not a worked example.** The default teaching segment per `SKILL.md` is concept → definition → mechanics → formula → pitfalls. A worked example is added only on escalation per the **Teaching approach** rule.

2. **Use entirely fresh dummy values when illustrating mechanics.** Different names, dates, percentages, dollar/unit values. If the active question is about March collections at 35/45/20, an illustration uses something like August collections at 10/60/30.

3. **Teach the cluster, not the option labels.** When the active question is multiple choice, the teaching turn explains the underlying concept(s) so the student maps the options to the concept themselves. Walking through each option's category is a Scoring-turn move.

4. **Confirm understanding with a fresh dummy probe.** After teaching, run the **Confirming understanding** flow from `SKILL.md`: a `=== CLARIFICATION QUESTION ===` on a fresh dummy scenario, or — if the student spontaneously demonstrates the concept by answering the active question correctly with reasoning — that satisfies the checkpoint.

5. **One footer in flight at a time.** Per the FOOTER PROTOCOL in `SKILL.md`: when a Socratic probe is the right next move, the probe **becomes** that turn's footer (`=== CLARIFICATION QUESTION ===`). The active question is paused for that turn and returns next turn after the probe resolves.

6. **Diagnose by asking, not telling.** When the student is stuck, ask them to walk through their reasoning. Use what they say to identify the missing concept, then teach it.

### Worked example: GOOD vs. comparison teaching turn

For 2–3 fully written GOOD/comparison teaching turns with annotation, see `references/teaching-turn-examples.md`. The risk-preferences MCQ example is the most useful for Path D — read it before the first teaching segment of a Path D session.

A short illustrative contrast for the same active question ("Which of these gambles would a risk-averse person reject?"):

- **Concept-general body (GOOD):** *"Risk preferences classify how a decision-maker trades expected value against variance. A risk-averse person prefers a certain payoff to a gamble of equal expected value — the spread itself is a cost. Mechanically: given two prospects with the same expected value, a risk-averse person picks the one with lower variance. The exam trap to watch for: a higher EV gamble can still be rejected when the variance gap is large enough to outweigh the EV gain."*
- **Question-shaped body (drift):** *"Look at option A — it has higher expected value but more spread. Option B is a sure thing. A risk-averse person would..."* This sentence only exists because the active question structured itself this way. It's a Scoring-turn move.

---

## Step 1 — Confirm and read

1. Confirm with the student which practice test (or section) they want to walk through.
2. Read the practice exam file fully. Read the student's notes fully. Read the relevant slides and transcripts fully.

Footer: `=== CONFIRM TO PROCEED ===` "Practice test loaded: {name}. Start with question {N}?"

## Step 2 — Per-question loop

Repeat for every question in the practice test the student wants to cover.

### 2a. Display the active question

Append journal entries for question N's concept(s) per the **TEACH LIST PROTOCOL** in `SKILL.md`:

- One `Q-OPEN` line for question N with its parent topic.
- One or more `SUB-ADD` lines per the sub-concept granularity guidance (default one; decompose when the parent topic genuinely clusters into multiple distinct testable ideas).

Body: brief framing of the question — no setup hints, no formula previews.

Footer: `=== ACTIVE QUESTION ===` with question N's text, data tables, and options exactly as written in the source.

### 2b. Branch on the student's response

- **Student attempts the question directly** → next turn is a Scoring turn → go to **2d**.
- **Student asks for help, says they don't get it, or shows clear gaps in their reasoning** → next turn is a Teaching turn → go to **2c**.

### 2c. Teach the concepts (Teaching turns)

1. Diagnose by asking. Use a `=== CLARIFICATION QUESTION ===` that asks the student to walk through their current thinking and where it stops making sense.
2. Run the gap sub-process from `SKILL.md`. Teach using the **Teaching template** with the concept-general shape described above. The teach queue (tracked via `SUB-ADD` and `MASTERED` lines) handles any prerequisite or adjacent gaps that surface — the active question does not return until the queue is empty.
3. Confirm understanding per `SKILL.md` (clarification question on a fresh dummy scenario, or skip per the skip condition). Append `CLARIFY-FAIL` if the student missed it; on pass, the next step's `MASTERED` records the result.
4. Append a `TEACH-TURN` line listing the sub-concepts taught this turn. Append `MASTERED` lines as sub-concepts demonstrate mastery.
5. When the primary concept(s) of question N are MASTERED and the teach queue is empty, ask if the student is ready to attempt the question.
   - Footer: `=== CONFIRM TO PROCEED ===` "Ready to take question {N}?"
   - Yes → next turn switches back to `=== ACTIVE QUESTION ===`. No → continue with whatever else they need (return to 2c.1).

### 2d. Evaluate the active question (Scoring turn)

When the student submits an answer to question N, this turn is a Scoring turn:

1. **Look up the answer key just-in-time.** Read it from its original source location — the chat message where the student first provided it, the practice exam file, or the project file containing it. Do not transcribe it elsewhere; this turn's reference is enough.
2. State the verdict on the active question (correct / incorrect / partial, and which option) before discussing reasoning. Append an `ATTEMPT` line to the journal with the verdict.
3. **Correct + reasoning** → append `MASTERED` lines for every concept question N tested. Move to question N+1 (return to 2a).
4. **Correct + shallow** → ask for the reasoning before counting it.
5. **Wrong** → run the gap sub-process. Apply the **Helping the student arrive at the answer themselves** rule from `SKILL.md`: hold the answer until the student earns it. Teach (next turn flips back to Teaching), confirm understanding, then re-display question N as `=== ACTIVE QUESTION ===` for a retry. Cycle 2c → 2d until the student reaches the answer themselves.

The retry result and the next question are always different turns — present Question N+1 only on the turn after Question N's retry has been scored.

## Step 3 — Close

Use the **UNIVERSAL CLOSE** in `SKILL.md`. Path D's path-specific completion criterion: every targeted practice question is answered correctly with reasoning explained.

### Early-close branch

If the student announces they're out of time or stops mid-session, run the Universal Close immediately using the journal's current state. Scan the journal bottom-up: anything whose most recent line is `MASTERED` is owned; anything else is a cram item. Highlight unmastered concepts as the cram list for the student's remaining study time.
