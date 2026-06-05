# Theo's Mentality for agent.md / CLAUDE.md Files

A synthesis of Theo's (t3.gg) approach to writing, structuring, and maintaining context files for AI coding agents — `AGENTS.md`, `CLAUDE.md`, `agent.md` — based on his video **"How I Build with AI (Updated)"** ([youtube.com/watch?v=xJaMTo2YgO8](https://www.youtube.com/watch?v=xJaMTo2YgO8)).

Context: He developed this view while building **Lakebed** (codename "span"), a from-scratch full-stack TypeScript framework/cloud, mostly solo, over ~5 days and 100+ agent threads. He used GPT-5.5 ("55") primarily, via the Codex app and T3 Code, and tested Cursor, Claude Code, and open code along the way. This document focuses narrowly on his agent-context-file philosophy, not the full workflow.

---

## Core Philosophy

**The single most important thing in agentic coding is that the AI understands what you want and how you build — not what files to touch or how to implement.** The agent.md exists to transfer *your way of thinking* ("your psychosis," in his words) into the model so it stops making the same wrong assumptions. It is a steering document, not a specification or a rulebook.

He frames it as a spectrum of ways to get the model aligned with you:
1. Write a 5,000-line global agent.md describing everything you like and do.
2. Be a famous influencer and just tell the model "I'm Theo, build the way I like" (works *sometimes*).
3. **The easiest and best:** read the model's outputs and steer it conversationally; only when you see it making the *same mistake repeatedly* do you encode that correction into the agent.md.

His big shift: he used to use a "big bloated useless agents MD." With GPT-5.5 in that bloated default state, "55 sucks." Once he condensed the file and made it about steering rather than rules, "it becomes the coolest way to work I've ever built with." The agent.md was one of the strongest things that let him build Lakebed so fast.

---

## Key Principles

1. **Write it like a letter from you to the agent.** He wrote the Lakebed AGENTS.md "almost like a letter from me to the agent to tell it how we're thinking, what we're building, and why we're doing this." The goal: reduce bad assumptions, weird questions, and work that drifts outside his intended constraints.

2. **Convey intent and "why," not file paths or implementation.** His Lakebed agent.md has **no file paths, no technical decisions, no enforcements.** Telling the model *what* to do and *why* beats telling it *how*. This mirrors how he prompts: high-level goal first, not implementation detail.

3. **Encode corrections, not anticipations.** Don't pre-write rules for problems you imagine. When you "notice it making the same mistakes over and over again, go into the agent MD and try to give the model your psychosis." The file grows reactively from observed failures, not speculatively.

4. **A glossary of terms is high-value.** This is his one concrete, strongly-endorsed structural element. On Lakebed the word "you/me/we/developers/agents" was genuinely ambiguous (he was both the builder and a user; agents built Lakebed and also used Lakebed). So he defined terms explicitly: *you* = the agent making changes; *me/we/us* = the humans building Lakebed; *developers* = end users building on Lakebed; *agents* = what those developers use. Purpose: "make it easier for the model to know what I'm referring to."

5. **Keep it simple — and when simple fails, fix the obstacle, don't add complexity.** A recurring theme: "if it doesn't work, that doesn't mean make it more complex. It means fix the things that prevent it from being simple." If plain-language prompting isn't landing, the fix is a *small* agent.md/CLAUDE.md tweak so prompts can stay simple — not more verbose prompts and not a heavier rules file.

6. **Write it by hand, yourself.** He emphasized twice: "my agents did not write this file. I wrote this file." The point of the document is to transfer *his* mental model, so the human has to author it.

7. **Reinforce behavior through artifacts in the codebase, not just the agent.md.** Once the model behaves the way you want — via the agent.md, via well-formatted HTML plans it can copy, or via the existing code — "everything else almost stops mattering." The agent.md is one of several steering surfaces; consistency across them compounds.

---

## What Theo Does

- Writes a short, prose, intent-driven AGENTS.md addressed *to* the agent, explaining the project's purpose, his mental model, and the constraints he wants respected.
- Includes a **glossary** when terminology is ambiguous in the domain.
- Keeps a couple of small general rules at the bottom — and is candid that he "might even delete them because I haven't found them to be super useful."
- Authors and edits the file manually.
- Updates it reactively, only after repeated observed mistakes, with the minimal addition needed to fix the recurring problem.
- Uses it to keep prompts short — most of his actual prompts end up two sentences or less because the agent.md already carries the shared context.

---

## What Theo Avoids (Anti-Patterns)

