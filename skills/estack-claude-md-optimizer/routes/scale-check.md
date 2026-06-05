# Route: Scale check — has this project outgrown a pure letter?

You are here to judge whether a project has genuinely outgrown a plain letter
and earned a routing section — Gary's resolver idea, applied only when scale
demands it. The default verdict is **not yet**. A short letter plus model
intelligence covers most projects; routing structure added early is bloat
wearing a uniform.

## Step 1 — Gather the scale signals

Look at the project (this part IS codebase analysis — allowed here because you
are assessing structure, not authoring letter content):

- Project-level skills: count entries in `.claude/skills/`.
- Subagents: count entries in `.claude/agents/`.
- Domain subdirectories with their own conventions or their own CLAUDE.md files.
- Standing docs the agent repeatedly needs (filing rules, domain references).
- **Observed misrouting** — the strongest signal, and it comes from the user, not
  the file tree: the agent repeatedly picking the wrong skill, wrong directory,
  or wrong doc; or the user invoking things by explicit path because intent alone
  doesn't land. Ask them directly whether they've seen this.

## Step 2 — Verdict

**Not yet** (the common case): a handful of skills, no repeated misrouting, the
letter is doing its job. Say so, name the signals you'd want to see before
revisiting (e.g. "if you catch the agent filing X into Y twice, come back"),
and stop. Do not propose routing "to be safe."

**Earned**: multiple independent signals — meaningful skill/subagent count AND
repeated misrouting the user has actually observed, or several domains with
conventions the agent keeps missing. Be explicit about which signals tipped it.

## Step 3 — If earned, propose a lean routing section

The letter stays the spine; routing is a section appended to it, never a
replacement and never a rewrite of the prose.

- A short numbered list of conditional pointers: "task/content type → read/file
  here." Route, don't explain — pointers carry no instruction content themselves.
- Route by primary subject, not by source format or which tool produced the thing.
- Only include routes for *observed* traffic: tasks and content types that have
  actually occurred. No speculative rows.
- It counts against the 150-line cap like everything else. A routing section is
  typically 10–20 lines; if it wants to be more, the project needs its own
  routing doc the section points to, not a longer section.

Present the draft section with the trace for each row (which observed signal
earned it). Line-by-line approval, then apply.

## Step 4 — Note the decay

Routing rots as skills change (~90 days untouched and it's a historical
document). When a routing section ships, tell the user once: re-run this scale
check when skills are added or when they catch themselves invoking things by
explicit path again.
