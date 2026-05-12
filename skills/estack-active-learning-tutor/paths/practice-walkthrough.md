# Path D — Practice Test Walkthrough

You and the student work through a practice test together, one question at a time. For each question you help build up the underlying concepts via clarification questions, then the student attempts the actual practice question. The teach list is built JIT — concepts get added as you encounter them per-question.

This is the only path that uses `=== ACTIVE QUESTION ===` and the numerical/conceptual firewall.

---

## Step 1 — Confirm the test and read it

1. Confirm with the student which practice test (or which section of one) they want to walk through.
2. Read the practice exam file fully. Read the student's notes fully. Read the relevant slides and transcripts fully.
3. Do not preload `teach_list.md`. Concepts will be added per-question.

Footer: `=== CONFIRM TO PROCEED ===` "Practice test loaded: {name}. Start with question {N}?"

---

## Step 2 — Per-question loop

Repeat this loop for every question in the practice test the student wants to cover.

### 2a. Identify concepts and update teach list

Before showing the student anything for question N:
1. Read question N fully.
2. Identify every concept this question tests. List them explicitly to yourself.
3. Add each concept to `teach_list.md` as NOT STARTED (under appropriate Major Topic headings; create headings as needed) if not already present.
4. Mark the primary concept being tested as IN PROGRESS.

### 2b. Display the active question

Body: brief framing — e.g., "Here's question {N}. Take a swing at it, or tell me where you want help first."

Footer: `=== ACTIVE QUESTION ===` with question N's text and options exactly as written.

From this turn onward, **the firewall is in effect** for every subsequent turn until the student submits an answer to question N. No numbers from question N in any teaching, examples, analogies. No formula-mapping. No approach hints. (See `shared/footer-protocol.md` section "The numerical and conceptual firewall.")

### 2c. Branch on the student's response

**Student attempts question N directly** → go to **2e** (evaluate).

**Student asks for help, says they don't get it, or shows clear gaps in their reasoning** → go to **2d** (teach the concepts).

### 2d. Teach the concepts via clarification questions

The firewall is in effect throughout this step.

1. **Diagnose by asking, not telling.** Ask the student to walk through their current thinking. Use `=== CLARIFICATION QUESTION ===`:
   ```
   === CLARIFICATION QUESTION ===
   Walk me through how you're thinking about this so far. Where does it stop making sense?
   ```
   Their answer reveals the gap.

2. **Run the gap sub-process** from `shared/rules.md`. Teach the concept fully:
   - Define it (from the source material)
   - Cover what they need to own it
   - Present an example from the source material that uses **different numbers and entities than question N** — invent values if needed
   - Do not solve the example; let them try it

3. **Test understanding** with a `=== CLARIFICATION QUESTION ===` that uses different numbers and entities than question N.

4. **Evaluate**:
   - **Correct + reasoning** → mark per threshold. Update `teach_list.md`. Increment `correct attempts`.
     - If the concept that was the primary target of question N is now MASTERED (or if all primary concepts are PASSED 1/2 toward MASTERED at threshold = 1-correct), ask the student if they're ready to attempt question N. Footer: `=== CONFIRM TO PROCEED ===` "Ready to take question {N}?" Yes → next turn switches to `=== ACTIVE QUESTION ===` again. No → continue with whatever else they need (return to 2d.1).
   - **Wrong** → do not repeat the explanation. Try a different angle, drill prerequisites if a deeper gap appeared, retry. Watchlist applies (see step 2g).

5. **Updating during teaching**: increment the `taught` counter for the concept each time you do a teaching block. The watchlist will catch repeated failures.

### 2e. Evaluate the active question

When the student submits an answer to question N:
1. **Lift the firewall.** Numbers and entities from question N are now fair game in your debrief.
2. **Score the answer.**
3. **Correct + reasoning** → mark all concepts question N tested per threshold. Update `teach_list.md`. Move to the next question (return to 2a with N+1).
4. **Correct + shallow** → ask for the reasoning before counting it.
5. **Wrong** → run the gap sub-process from `shared/rules.md`. Teach the missing concept (firewall does NOT re-engage now since the question is being debriefed, not attempted — but use original examples anyway since question N's numbers are now revealed). After teaching, re-display question N as `=== ACTIVE QUESTION ===` and let the student attempt again. Cycle 2d → 2e until correct.

### 2f. Watchlist check

After every question is fully resolved (correct + reasoning), scan the Repeated-miss watchlist in `teach_list.md`. For any concept on the watchlist:
- Drill into the suspected prerequisite gap before continuing to the next practice question.
- Teach-count >= 2 with `correct attempts = 0` means you're treating a symptom, not a cause.

### 2g. Move on

Return to 2a with question N+1.

---

## Step 3 — Backfill scenario (mid-session arrival)

If you join the session mid-walkthrough — e.g., this is a fresh context window resuming prior work, or the student has been working through questions in this conversation before `teach_list.md` existed — backfill before continuing:

1. Scroll through the conversation. For each practice question already covered, identify concepts tested.
2. Add those concepts to `teach_list.md` per the format in `shared/teach-list-protocol.md`.
3. For each correct answer, set status per threshold. For each gap that was taught, increment `taught` counters.
4. For the question currently in flight, recreate the IN PROGRESS state (and the active question state if the firewall would be in effect).
5. Note in the file under Configuration: `Backfilled at {timestamp} — historical accuracy approximate.`
6. Resume from where the conversation left off. If the student was just taught a concept and is about to retry the active question, your next response should display the active question footer.

---

## Step 4 — Close

Session is complete when:
- Every practice question targeted has been answered correctly with reasoning explained
- Every concept on the teach list is MASTERED

Close with a bulleted summary in the body:
- Practice questions covered with the student's final answers
- Concepts mastered, grouped by Major Topic
- Watchlist items that required deeper drilling — these are signals for future study sessions

Final response ends with a footer (`=== CONFIRM TO PROCEED ===` "Wrap up here, or continue to question {N+1}?").
