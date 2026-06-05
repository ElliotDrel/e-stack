# Gary's Mentality for Approaching CLAUDE.md Files

*A synthesis of Gary's article "Resolvers: The Routing Table for Intelligence" (Resolver), plus the AI guidance layered on top of it. Gary's own positions are prioritized throughout; the AI synthesis layer is flagged where it diverges or extends.*

---

## TL;DR

Gary's central thesis: **a CLAUDE.md is not an encyclopedia, it is a routing table.** Its job is not to teach the model how to do the work — it is to tell the model *where to find the instructions* for the work, and to load that context only at the moment it is needed. He calls this routing table a **resolver**. The mentality is "route, don't explain." A bloated CLAUDE.md doesn't make the model smarter; it drowns it.

---

## Core Philosophy

### The model isn't dumb — it's drowning

The single most important idea. Gary's instinct, like everyone's, was "you want the model to know everything." So he crammed every quirk, pattern, lesson, convention, and edge case into CLAUDE.md until it hit **20,000 lines.** It felt productive. It was the opposite.

> "I wasn't [making the model smarter]. I was drowning it. The model's attention degraded. Responses got slower and less precise. Claude Code literally told me to cut it back. That's when you know you've gone too far — the AI is telling you to stop talking."

He names the failure mode directly: **"omniscience by proximity."** The belief that stuffing everything into the context window makes the model omniscient.

> "You can't make someone smarter by shouting louder. You make them smarter by giving them the right book at the right moment."

And the punchline of the whole article:

> "Almost nobody is building [resolvers] explicitly. Everyone is cramming 20,000 lines into the system prompt and wondering why the model seems dumber than it should be. The model isn't dumb. It's drowning. Give it a routing table and watch what happens."

### Route, don't explain

The fix for the 20,000-line file was **about 200 lines**: a numbered decision tree of pointers to documents. Not the knowledge itself — pointers to where the knowledge lives.

> "That 200-line file is the resolver. It replaced 20,000 lines of instructions. And the system immediately got better — faster responses, more accurate filing, fewer hallucinations. Not because the model got smarter. Because I stopped blinding it with noise."

The definition of a resolver, in his own words:

> "A resolver is a routing table for context. When task type X appears, load document Y first. That's it. One sentence. But that one sentence is the difference between an agent that compounds intelligence and an agent that slowly forgets what it knows."

### CLAUDE.md is a management layer, not a manual

The deepest reframe in the article. Gary argues that once a system has 40+ skills and 25,000 files, "you don't just have code. You have an organization." The resolver is the management layer of that organization:

- **Skills are employees** — each has a capability; some specialists, some generalists, some cron-only, some user-facing.
- **The resolver is the org chart** — who handles what, how tasks route, and the escalation logic when something doesn't match.
- **The filing rules are internal process** — where information lives and how decisions get recorded.
- **check-resolvable is audit & compliance** — can the system actually do what it claims?
- **Trigger evals are performance reviews** — given a real input, does the right part of the org respond?

> "The problem isn't that models aren't smart enough. The problem is that we've been building organizations with no management layer. Just a pile of talented employees and a vague hope they'll coordinate. Resolvers are that missing layer."

---

## Key Principles

Gary's own end-of-article summary of "the pattern":

1. **Load the right context at the right moment. Don't cram.**
2. **Mandate that every skill consults the resolver. Don't trust individual filing logic.**
3. **Test the routing, not just the output.** (Trigger evals.)
4. **Audit reachability.** (check-resolvable, weekly.)
5. **Make the resolver learn from its own traffic.** (The endgame.)

He frames these as a maturity ladder:

> "When it's missing, skills invent their own filing logic and everything slowly degrades. When it's present but untested, capabilities go dark — you have a surgeon the hospital can't find. When it's tested but static, it rots within 90 days. When it's tested and self-healing, the system compounds."

### Resolvers are fractal

