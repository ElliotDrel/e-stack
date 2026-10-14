---
name: estack-pr-description
version: 2.0.2
description: >-
  (pr-description) Rewrite a pull request description from its actual diff,
  commits, and tests for a maintainer who reviews product logic and risk. Use
  when asked to write, rewrite, or clean up a PR description.
---

# PR description writer

Rewrite the current PR's description for a maintainer who reviews product logic, risk, and alignment, not implementation detail. Inspect the actual diff, commits, tests, and PR state first. Do not trust the old description or commit titles as proof of behavior; they describe intent, not what the code does.

Before writing, inspect `reference/example-pr.md` as a historical worked example. It illustrates one maintainer's preferred detailed format; it is not a universal template or evidence for the current PR. The user's instructions and any repository PR template control the structure.

## Before writing

Gather ground truth yourself:

1. **Read the diff.** `git diff <base>...<head>` (or `gh pr diff`) is the primary source. Every claim must trace back to something you actually saw in the diff, commits, or a command you ran, never to the old description or commit messages.
2. **Read the commits.** History shows the shape of the work, but a commit title claiming "fix race condition" is not proof the race is fixed. Verify against the code.
3. **Check the PR state.** CI status, existing review comments, linked issues. Passing CI proves tests ran, not that a deployed workflow executed correctly.
4. **Check tests.** Read what the tests actually assert, not just that they exist.
5. **Use author-supplied manual-test evidence.** The PR author is the only source of truth for manual testing. Never infer it from the diff or CI, and never widen what they say. If no evidence is available, draft the Verification section as `Manual testing: not reported.` and put relevant manual checks in post-merge follow-up; ask only when the task is to solicit that evidence.

## Body structure

Keep it short enough for the actual PR. Honor an explicit repository template or maintainer request first. For a product or multi-part change, use the sections below when they add review value; for a focused fix, use `Root cause`, `Fix`, and `Verification`. Use numbered lists only when the items need a stable reference in review conversation.

### 1. What changed and why

One merged section. Do not write separate "Key decisions" and "What changed" sections; splitting them forces the headline facts into both. Each topic appears exactly once as a numbered item:

- A **bolded one-line end-state overview.** Scanning only the bold lines should summarize the PR.
- A sub-bullet labeled **Key decision:** naming the rejected alternative, why it lost, and the accepted cost ("X instead of Y because Z, accepted cost W"). One or two sentences, never more; the bold line already carries the what. Include this sub-bullet only when a real alternative existed. Two decisions may share it only when they are inseparable. Never manufacture a decision. Scanning the Key decision lines should give the judgment-call list and nothing else.
- A sub-bullet labeled **What changed:** with the mechanics in plain behavior terms: who sees what, edge behavior, what got deleted. If only one sentence of a mechanism paragraph is the true user-visible fact, keep that sentence and cut the mechanism.

A no-choice topic (tests, renames) is just the bold line plus a sentence; add "no decision here" when useful.

Two named rules govern this section and the rest of the body:

- **Alternative test.** A Key decision line must contain a credible "instead of." If you cannot name what was rejected, it is change detail, not a decision; move it into What changed.
- **Deletion test.** Every fact appears exactly once in the whole body. If deleting a sentence loses no information, delete it. If a dedicated section exists for a fact (migrations, verification), it lives only there, never also as a decision or a change line.

If a maintainer explicitly wants the older two-section layout, use it, but the alternative test and deletion test apply identically there.

### 2. Verification

Report only evidence actually available. State manual testing with its exact author-supplied scope, or `Manual testing: not reported.` Report automated evidence separately with the actual command or CI check and result, including a failed, skipped, or unavailable result when relevant. Do not claim production behavior from CI or local tests. Put material untested workflows in a concise post-merge checklist.

### 3. Database / Supabase / edge functions / migrations

List every change to the database, Supabase, edge functions, or migrations. For each, give its status: already run, or still needs to be run (say by whom and with what command). State whether existing data stays compatible, whether a backfill is needed and whether it was actually run, and whether all valuable fields are extracted and validated before any raw payload is dropped. If none apply, write "None," and say why merge order cannot break anything if that is true.

