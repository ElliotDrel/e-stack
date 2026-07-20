---
name: estack-pr-description
version: 1.0.0
description: >-
  (pr-description) Rewrites a pull request description for a maintainer who
  reviews product logic, risk, and alignment, not implementation detail. Use
  when the user asks to "write a PR description," "rewrite this PR
  description," "clean up my PR description," "draft the PR body," or
  otherwise wants a PR's description authored or rewritten from its actual
  diff, commits, tests, and state — not from the old description or commit
  titles.
---

# PR description writer

Rewrite the current PR's description for a maintainer who reviews product logic, risk, and alignment, not implementation detail. Inspect the actual diff, commits, tests, and PR state first. Do not trust the old description or commit titles as proof of behavior — they describe intent, not what the code does.

## Before writing

Gather ground truth yourself:

1. **Read the diff.** `git diff <base>...<head>` (or the PR's diff via `gh pr diff`) is the primary source. Every claim in the description must trace back to something you actually saw in the diff, commits, or a command you ran — not to the old description or commit messages.
2. **Read the commits.** Commit history shows the shape of the work and sometimes the reasoning, but a commit title claiming "fix race condition" is not proof the race condition is fixed. Verify against the actual code change.
3. **Check the PR state.** CI status, existing review comments, linked issues. Passing CI proves tests ran and passed, not that a deployed workflow executed correctly in production.
4. **Check tests.** Read what the tests actually assert, not just that they exist.

## Writing the description

Keep it short. A reviewer should read it in under a minute. Lead with decisions. Never repeat the same content across sections — if a fact is already stated in one section, don't restate it in another. Scale down for small changes: a pure fix is just Root cause / Fix / Verification, not the full six-section structure below.

### 1. Key decisions (with the why)

Only real choices where an alternative existed. For each: what you decided, the alternative, why, the tradeoff. Include decisions the AI made on its own, if this PR was AI-assisted. This is not a change list; if it reads like one reworded, it is wrong. Be precise about risk — "data deleted" and "data temporarily missing from a view" are different claims, as are "reproduced failure" and "theoretical failure." Say which one it is. If no real decisions were made, say exactly that. That is a fine answer — don't manufacture decisions to fill the section.

### 2. Verification

For each check, say what failure it rules out. "Added regression tests" alone is useless; explain each test's purpose or drop it. Passing CI does not prove a deployed workflow ran. If the PR touches an edge function or writes to the database, run it once for real and report what it did, or state plainly that you did not and why.

### 3. What changed (high level)

A short skim of top-level changes. No file-by-file list. Must not restate the decisions from section 1.

### 4. Database / Supabase / edge functions / migrations

List every change to the database, Supabase, edge functions, or migrations. For each, give its status: already run, or still needs to be run (say by whom and with what command). State whether existing data stays compatible, whether a backfill is needed and whether it was actually run, and whether all valuable fields are extracted and validated before any raw payload is dropped. If none apply, write "None."

### 5. Operational behavior

Include if the PR changes a scheduled job, integration, or failure handling. Say what runs and when, what still runs outside any narrowed window, and where an operator sees partial or failed runs. Default to visible errors over silent ones.

### 6. Open calls for the reviewer

Only unresolved product or risk decisions. State it, recommend one, note the consequence of the alternatives. If none: "None."

## Writing style

Everything in this skill — every section above — gets written under these rules. They also live in the user's global `CLAUDE.md`; they're restated here so this skill enforces them on its own, even if invoked somewhere that global file doesn't reach.

- **No canned openers.** Never open with "Great question," "I'd be happy to help," "Absolutely," "Certainly," or any warm-up acknowledgment. Just answer.
- **Speak directly and plainly.** No metaphors or analogies.
- **State what things are.** Avoid contrastive framing such as "not just X, but Y", "it's not X, it's Y", or "not X, not Y, just Z" — including the version stretched across several sentences for effect.
- **Describe things at their real size.** No hyperbole, no drama, no selling.
- **Write like a person texting a peer.** Keep it casual and direct, not pitchy.
- **Let the rhythm be uneven.** Mix a short sentence with a longer one. Avoid tidy parallelism, balanced triplets, wordplay, and neat summary lines that tie a bow around the point.
- **Use specifics.** A real detail beats a polished abstraction. A small aside or hedge is fine when it is true — "bit of a long shot," "promise i'm not here to pitch."
- **No filler or performance.** Cut generic enthusiasm, intensifiers, stacked adjectives, corporate throat-clearing, and templated parenthetical sign-offs. Do not restate one idea in new words.
- **Avoid AI punctuation habits.** No em dashes. Use commas, periods, parentheses, or other relevant punctuation.

A PR description that violates these reads like it was generated, which undercuts the whole point of this skill: giving a maintainer something they can actually trust and read fast.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-pr-description: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-pr-description: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