The principle "that makes everything click." Resolvers compose — they exist at every layer, not just the top:

- **Skill resolver** (lives in AGENTS.md / the root context file): maps task types to skill files. "Who is this person?" → brain-ops. "Ingest this PDF" → pdf-ingest.
- **Filing resolver** (lives in RESOLVER.md): maps content types to directories. Person → `people/`, Company → `companies/`, Policy analysis → `civic/`.
- **Context resolver** (lives inside each skill): internal sub-routing — email triage one way, scheduling another, signature tracking a third.

> "Claude Code already has this pattern. Every skill has a description field. The model matches user intent to skill descriptions automatically... The description *is* the resolver. It's resolvers all the way down."

This fractal sameness is what lets the architecture scale "from 5 skills to 50, from 1,000 files to 25,000, from a toy demo to a production system that processes 200 inputs a day."

---

## What Gary Does (Recommended Practices)

### Keeps the root file short — pointers, not prose
A numbered decision tree the model walks:
- Is it a person? → `/people/` directory
- A company? → `/companies/` directory
- A policy analysis? → `/civic/` directory

20,000 lines of knowledge remains accessible *on demand* without polluting the context window. ~200 lines at the top; everything else lives in linked documents loaded only when relevant.

### Mandates that every skill consult the resolver
After catching a misfiling (see anti-patterns), he didn't patch skills one by one — he created a shared filing-rules document and a hard mandate. His actual two-line mandate, placed at the top of every brain-writing skill, verbatim:

> *"Before creating any new brain page, read `brain/RESOLVER.md` and `skills/_brain-filing-rules.md`. File by primary subject, not by source format or skill name."*

"One rule. Ten skills fixed." Result: **zero misfilings since.**

### Maintains a disambiguation / filing-rules document
A secondary doc (`_brain-filing-rules.md`) that catalogs edge cases and *past mistakes* so the same error can't recur a different way: Sources vs. originals. People vs. companies (when someone IS a company). Civic vs. sources (the misfiling that started it all).

> "Every mistake, documented, so the same mistake can't happen a different way."

### Tests the routing with trigger evals
A suite of ~50 sample inputs with expected outputs. His actual examples:

```
Input: "check my signatures"      → Expected: executive-assistant (signature section)
Input: "who is Pedro Franceschi"  → Expected: brain-ops → gbrain search
Input: "save this article to brain" → Expected: idea-ingest + RESOLVER.md
```

Two failure modes he names:
- **False negative** — skill should fire but doesn't (trigger description wrong/missing).
- **False positive** — wrong skill fires (two triggers overlap).

Both are fixable by editing markdown, no code changes. "The resolver is a document, and documents are cheap to fix." He is emphatic this is non-negotiable:

> "If you can't prove the right skill fires for the right input, you don't have a system. You have a collection of skills and a prayer."

### Audits reachability with a meta-skill (`check-resolvable`)
A skill that walks the entire chain — AGENTS.md → skill file → code — to find dead links: skills that exist but have *no path* from the resolver at all. First run found **6 unreachable skills out of 40+ — 15% of capabilities were "dark."** Fixed in an hour by adding triggers. Now runs weekly.

> "It's the resolver equivalent of a linter — it tells you what's broken before a user discovers it the hard way."

### Plans for a self-healing resolver (the endgame)
Forward-looking, not fully built. The idea (raised by a YC CTO in office hours): a reinforcement-learning loop that observes every task dispatch — which skill fired, which didn't, which had no match, which matched wrong — and periodically rewrites the resolver from observed evidence. "Not a human maintaining a table. The table maintaining itself." He notes Claude Code's AutoDream memory-consolidation system is a primitive version of this.

> "A resolver that learns from its own traffic. That's the endgame for agent governance."

---

## What Gary Avoids (Anti-Patterns)

### The 20,000-line CLAUDE.md
The originating sin. Cramming every lesson and edge case into one file degrades attention, slows responses, and reduces precision. Signal you've gone too far: **the AI itself tells you to cut it back.**

