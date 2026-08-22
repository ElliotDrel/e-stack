---
name: estack-doc-review-viewer
version: 1.0.0
description: (doc-review-viewer) Open a local live-reloading viewer for a markdown document so Elliot can read it, highlight passages, leave threaded comments, and push them back to the agent with one button. Use whenever you have written or rewritten a document he needs to review, whenever he asks to "see the diff", "show me the changes", "let me comment on this", "open the viewer", "review this doc", or wants to mark up a draft instead of describing edits in chat. Also use before pushing a rewritten Google Doc or any document back to its source, so he can approve the change visually first.
---

# doc-review-viewer

A dependency-free local web app for reviewing a markdown document with a human in
the loop. It versions the document automatically, shows a diff between any two
versions, lets Elliot highlight any passage and hold a threaded conversation on
it, and gives him a **Send to Claude** button that wakes you without switching
back to the terminal.

Node standard library only on the server. The page carries one vendored file,
google/diff-match-patch (Apache-2.0), checked in rather than installed. No
`npm install`, no network, nothing to build.

## Your entire job

Two commands, then edit files. Everything else is the code's problem.

```bash
R="node $HOME/.claude/skills/estack-doc-review-viewer/review.mjs"

$R open path/to/doc.md      # 1. before you edit anything
$R claim                    # 2. when woken, this hands you the feedback
#    ... edit the file ...
$R reply <threadId> what you changed and why
$R publish                  # 3. hand it back
```

You never choose a port, a version number, a state directory, or a slug. You
never track what you have already read. Run `open` **before** your first edit so
v1 captures the original text.

## Getting woken

`open` prints the slug, the URL, and the exact watcher command. Run that watcher
through the **Monitor** tool with `persistent: true`:

```bash
node ~/.claude/skills/estack-doc-review-viewer/review.mjs watch --slug plan
```

Each line it prints becomes a notification that wakes you. Waking is per session
per slug: the daemon is shared, the watcher is yours, and Monitor only sees a
process your own session launched.

## The hand-off

One field says whose turn it is, and everything follows from it.

| Phase | Meaning | Who moves it |
|---|---|---|
| `reviewing` | Elliot's turn. He reads and comments. | you, via `publish` |
| `submitted` | He clicked Send. You have not picked the round up. | him, via the button |
| `editing` | You claimed the round and are working. The button locks. | you, via `claim` |

The loop:

1. `open` the document. v1 is snapshotted before you touch it.
2. You edit. `publish`. That mints v2 and returns the document to Elliot.
3. He comments and clicks **Send to Claude**. The phase becomes `submitted`.
4. Your watcher prints one line. You wake.
5. `claim` prints the unread messages and flips to `editing`.
6. You edit and reply in-thread. `publish` mints v3. Back to step 3.

While you hold the round the page is curtained and the server serves the last
snapshot instead of the working file, so Elliot can never catch a half-written
document mid-`Write`.

This state is **level-triggered**. If your session dies, the daemon is killed, or
the machine reboots, `review.json` still says `submitted` and the next process to
look knows exactly what is owed. Nothing has to be consumed exactly once.

New to you is every Elliot message the marker has not passed. `claim` returns
those and advances the marker in one atomic write, so a crash cannot half-claim
a round. `pending` shows the same thing without claiming, and is safe any time.

## Comment anchoring, and what it means for your edits

Comments anchor to the **quoted text**, not the line number, and re-resolve on
every render. Insert twenty lines above a commented bullet and the comment
follows it. That is deliberate: you will be editing the document while his
comments sit on it.

If you **rewrite the exact text he quoted**, the comment orphans. It is not lost
and never silently reattached to text it was not written about. It moves to an
**Anchor lost** group above the resolved fold, drawn in yellow, still showing the
quote it was written against. It is flagged, not faded: it still counts and still
sends.

You are told when this happens. `claim`, `pending`, and `publish` all report
orphaned threads by id and quote, so you do not have to remember to check:

```
!! 1 comment(s) lost their anchor because of the edits you just published:
   c4f2...  quoted: "Ship the redesign in Q3."
```

When you see that, **reply in the thread saying what you changed, then resolve
it**. Otherwise Elliot is left with a flagged card and no answer.

## Versioning

Snapshots are minted by code on `publish`, never by you. A pass that leaves the
document byte-identical does not earn a version number, and `publish` says so.

In the page, the **Compare** selectors choose any two versions. The default is
the previous snapshot against the working file, which is exactly "what changed in
the pass you just did." Viewing anything other than the working file on the right
puts the page in read-only history mode, so a comment can never be written
against text the working document no longer has.

## The CLI

```bash
$R open <file.md> [--slug s] [--no-browser]   host it, snapshot v1, print the watch command
$R watch --slug <slug>                        the Monitor stream
$R status | pending | claim | publish | threads | versions   [--slug s] [--json]
$R reply <threadId> your text here
$R resolve <threadId> | reopen <threadId>
$R comment --body "..."                       a general note on the document
$R ps | stop | close --slug <slug>
```

With one document open, `--slug` is optional. With several, the CLI refuses to
guess and names the choices. `--doc <file>` works instead of `--slug`.

Two sessions can review two documents at once. Each runs its own `open` and its
own `watch`; the second `open` finds the daemon already running and registers
with it. Slugs come from the filename and are stable across restarts.

## Where state lives

Nothing this skill creates is written next to the document. Elliot's working
directory keeps his files and only his files.

```
~/.claude/doc-review/registry.json    slug -> {document, stateDir}
~/.claude/doc-review/daemon.json      the daemon's url and pid
~/.claude/doc-review/docs/<slug>/
  review.json     phase, round, seq, version manifest, every thread
  versions/       v0001.md, v0002.md, ...
```

Never hand-edit `review.json` while the daemon is running. Every write goes
through one serialized queue inside it, and an outside write can be silently
overwritten by the next mutation.

## Traps

- **Run `open` before your first edit.** It snapshots v1 from the file as it
  stands. Edit first and v1 is your rewrite, with the original gone.
- **Do not reply to a thread while he is testing the Send button.** Replying
  flips it out of the awaiting set, the button greys out to "nothing to send",
  and it looks broken.
- **If `review.json` stops parsing, the daemon refuses to overwrite it** and
  returns the error instead of resetting. That is what keeps his comments
  recoverable. Fix it by hand and restart.

## Editing this skill's own code

Read `INTERNALS.md` in this directory first. It carries the architecture, the
diff algorithm, the HTTP routes, and the failure modes that bite when you change
any of them. Run `node selftest.mjs` and `node e2etest.mjs` after any edit.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-doc-review-viewer: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-doc-review-viewer: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