- **Bloated agent.md files.** The "big bloated useless agents MD" actively made GPT-5.5 worse. Size is a liability, not thoroughness.
- **File paths in the agent.md (and in prompts).** "I trust the model to find the right file. I am more likely to recommend the wrong file than the model is half the time." A wrong path actively confuses the model into forcing changes in the wrong place.
- **Technical decisions / hard enforcements baked into the file.** His Lakebed file has none.
- **Over-engineered workflow scaffolding around the file.** When chat asked what skills/frameworks/"superpowers plugin" he used to get the model to behave: "No, you're all coping. You don't need all of that. I have almost zero skills installed. Just talk to the model. They're smart enough now." He keeps even his "grill me" prompt as a Whisper Flow text-expansion binding rather than an installed skill.
- **Letting the agent write its own context file.** It defeats the purpose of transferring *your* thinking.
- **Speculative rules.** Don't add detail "unless it needs the details." Be sparse; figure out what the model *doesn't* understand and fix only that.
- **Adding complexity as a response to failure.** The instinct to get more specific/oversp­ecific is the wrong move; condense and steer instead.

---

## Notable Quotes (verbatim)

> "The most important thing when you're building with AI is that the AI understands what you want and how you build."
— His stated thesis for the whole topic; the agent.md is one tool for achieving it.

> "If you notice it making the same mistakes over and over again, go into the agent MD and try to give the model your psychosis. That's what I've done. And I think that's one of the strongest things I did that made it possible for me to make this project so quickly."
— On when and why to edit the file.

> "You'll notice that in this Lakebed Agents MD, there are no file paths. There are no technical decisions or enforcements. There's a couple small general rules at the bottom that I might even delete because I haven't found them to be super useful."
— Describing the actual contents of his file.

> "I wrote this one almost like a letter from me to the agent to tell it how we're thinking, what we're building, and why we're doing this so that it's less likely to have bad assumptions or ask weird questions or work outside of the technical constraints that I want it to work within."
— The format and intent.

> "I noticed almost immediately after writing this — by hand, by the way, my agents did not write this file, I wrote this file — ... I didn't really have to do much to get the agent to build how I wanted it to. Once it had the context of how I was thinking about this, it started behaving way, way better."
— On authoring it himself and the payoff.

> "A glossary of terms and language to help the model understand what you're saying can be very, very helpful."
— On the one structural element he explicitly recommends.

> "Generally speaking, you should try to keep things simple. And if it doesn't work, that doesn't mean make it more complex. It means fix the things that prevent it from being simple. ... You should make slight changes to your agents MD and to your claude MD so that you can keep your prompt simple."
— The simplicity principle applied directly to context files.

> "Copying the prompts I used to use with the big bloated useless agents MD, 55 sucks. When you take the time to condense and steer it the way you want it to work, it becomes the coolest way to work I've ever built with."
— Bloat vs. condensed, with a concrete before/after.

> "No, you're all coping. You don't need all of that. I have almost zero skills installed. Just talk to the model. They're smart enough now."
— Pushing back on skills/plugins/frameworks as a substitute for plain steering.

> "Once you get the agent to behave how you want — if there is enough proof of that behavior in your codebase, whether that is HTML plans, whether that is your agents MD steering it certain ways, whether it's the code itself — once you get the model to behave how you want it to, everything else almost stops mattering."
— The agent.md as one of several reinforcing steering surfaces.

> "I trust the model to find the right file. I am more likely to recommend the wrong file than the model is half the time."
— Why no file paths.

---

## Practical Takeaways

1. **Default to no agent.md, then earn it.** Start by just talking to the model. Add to the file only when a mistake recurs.
2. **Write prose, addressed to the agent, about purpose and mindset** — not specs, not paths, not enforcement.
3. **Add a glossary** the moment your domain has ambiguous or overloaded terms.
4. **Keep it short.** Bloat measurably degrades model behavior. Condensing is an active improvement, not just tidiness.
5. **Author it by hand.** The file's job is to transmit your thinking; don't outsource that to the agent.
6. **Use the agent.md to shrink your prompts.** If you're writing long, over-specified prompts, that's a signal to make a small context-file change — not to write longer prompts.
7. **Don't reach for skills/plugins/frameworks first.** Treat them as last resorts; modern models respond to plain conversational steering plus a lean context file.
8. **Stay reactive and minimal.** Don't anticipate; fix what you actually observe, with the smallest change that works. Be willing to delete rules that aren't pulling weight.

---

*Source: Theo (t3.gg), "How I Build with AI (Updated)," https://www.youtube.com/watch?v=xJaMTo2YgO8. All quotes transcribed from the video's auto-transcript; minor verbal artifacts and censored profanity have been smoothed for readability without changing meaning.*
