# Teach List Protocol — Format and Update Rules

`teach_list.md` is the persistent state of the session. It must be updated every turn. Without it, you lose track of what the student has and hasn't mastered, and how many times you've taught each concept.

## File location

Create `teach_list.md` in the working directory at session start. Update it in place throughout the session.

## Required structure

Use exactly this structure. Variation makes mid-session updates fragile.

```markdown
# Teach List — {Scope}

## Configuration
- Scope: {Chapter / Topic / Practice test name}
- Path: {A | B | C | D} — {short label}
- Session started: {YYYY-MM-DD HH:MM}

## Progress Summary
{X} / {Y} concepts mastered

## Concept Map

### {Major Topic 1} — {x}/{y} mastered
- [x] MASTERED — {Concept name} | taught: {n} | correct attempts: {n}
- [ ] IN PROGRESS — {Concept name} | taught: {n} | correct attempts: {n} ← current
- [ ] NOT STARTED — {Concept name} | taught: 0 | correct attempts: 0

### {Major Topic 2} — {x}/{y} mastered
...
```

## Status values

- **NOT STARTED** — concept identified but not yet tested with the student.
- **IN PROGRESS** — currently being taught, or just answered incorrectly and waiting on retest.
- **MASTERED** — answered correctly with reasoning explained at least once. Stop testing.

## Update protocol — every turn

### Before asking a question

1. Identify every concept the question tests. List them explicitly to yourself.
2. For each concept, check `teach_list.md`. If absent, add as NOT STARTED under the appropriate Major Topic heading. Create the heading if it doesn't exist yet.
3. Mark the primary concept being tested as IN PROGRESS.

### After teaching a concept

- Increment the `taught` counter by 1 for that concept.

### After the student answers

- **Correct + reasoning explained** → increment `correct attempts` by 1, status → MASTERED.
- **Wrong** → leave `correct attempts` unchanged, status stays IN PROGRESS, run the gap sub-process from `SKILL.md`.

### After every concept resolution

1. Recompute the Progress Summary line.
2. Recompute the per-topic mastered counts in the Major Topic headings.
3. Scan for repeated misses: any concept with `taught >= 2 AND correct attempts = 0` is your signal to drill into a likely prerequisite gap on the next teach attempt — see the gap sub-process step 6 in `SKILL.md`.

---

## Backfill (canonical)

If you arrive into a session that's already underway and `teach_list.md` doesn't exist (or is incomplete), backfill before continuing:

1. Scroll through the conversation. For each question already asked, identify the concepts tested and add them.
2. For each correct answer with reasoning explained, set status to MASTERED.
3. For each gap that was taught, increment the `taught` counter for that concept.
4. For the question currently in flight, recreate the IN PROGRESS state.
5. If this is Path D and an active question is unanswered, recreate the ACTIVE QUESTION state and re-engage the firewall.
6. Note in the Configuration block: `Backfilled at {timestamp} — historical accuracy approximate.`
7. Resume from where the conversation left off.
