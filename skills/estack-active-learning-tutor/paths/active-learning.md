# Path C — General Active Learning

The student picks a topic. You teach it through questioning, with no upfront diagnostic quiz. The teach list is built incrementally (JIT) as concepts come up.

---

## Step 1 — Confirm the topic

Confirm with the student exactly which topic, chapter, or section they want to learn. If their initial framing was vague, ask one clarifying question to nail down scope before continuing.

Footer: `=== CONFIRM TO PROCEED ===` "Topic confirmed: {topic}. Ready to start?"

---

## Step 2 — Read the relevant source

Once the topic is confirmed:
1. Read the student's notes section for that topic in full.
2. Read the corresponding source material (slides, transcript) for that topic in full.
3. Skim the practice exam for any questions that touch this topic — these will inform your question choices later.

Do not preload `teach_list.md`. Concepts will be added as questions are asked.

---

## Step 3 — Begin asking questions

Open the session with the first exam-style question on the most foundational concept of the topic. No preamble, no "let's start with…" framing — just ask.

For each question, follow this loop:

### 3a. Before asking
1. Identify every concept the question tests. List them explicitly to yourself.
2. Add each to `teach_list.md` as NOT STARTED if not already present (group under appropriate Major Topic headings; create the heading if needed).
3. Mark the primary concept being tested as IN PROGRESS.

### 3b. Ask
Use a `=== CLARIFICATION QUESTION ===` footer. MCQ or targeted teach-back per `shared/rules.md`.

### 3c. Wait
Do not respond until the student answers.

### 3d. Evaluate
Per `shared/rules.md` — correct + reasoning, correct + shallow, wrong + diagnose.

### 3e. Update
Update `teach_list.md` — increment counters, change statuses, recompute summary.

### 3f. Branch
- **Correct** → choose the next concept (foundational → capstone) and return to 3a.
- **Wrong** → run the gap sub-process from `shared/rules.md`. The concept stack tracks paused concepts when prerequisites need drilling. Once the gap is resolved, return to 3a with the next concept up the stack.

---

## Step 4 — Choosing the next concept

After each correct answer, choose the next concept based on:
- What the student just demonstrated they own (don't waste their time on prerequisites of that)
- The topic's natural progression in the source material
- What the practice exam (skimmed in Step 2) will likely test

Move foundational → capstone within the topic.

---

## Step 5 — Watchlist drilling

After every concept resolution, scan the Repeated-miss watchlist in `teach_list.md`. For any item there:
- Drill into a likely prerequisite. The student probably has a deeper gap than what you've been teaching.
- The teach-count is your alarm bell. Two failed teaching attempts on the same concept means you're not at the root yet.

This is the most important reason to track teach-count per concept — it tells you when to stop trying to teach a concept and start teaching whatever is underneath it.

---

## Step 6 — Practice exam (if available)

If the topic has corresponding practice exam questions, once every relevant concept is MASTERED:
- Walk the student through those questions, one at a time.
- Use `=== CLARIFICATION QUESTION ===`. (Path C does not use `=== ACTIVE QUESTION ===`; that's reserved for path D's firewall flow.)
- Same evaluation flow as Step 3.

---

## Step 7 — Close

Session is complete when every concept on the teach list is MASTERED and any related practice exam questions are answered correctly with reasoning.

Close with a bulleted summary in the body of every concept mastered, organized by Major Topic, plus any watchlist items that required deeper drilling and any concepts that remained unmastered.

Final response still ends in a footer (`=== CONFIRM TO PROCEED ===` "Wrap up here?" or similar).
