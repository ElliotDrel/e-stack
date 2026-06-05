# Route: Create — bootstrap the initial letter

You are here because no CLAUDE.md or AGENTS.md exists in the target project.
Verify that first (project root and obvious parents). If one exists, switch to
`refine.md` instead — unless refine sent you here because the existing file has
no letter spine; in that case run the interview below and hand the drafted
letter back to refine's flow.

The goal is a short letter from the user to the agent. They author it through an
interview; you transcribe and shape, in their phrasing. You never substitute
codebase analysis for their answers.

## Step 1 — Investigate quietly, then interview freehand-first

Before asking anything, investigate the repo yourself: README, docs, notes,
recent git history, the existing CLAUDE.md if refine sent you here. Form your
own candidate answers for each interview area — intent, constraints, ambiguous
terms, boundaries. **Do not show these yet.**

Open the interview by telling the user the plan, so they answer freely instead
of dictating what's already written down: *"Answer freehand — don't worry about
repeating things that are already in the repo or the old file; I've scanned
those and will show you what I found after your answers, to build on or
correct."*

Ask at most a handful of questions, batched 2–3 at a time, covering four areas:

1. **Intent** — What is this project, and why does it exist? What does done or
   good look like to you?
2. **Mental model** — How do you think about building it? What do you care about
   most, and what constraints matter (taste, priorities, trade-offs you've
   already decided)?
3. **Glossary candidates** — Are any words in this domain ambiguous or overloaded?
   (Terms that mean something specific here, names that collide, "you/we/users"
   confusion.)
4. **Hard boundaries** — What is off-limits without your explicit permission?

This is not project discovery. Do not ask about stack, file structure, build
commands, or architecture — the agent can find those itself, and wrong paths
mislead more than they help. Only include such details if the user raises them
unprompted.

If an answer is thin, ask one focused follow-up, then move on. Total questions
should stay in single digits.

## Step 1.5 — Surface what you found

After the freehand answers, show your investigation candidates, grouped by the
same four areas — only the ones they *didn't* already cover: "Here's what I found
in the repo that you didn't mention — build on it, correct it, or cut it." If
refine sent you here, this is also where the valuable lines from the old file
resurface as candidates (real intent buried in rules, gotchas earned by past
pain) so the user never has to re-dictate what was already written. Each candidate
they confirm becomes draftable; its trace is their confirmation. Anything they
don't confirm stays out.

## Step 2 — Draft

Synthesize their answers into a draft letter:

- Prose, addressed to the agent ("This project is… What I care about is… Don't…").
- Their phrasing — lift their actual words and rhythms from the interview. If you
  smooth something, keep their vocabulary.
- A glossary section only if step 1 surfaced genuinely ambiguous terms.
- No file paths, no enforcement language, no rules for problems they haven't hit.
- Short. A new letter has earned almost nothing yet — most letters start well
  under 40 lines and grow reactively from observed mistakes. Never pad toward
  the 150 cap.

Every line must trace to something the user said. If you find yourself writing a
line they didn't give you, cut it or ask.

## Step 3 — Line-by-line approval

Present the full draft first so the user sees the shape. Then walk it line by line
(or paragraph by paragraph for flowing prose): for each, they approve, reword,
or cut. Apply their rewording verbatim — do not "improve" it back.

## Step 4 — Write

Only after every line is approved, write the file to the project root as
`CLAUDE.md` (or `AGENTS.md` if the user prefers — ask once). Confirm the final line
count. Remind them, once, that the letter grows reactively: when the agent makes
the same mistake twice, that's when the next line gets earned.
