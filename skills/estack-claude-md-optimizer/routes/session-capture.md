# Route: Session capture — earn a line from a real session

## Quick capture — mid-task, triggered by the maintenance footer

If you are here because a working agent (you, mid-task) noticed something the
letter should learn — new or ambiguous vocab, a repeated correction, drifted
intent or routing — do NOT run the full flow below. The capture must not derail
the task at hand, and must not be lost either:

1. One line to the user: what you noticed + the proposed minimal change, in
   their words. No opening message, no progress headers.
2. Approved? Apply immediately — cap check, footer intact. If it takes less
   than 5 minutes, do it now; deferring is how improvements get forgotten.
3. Declined, or the user is heads-down? Note it (a TODO, a scratch line —
   anywhere durable) and re-raise it at session end through the full flow.
4. Return to the interrupted task immediately. The capture is a pit stop,
   not a detour.

Everything below is the full end-of-session flow.

---

You are here at the end of a working session, asked to capture learnings into
the CLAUDE.md. The letter grows reactively: only a *recurring* mistake earns a
line. One-off mistakes earn nothing — and "nothing to add" is the most common
correct outcome of this route. Say it plainly when it's true.

## Step 1 — Mine the session for corrections

Scan this session for moments where the user corrected the agent: redirected an
assumption, rejected an approach, repeated an instruction, expressed frustration,
or re-explained intent the agent should have had. Each correction is a candidate.
Discoveries that aren't corrections (a command that worked, a quirk found) are
NOT candidates — that's the official plugin's instinct, not this skill's. The
letter carries intent, not session notes.

## Step 2 — Filter: recurring or one-off?

A candidate is **recurring** only if at least one holds:

- The user corrected the same thing more than once *this* session.
- The existing CLAUDE.md already gestures at it and the agent still got it wrong
  (the line isn't landing — a rewording problem, not an addition problem).
- The user confirms it's a repeat from earlier sessions. When unsure, ask exactly
  that: "Has the agent gotten this wrong before, or was today the first time?"

Everything else is one-off. List one-offs in a sentence ("watching, not writing:
X, Y") so the user knows they were seen, and propose nothing for them.

## Step 3 — Propose the minimal fix

For each recurring mistake (usually zero or one per session):

- First check whether a **deletion or rewording** of an existing line fixes it
  better than an addition — a line that misled the agent should be cut, not
  counter-weighted with a second line.
- If an addition is right, it is the *smallest* line that transfers the intent:
  usually one sentence, voiced as why, built from the user's own correction words
  in the session. Not a rule, not an enforcement, no file paths.
- Check the cap: if the file is at 150 lines, pair the addition with a proposed
  removal or don't propose it.

Present as: the mistake (with where it happened), why it qualifies as recurring,
the proposed change as a diff, and the trace ("your words: '…'").

## Step 4 — Approve and apply

The user approves, rewords, or rejects each proposal; apply only approved changes,
their rewording verbatim. If nothing qualified, end with: "No recurring mistake
this session — the letter stands."