### 4. Operational behavior

Include only if the PR changes a scheduled job, integration, or failure handling. Say what runs and when, what still runs outside any narrowed window, and where an operator sees partial or failed runs. Default to visible errors over silent ones.

### 5. Open calls for the reviewer

Numbered. Only unresolved product or risk decisions. For each: state it, recommend one option, note the consequence of the alternatives. If none: "None."

### Footer

Reference issues and PRs when they help a reviewer trace context. Verify their current state this session, and label a historical closed reference or successor accurately rather than dropping useful provenance. Include an attribution footer only when the user, repository, or host requires it, and name the actual tool that produced the draft.

## Scaling down

A pure fix does not get the full structure. Use Root cause / Fix / Verification, keeping only the decision or follow-up context that affects review.

## Writing style

Every section above gets written under these rules. 

- **Say-it-aloud test.** Every sentence must be something you could say out loud to the maintainer across a desk. This bans raw code, query objects, or config fragments quoted in prose (describe the behavior: "a save won't take a row owned by another account"), HTTP or error status codes used as nouns, arrow notation, parenthetical infra jargon asides, and invented jargon. Nominalized phrasing ("adoption is ownership-guarded") reads generated; say who does what.
- **No canned openers.** Never open with "Great question," "Absolutely," or any warm-up. Just answer.
- **Speak directly and plainly.** No metaphors or analogies.
- **State what things are.** Avoid contrastive framing such as "not just X, but Y" or "it's not X, it's Y," including the version stretched across several sentences.
- **Describe things at their real size.** No hyperbole, no drama, no selling. "Data deleted" and "data temporarily missing from a view" are different claims; "reproduced failure" and "theoretical failure" are different claims. Say which one it is.
- **Write like a person texting a peer.** Casual and direct, not pitchy.
- **Let the rhythm be uneven.** Mix short and long sentences. Avoid tidy parallelism, balanced triplets, and neat summary lines that tie a bow around the point.
- **Use specifics.** A real detail beats a polished abstraction. A true hedge is fine.
- **No filler or performance.** Cut generic enthusiasm, intensifiers, stacked adjectives, and corporate throat-clearing. Do not restate one idea in new words.
- **No em dashes.** Use commas, periods, or parentheses.

A description that violates these reads generated, which undercuts the whole point: giving a maintainer something they can trust and read fast.

## Final self-check (mandatory)

Before delivering the draft, check it against the selected structure and the user's or repository's stated requirements.

1. Every sentence passes the say-it-aloud test.
2. No raw code, queries, or config fragments in prose.
3. No HTTP or error codes used as nouns.
4. No arrow notation anywhere.
5. No parenthetical infra jargon asides.
6. No fact stated twice anywhere in the body (deletion test).
7. Every Key decision line names a credible rejected alternative (alternative test), and each decision sub-bullet is at most two sentences.
8. The Key decision lines, read alone, are judgment calls, not a reworded change list.
9. Manual verification matches author-supplied evidence or says it was not reported; automated evidence reports the actual command or check and outcome. Untested material workflows have a proportionate follow-up.
10. Every referenced issue or PR has a state verified this session and any historical reference is labeled accurately.
11. The structure follows an explicit user/repository template when one exists; otherwise it is proportionate to the diff.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-pr-description:` and a body. File an
issue only when the user explicitly asks you to do so. If they have not asked,
offer the draft and issue page for their review; do not post or open anything
automatically.

When the user explicitly authorizes filing and `gh` is installed (`gh --version` succeeds), create the issue with structured arguments. Put the reviewed body in a UTF-8 temporary file and pass its literal path with `--body-file`; do not interpolate feedback into shell code.

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "<reviewed title>" \
  --body-file "<path-to-reviewed-UTF-8-body-file>"
```

If `gh` is unavailable, give the user the reviewed title and body to paste into a
new issue at `https://github.com/ElliotDrel/e-stack/issues/new`.
