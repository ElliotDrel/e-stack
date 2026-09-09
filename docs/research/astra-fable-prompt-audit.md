# Astra and Fable prompting audit

Instruction audit dated 2026-09-07. Delivery is a repository change; live installation and npm publication are separate operations.

## Basis

Reviewed on 2026-09-07 against [GPT-6 Astra model guidance](https://developers.openai.com/api/docs/guides/latest-model) and [Claude Fable 5.1 prompting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1).

Astra's guidance highlights skill instructions that override intent or block authorized work, along with explicit communication, delegation, and proportionate verification. Fable's guidance supports completing the requested scope, targeted edits, useful progress updates, contextual formatting, selective retrieval, and careful source attribution. Both support removing unnecessary process while retaining the constraints needed for a correct result.

This audit applies that guidance to the pack's instruction surfaces. API-specific conversation history, display, async-tool, and effort settings belong to an application harness; they are not configuration changes in this pack. This is an instruction review with static scenario checks, not a measured comparison of model performance.

## Retention decisions

Retain all 24 skills. Each supplies domain knowledge, a concrete tool workflow, or a distinct deliverable beyond generic advice. The redundant material is primarily within their instructions and between adjacent routing rules. No skill needs deletion merely because the newer models can perform its general subject matter.

| Skill | Value retained |
|---|---|
| Active Learning Tutor | Course-grounded teaching, attempts before scoring, mastery journal and practice-test paths |
| Better Title | Session naming convention and concrete rename integration |
| Book Extractor | Deterministic extraction and an indexed chapter reference library |
| Chris Voss | Negotiation-specific reference knowledge and counterpart strategy |
| CLAUDE.md Optimizer | Maintenance of project intent and instruction routing with provenance |
| Cold Message Writer | First-touch outreach strategy, separate from established relationships |
| Customer Discovery | Assumption testing, interview preparation and evidence analysis |
| Doc Review Viewer | Local document review UI and threaded feedback workflow |
| Drive CLI Agent | CLI invocation, output interpretation, authentication and verification contracts |
| Email Writer | Drafting for existing relationships, concrete asks and sender voice |
| Flight Planner | Fare data parsing, saved trip constraints and timezone-aware ground transfers |
| GitHub Issue Tracker | Current issue evidence, persistent analysis, action queue and incremental history |
| Leadership Coach | Team responsibility frameworks and practical leadership artifacts |
| Migrate Claude Session History | Transcript and sidecar migration with backup and validation |
| Notify | Session-scoped notification controls and status integration |
| PDF to Markdown | OCR/extraction options, batching, page selection and credential setup |
| PR Description Writer | Descriptions grounded in actual changes, verification and reviewer concerns |
| Productivity Prioritization Coach | Outcome selection, RPM and execution frameworks |
| Prompt Builder Coach | Task scoping and usable work briefs when the request needs clarification |
| Purdue Knowledge Lab Stickers | Lab-specific print and submission requirements and supplied design assets |
| Read Agent Session History | Cross-agent transcript lookup, recovery and analysis tooling |
| Repo Search | Reusable external repository research with source inspection |
| Sponsorship Offer Builder | Sponsor offer design and packet, outreach and meeting deliverables |
| VS Code File Recovery | Editor-history and transcript recovery with exact file restoration |

## Changes and coverage

The review covers every packaged `SKILL.md`, its live routes and supporting
instruction files, the project-local `manage-e-stack` skill, authoring and release
guidance, and reusable coaching templates. Reference knowledge is retained when
it supplies domain evidence; instructions embedded in references are reviewed as
active behavior rather than exempted because of their folder name.

- Remove repeated intake and confirmation when supplied context already supports
  the requested draft, critique, search, conversion, or repository edit.
- Simplify the project-instruction optimizer and prompt builder around the
  requested artifact. Preserve canonical files, verified commands, and project
  constraints instead of imposing a universal document shape.
- Keep coaching questions that teach or resolve consequential ambiguity. Align
  nested teaching, delegation, discovery, and sponsorship paths with their main
  routers so an old step file cannot silently restore removed gates.
- Preserve exact recovery and migration evidence, cached working files, and
  private credential setup. Update executable examples and distinguish dated CLI
  observations from installed interfaces.
- Draft feedback from details already supplied and post only when authorized.
  Separate repository edits and PR delivery from live installation and release.
- Keep historical evaluations, transcripts, source captures, and planning records
  intact. They are evidence of past behavior, not instructions for a new run.

The two substantially rewritten meta skills use major version bumps; other
changed skills use patch bumps. Package versioning and npm publication remain
part of the separate release workflow.

## Scenario review

The static review follows the main instructions into their supporting files. It
checks whether the written flow supports these outcomes; it does not claim that
Astra or Fable was empirically evaluated on the scenarios.

| Request | Expected instruction behavior |
|---|---|
| Rewrite an email with a complete thread | Produce the draft from supplied context; sending or calendar actions require their own authorization |
| Build a prompt with sufficient scope | Return a usable prompt without forcing every optional aid |
| Improve AGENTS.md | Preserve the canonical file/import arrangement and useful verified project details |
| Walk through a named practice exam | Ground in course sources, present the question, preserve attempts, scoring, and mastery records |
| Draft a fully specified delegation brief | Produce the artifact without six discovery exchanges |
| Draft sponsor outreach with incomplete facts | Mark factual gaps and produce a draft; do not invent evidence or send it |
| Search an external repository | Preserve cached files and identify the revision inspected |
| Convert a PDF with supplied paths | Resolve credentials privately and execute with appropriate OCR/page handling |
| Check GitHub issues | Research current facts, preserve human context, and queue external actions for authorized execution |
| Migrate a session | Verify source and target, preserve backups, detect collisions, and validate the copy |
| Run a CLI review | Use supported flags, explicit boundaries, and output/effect evidence |
| Edit skills and open a PR | Finish the repository delivery without requiring live installation or an npm release |

## Verification record

- Existing Python suite: 195 passed, 1 skipped. Used a fresh temporary pytest base directory because the machine's existing default directory was inaccessible.
- Migration validator smoke test: 27/27 cases passed.
- Migration-note Node smoke test: passed, including repeat-call idempotency.
- Local CLI help checked for current Codex exec and Claude Code flag support.
- All 24 changed skills have valid version increases from `c8fcd7f` (`v1.0.77`).
- Pack checks passed: versioning, skill names, state/credential paths, README/AGENTS inventories, and generated feedback consistency. Diff whitespace checks passed.
- Relative Markdown file links across active skills, templates, and repo docs resolve.
- PDF credential-check Bash syntax and isolated temporary-home cases passed: missing key, shared-file key, legacy-file key, and process-environment precedence, including paths with spaces. No real credentials or API calls were used.
- Independent static review findings were corrected in nested coaching paths, executable host paths, tracker analysis/action boundaries, flight presets/history, and migration recovery instructions. The primary reviewer inspected the resulting source and diffs.
- Runtime scripts, hooks, installer, package version, and release workflow are unchanged; the existing runtime regression results above remain applicable. No live skill installation or package release was performed.

Historical plans, benchmark outputs, transcripts and captured source documents remain historical evidence. The audit does not rewrite the record of earlier behavior or claim their dated facts were re-verified.