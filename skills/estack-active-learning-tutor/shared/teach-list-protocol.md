# Teach List Protocol — Format and Update Rules

`teach_list.md` is the persistent state of the session. It must be updated every turn. Without it, you will lose track of what the student has and hasn't mastered, how many times you've taught each concept, and which gaps signal a deeper prerequisite issue.

---

## File location

Create `teach_list.md` in the working directory at session start. Update it in place throughout the session.

---

## Required structure

Use exactly this structure. The format is deterministic on purpose — variation makes mid-session updates fragile and lossy.

```markdown
# Teach List — {Scope}

## Configuration
- Scope: {Chapter / Topic / Practice test name}
- Path: {A | B | C | D} — {short label}
- Mastery threshold: {1-correct | 2/2-separate-questions}
- Session started: {YYYY-MM-DD HH:MM}

## Progress Summary
{X} / {Y} concepts mastered

## Concept Map

### {Major Topic 1} — {x}/{y} mastered
- [x] MASTERED — {Concept name} | taught: {n} | correct attempts: {n} | first seen: {Q-id}
- [ ] PASSED (1/2) — {Concept name} | taught: {n} | correct attempts: {n} | first seen: {Q-id}
- [ ] IN PROGRESS — {Concept name} | taught: {n} | correct attempts: {n} | first seen: {Q-id} ← current
- [ ] NOT STARTED — {Concept name} | taught: 0 | correct attempts: 0

### {Major Topic 2} — {x}/{y} mastered
...

## Repeated-miss watchlist
Concepts where `taught >= 2 AND correct attempts = 0`. These signal a likely missing prerequisite.
- {Concept name} — taught: {n} | last error: {brief description} | suspected prereq gap: {prereq name}
```

---

## Status values

- **NOT STARTED** — concept identified (from source materials, a question, or a gap during teaching) but not yet tested with the student.
- **IN PROGRESS** — currently being taught, or just answered incorrectly and waiting on retest.
- **PASSED (1/2)** — answered correctly once. Threshold is 2/2, so the concept needs one more correct attempt on a separate question. (This state is skipped entirely when the threshold is `1-correct`.)
- **MASTERED** — meets the configured threshold. Stop testing this concept.

---

## Update protocol — every turn

### Before asking a question

1. Identify every concept the question tests. List them explicitly to yourself.
2. For each concept, check `teach_list.md`. If absent, add as NOT STARTED under the appropriate Major Topic heading. If the major topic doesn't exist yet, add the heading too.
3. Mark the primary concept being tested in this question as IN PROGRESS.

### After teaching a concept

- Increment the `taught` counter by 1 for that concept.

### After the student answers

- **Correct + reasoning explained** → increment `correct attempts` by 1. Update status per threshold:
  - Threshold = 1-correct → MASTERED
  - Threshold = 2/2 → PASSED (1/2) on first correct, MASTERED on second correct
- **Wrong** → leave `correct attempts` unchanged, status stays IN PROGRESS, run the gap sub-process from `shared/rules.md`.

### After every concept resolution

1. Recompute the Progress Summary line.
2. Recompute the per-topic mastered counts in the Major Topic headings.
3. Check the watchlist: any concept with `taught >= 2 AND correct attempts = 0` is added to the Repeated-miss watchlist with a one-line note about the suspected prerequisite gap. The watchlist is your signal that the next teach attempt should drill deeper, not retry the same level.

---

## Path-specific initialization

### Paths A and B — diagnostic quiz

Preload the teach list with all concepts in the quiz scope as NOT STARTED **before** the quiz begins. Organize by Major Topic, foundational → capstone within each topic. After scoring the quiz:

- Quiz-correct concepts → status per threshold:
  - Threshold = 1-correct → MASTERED
  - Threshold = 2/2 → PASSED (1/2). Concept will need one more correct during active learning.
- Quiz-incorrect concepts → IN PROGRESS (these are the gap list).

### Paths C and D — JIT (just-in-time)

Do NOT preload concepts from source materials. Build the teach list incrementally as concepts surface through questions or gaps. Add a Major Topic heading the first time a concept under it appears.

---

## Backfill scenario

If you arrive into a session that's already underway and `teach_list.md` doesn't exist (or is incomplete), backfill before continuing:

1. Scroll through the conversation. For each question already asked, identify the concepts tested and add them.
2. For each correct answer, increment `correct attempts` and set status per threshold.
3. For each gap that was taught, increment the `taught` counter for that concept.
4. For the question currently in flight, recreate the IN PROGRESS state.
5. Note in the file under Configuration: `Backfilled at {timestamp} — historical accuracy approximate.`
6. Resume from where the conversation left off.

---

## Q-id convention

Use a consistent identifier for "first seen" so you can trace the question that introduced each concept:

- Path A diagnostic quiz: `DQ1`, `DQ2`, ...
- Path B imported quiz: `IQ1`, `IQ2`, ... (matches the question number on the student's quiz)
- Path C active learning: `Q1`, `Q2`, ... (incremental from session start)
- Path D practice walkthrough: `PT5`, `PT6`, ... (matches the practice test question number)
- Active learning gap-test (any path): suffix the originating Q-id with `-G1`, `-G2`, e.g. `PT5-G1` for the first gap-test question raised while working through PT5

---

## Worked example (mid-session, path D, threshold = 1-correct)

```markdown
# Teach List — Chapter 5: Inventory Costing

## Configuration
- Scope: Chapter 5: Inventory Costing — Practice Test 2
- Path: D — Practice test walkthrough
- Mastery threshold: 1-correct
- Session started: 2026-05-01 14:30

## Progress Summary
3 / 7 concepts mastered

## Concept Map

### FIFO vs LIFO — 2/3 mastered
- [x] MASTERED — Definition of FIFO | taught: 0 | correct attempts: 1 | first seen: PT1
- [x] MASTERED — Definition of LIFO | taught: 1 | correct attempts: 1 | first seen: PT1
- [ ] IN PROGRESS — Effect of LIFO on COGS during inflation | taught: 2 | correct attempts: 0 | first seen: PT1 ← current

### Lower of Cost or Market — 1/2 mastered
- [x] MASTERED — Definition of "market" in LCM | taught: 1 | correct attempts: 1 | first seen: PT2
- [ ] NOT STARTED — Recording an LCM write-down | taught: 0 | correct attempts: 0

### Inventory Errors — 0/2 mastered
- [ ] NOT STARTED — Effect of overstating ending inventory | taught: 0 | correct attempts: 0
- [ ] NOT STARTED — Effect on next period's income | taught: 0 | correct attempts: 0

## Repeated-miss watchlist
- Effect of LIFO on COGS during inflation — taught: 2 | last error: confused direction of effect | suspected prereq gap: relationship between COGS and ending inventory under inflation
```
