# Active Learning Skill — Exam 3 Walkthrough Session Review

Archive of source materials and analysis used to upgrade the `active-learning-tutor` skill from V2 to V3.

**Date:** 2026-05-06
**Trigger:** A practice exam walkthrough (MGMT 254, Exam 3, 15 questions, Path D) where the skill misfired in several ways. Findings were folded into a V3 rewrite of the skill.

---

## What's in this folder

### Source transcripts (the session being reviewed)
- `Practice Exam Walkthrough - Exam 3 (Final) - cleaned.json` — conversation messages
- `Practice Exam Walkthrough - Exam 3 (Final) - tool-calls.json` — tool calls Claude made
- `claude-conversation-Practice Exam Walkthrough - Exam 3 (Final).json` — full conversation export

### Analysis (generated from the transcripts)
- `active-learning-skill-review-insights.md` — Opus subagent's structured review: challenge points, pain points, skill failures, what worked, things to fix.
- `active-learning-skill-user-corrections.md` — Sonnet subagent's verbatim extraction of every mid-session correction the user issued (with implied rules).
- `active-learning-skill-user-comments-in-notepad-during-use.md` — User's own contemporaneous notes from a specific Q5 incident.

---

## What we did with these

1. Spawned two parallel subagents on the transcript: one for failure analysis (Opus), one for verbatim user-correction extraction (Sonnet).
2. Consolidated their outputs into a strict, deduplicated change list, reframed in positive/goal-driven language per user direction.
3. Rewrote `SKILL.md`, `paths/practice-walkthrough.md`, and the three other path files. Inlined `shared/teach-list-protocol.md` into `SKILL.md` and deleted the `shared/` directory.
4. Snapshotted V1 (pre-this-session), V2 (pre-V3-changes), and V3 (current) as zips in `C:\Users\2supe\All Coding\E-Stack\e-stack\`.
5. Created `active-learning-skill-watch-list.md` (also in the E-Stack folder) for live use during the next study session — verifies fixes work and surfaces regressions.

---

## Key changes V2 → V3 (high level)

- **Reframed in goals + success criteria** instead of prohibitions, so the AI has the *why* not just the *don't*.
- **Concept-first teaching**: no worked examples by default; escalate only after two failed teaching attempts.
- **Confirmation skip condition**: if the student spontaneously answers the active question correctly with reasoning, the clarification checkpoint is skipped.
- **One footer in flight, footer self-contained**: question content goes below the flag; body and footer are independent.
- **Teach queue (new)**: required prerequisites pause current teaching; adjacent gaps queue for after current concept masters; active question doesn't return until queue is empty.
- **Per-stage gap sub-process actions**: every stage has an explicit teach-list update tied to it.
- **Real-time + close-time teach list validation**: counters, queue state, and progress summary always accurate.
- **Source material discipline tightened**: no outside analogies (hospital/sports/retail).
- **Visuals via `visualize:show_widget`** only — no ASCII art.

---

## Where to look next

- Live skill: `C:\Users\2supe\.claude\skills\active-learning-tutor\`
- Snapshots: `C:\Users\2supe\All Coding\E-Stack\e-stack\V{1,2,3}-active-learning-tutor.zip`
- Watch list (use during next session): `C:\Users\2supe\All Coding\E-Stack\e-stack\active-learning-skill-watch-list.md`