### Hardcoded filing logic inside skills
The misfiling that revealed everything: he asked his agent to ingest Will Manidis's essay "No New Deal for OpenAI" — a sharp policy analysis. The agent filed it in `sources/` (meant for raw data dumps, CSVs, API exports, scrapes) instead of `civic/` (policy, political actors, institutional dynamics).

Root cause: the idea-ingest skill had `brain/sources/` hardcoded as default. It never consulted the resolver.

> "It had its own half-assed filing logic baked into the skill itself. When no explicit path was given, it fell back to `sources/` the way a lazy intern throws everything in the 'misc' folder."

The audit that followed: **only 3 of 13 brain-writing skills referenced the resolver.** The other 10 had hardcoded paths — each "a potential misfiling waiting to happen." Fixing them individually is "whack-a-mole. You fix one, another drifts."

### The slow, silent drift (not dramatic failure)
The thing that actually kills agent systems:

> "Not a dramatic failure. Not a hallucination that produces nonsense. A slow, silent drift where information goes to the wrong place, connections don't form, and the knowledge base gradually becomes a junk drawer with 14,700 files in it instead of a structured intelligence layer."

### The invisible skill (capability that exists but can't be reached)
His OpenClaw signature-tracking system "worked perfectly... Completely invisible." The resolver had no trigger for signatures, so "check my signatures" got a shrug.

> "It's like having a surgeon on staff but not listing them in the hospital directory."

Why this is *worse* than a missing skill:

> "A missing skill is honest — the system says 'I can't do that' and you know to build it. A skill that exists but isn't reachable creates the illusion of capability. You think the system handles signatures. It doesn't. And you don't find out until the moment it matters."

### Context rot — letting the resolver decay
Resolvers decay even when built correctly. His timeline:
- **Day 1** — perfect. Every skill registered, every trigger accurate.
- **Day 30** — three new skills exist that nobody added (built by sub-agents at 3 AM).
- **Day 60** — trigger descriptions don't match how users actually phrase things. Skill handles "track this flight"; user says "is my flight delayed?" — doesn't fire.
- **Day 90** — the resolver is "a historical document. An artifact of what the system *used to* be able to do."

The tell that you've drifted: invoking skills by direct instruction ("read skills/flight-tracker/SKILL.md") because the resolver lacks the right triggers.

> "The system worked because I knew which skill to call. That's not a system. That's a person with a filing cabinet."

### Filing by source format or skill name instead of by subject
A recurring rule. Route by *primary subject*, never by how the data arrived or which skill produced it. (A policy analysis is `civic/` even though it was "imported," and even though the ingest skill defaults elsewhere.)

---

## Notable Quotes (verbatim, with context)

- On the core failure: *"I wasn't [making it smarter]. I was drowning it."* — the thesis of the whole piece.
- On the cure: *"You make them smarter by giving them the right book at the right moment."*
- On the definition: *"A resolver is a routing table for context. When task type X appears, load document Y first."*
- On the economics: *"The resolver is a document, and documents are cheap to fix."* — why routing problems are markdown edits, not retraining.
- On testing: *"If you can't prove the right skill fires for the right input, you don't have a system. You have a collection of skills and a prayer."*
- On hidden capability: *"It's like having a surgeon on staff but not listing them in the hospital directory."*
- On reachability: *"Six. Out of 40+. Fifteen percent of the system's capabilities were dark."*
- On drift: *"That's not a system. That's a person with a filing cabinet."*
- On the real problem: *"The problem isn't that models aren't smart enough... we've been building organizations with no management layer."*
- The closing call: *"The model isn't dumb. It's drowning. Give it a routing table and watch what happens."*

---

## Practical Takeaways (how to actually structure your CLAUDE.md)

Distilled from Gary's pattern and the AI synthesis at the end of the source. Where these are the AI synthesis layer extending Gary, it's noted.

