# Route: Refine — audit an existing file letter-style

You are here because a CLAUDE.md/AGENTS.md exists and the user wants it audited or
improved. The audit is letter-style: does each line transfer intent they actually
hold, or is it noise? No rubrics, no grades, no template sections.

## Step 0 — Is this even a letter?

Read the whole file first and judge its shape. If it has no prose-intent spine —
it's a command list, template sections, a routing table, or rule soup — line
edits can't fix it, because there is no letter to refine. Say so, then:

1. Run the interview from `routes/create.md` to author the missing letter spine
   (the user's answers, their phrasing — the existing file is not a substitute,
   but it IS a hint source: mine it for genuinely valuable content — real intent
   buried in rules, gotchas earned by past pain — and surface those as
   candidates in create's Step 1.5 so the user confirms rather than re-dictates).
2. Return here and classify every existing line against that new spine: most
   become DELETE or RE-VOICE (folded into the letter); KEEP only what traces.
3. Any existing routing section must pass the bar in `routes/scale-check.md`
   or be proposed for deletion with the rest.

The pass is not done until the final file is a letter that passes the hard
rules — that is the finish line for every route, whatever was asked.

## Step 1 — Read and classify every line

Read the whole file. Tag each line (or tight group of lines) with exactly one:

- **KEEP** — traces to intent or a known recurring mistake, current, voiced as
  intent. Leave it alone.
- **DELETE** — propose removal. Triggers: generic advice any model already knows;
  restates what the code shows; speculative rule for a problem never observed;
  stale (references things that no longer exist, commands that no longer work);
  one-off fix that never recurred; duplicate; a rule whose "why" nobody can state.
- **RE-VOICE** — the underlying intent is real but it's written as enforcement
  ("ALWAYS/NEVER do X") or as a bare mechanic. Rewrite as intent with its why
  ("I care about X because Y") — usually shorter, always more transferable.
- **ASK** — you can't tell whether it traces. Don't guess; queue a question.

File paths get special suspicion: the model finds files better than stale paths
do. Propose deleting paths unless the user states a live reason to keep one.

## Step 2 — Ask the queued questions

Batch the ASK items (2–5 at a time): "This line says X — what's the why? Is it
still true? Has the mistake it guards against actually recurred?" A line whose
why the user can't state becomes a DELETE proposal — Theo deletes rules that
aren't pulling weight, and so does this skill.

## Step 3 — Propose the edit set, deletions first

Deletions are mandatory in every refine pass — if you found none, you didn't
audit, you skimmed. Present in this order:

1. **Deletions** — quoted line + one-line reason each.
2. **Re-voicings** — before → after, one-line why.
3. **Additions** — rare, only for a recurring mistake the user names during this
   audit, in their phrasing. Never additions to "round out" the file.

Show the net line count: before → after. It should usually go down. If the file
is over 150 lines, the pass is not done until it's under; if an addition would
cross 150, pair it with a removal or drop it.

## Step 4 — Approve and apply

Walk the edit set change by change. Apply only what the user approves, with their
rewordings verbatim. Edit the file, then report the final shape: line count,
what was cut, what survived.