1. **Aim for ~200 lines, not 20,000.** The root file triages and points; it does not teach. Think triage nurse / org chart.

2. **Open with a hard mandate.** Forbid the model from inventing filing logic or guessing how to execute a complex task. Make it read the routing table and load the required doc *first*. *(AI synthesis example mandate, consistent with Gary's two-line brain mandate):*
   > *"Before executing a task, creating a file, or running a skill, you MUST read this routing table and follow its paths. Do not rely on default behaviors or assumptions. File by primary subject as defined below, not by source format."*

3. **Use a numbered decision tree of conditional pointers**, e.g.:
   - If Task A → read `path/to/specific-skill.md`
   - If Content B → save to `/specific-directory/`
   - If Subject C → consult `_rules/subject-c-guidelines.md`

4. **Separate two kinds of routing** (the fractal idea):
   - **Task routing** (intent → skill file).
   - **Filing routing** (content type → directory, by *subject* not format).

5. **Isolate disambiguation into its own file** (`_filing-rules.md`). Catalog past mistakes and define boundary cases explicitly (Source vs. Original; when a Person is filed under Companies; Civic vs. Sources).

6. **Test the routing.** Maintain a small eval suite of real-phrasing inputs → expected skill. Watch for false negatives (should-fire-but-doesn't) and false positives (wrong skill fires).

7. **Audit reachability on a schedule.** Periodically verify every skill/path is reachable from the resolver and that trigger phrases match how you actually ask ("is my flight delayed?" not just "track this flight"). Treat dead links like a linter would.

8. **Treat the resolver as living infrastructure.** It rots within ~90 days if untouched. Register new skills as they're born; update triggers to match real usage. The endgame is a resolver that rewrites itself from observed traffic.

### A clean target shape (from the AI synthesis at the end of the source)

```markdown
# MASTER SYSTEM RESOLVER
**CRITICAL MANDATE:** Do not invent filing logic. Do not guess how to execute a
complex task. Before taking action, match the user's intent to the routing table
below and read the required context document FIRST.

## 1. Task Routing (Agents & Skills)
* Signatures & Documents   -> Read `skills/executive-assistant/signatures.md`
* Meeting Transcripts      -> Read `skills/ingest/meetings.md`
* General Search / "Who is..." -> Read `skills/brain-ops/search.md`

## 2. Filing Routing (Knowledge Base)  — route by SUBJECT, not file format
* Is it a Person?            -> `/people/`
* Is it a Company/Entity?    -> `/companies/`
* Is it Policy/Political?    -> `/civic/`
* Is it a Raw Data Dump?     -> `/sources/`

## 3. Disambiguation & Rules
If unsure where to route, or if categories overlap, you MUST read
`_brain-filing-rules.md` to resolve the conflict before proceeding.
```

---

## Source Attribution & Provenance Notes

- **Primary source:** Gary's article *"Resolvers: The Routing Table for Intelligence"* (Resolver), a follow-up to his earlier *"Thin Harness, Fat Skills."* All quotes above are verbatim from that article unless flagged.
- **Gary's own positions** (prioritized here): the 20,000-line confession, the resolver definition, the Manidis/`civic` misfiling, the 3-of-13 audit, the invisible signature skill, trigger evals, `check-resolvable` (6/40 dark), the 90-day context-rot timeline, the self-healing/RLM endgame, the "resolvers are fractal" and "management layer" reframes, and the open-source tools he ships these patterns in (GBrain — `gbrain init` scaffolds RESOLVER.md + decision tree + disambiguation rules + check-resolvable; GStack — the markdown coding-skill layer; OpenClaw/Hermes — the thin harness).
- **AI synthesis layer** (the `assistant:` section at the end of the source): restates Gary's philosophy as a "route, don't explain" guideline and supplies the example mandate text and the "MASTER SYSTEM RESOLVER" template above. These are faithful extensions of Gary's points, not new claims — used here only as practical scaffolding.
