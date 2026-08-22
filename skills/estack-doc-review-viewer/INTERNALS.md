# estack-doc-review-viewer internals

For editing this skill's own code. An agent that is only using the skill to run a
review needs `SKILL.md` and nothing here.

## Files

```
review.mjs        the CLI. The only thing an agent invokes directly.
daemon.mjs        multi-document host, routes, lease-based lifetime
store.mjs         review.json: schema, atomic writes, phases, seq, v1 migration
versions.mjs      snapshots, hashing, version selectors
registry.mjs      global slug registry, daemon discovery, slug allocation, atomic JSON write
public/index.html page shell
public/dmp.js     google/diff-match-patch, Apache-2.0, vendored verbatim. Do not edit.
public/diff.js    the prose diff: blocks, similarity pairing, inline markdown ranges
public/app.js     rendering, anchoring, comments UI, version picker, send button
public/styles.css light and dark, driven by tokens on :root
selftest.mjs      headless render + phase + store + versions test. Run after any edit.
e2etest.mjs       real daemon, real file, real CLI. Run after touching daemon.mjs.
```

## Architecture

**One detached daemon hosts every open document** on `http://127.0.0.1:4173`.
Its stdout goes nowhere on purpose.

**Waking is per session, per slug.** `review.mjs watch --slug <slug>` is the
Monitor stream, and it prints only for its own document. That split exists
because Monitor watches a process's stdout **in the session that launched it**.
If the shared host printed the wake lines they would all land in whichever
session happened to start it, and every other session would be deaf. Hosting is
shared; waking is not.

**The daemon dies when nothing is watching it.** Every watcher heartbeats on each
poll, registering a lease. Two minutes with no live lease and the daemon exits
and removes its `daemon.json`. Browser tabs deliberately do not count as leases,
because a forgotten tab would keep it alive forever. `e2etest.mjs` section 6
proves this by starting a daemon with `DOC_REVIEW_LEASE_TTL_MS`,
`DOC_REVIEW_GRACE_MS`, and `DOC_REVIEW_REAP_MS` set to a few hundred ms; those
three env knobs exist for exactly that test.

**The page polls, once every two seconds, one request.** An earlier build pushed
over an EventSource with an `fs.watch` on the document feeding it and a slow poll
behind both. Three mechanisms answered one question and each had its own way of
going quiet: `fs.watch` goes deaf when an editor saves by renaming over the file,
an EventSource can be cut by a sleeping laptop without firing `onerror`, and
neither survives a proxy without a heartbeat. The backstop poll had to exist
regardless, so it is now the whole mechanism. `GET /api/<slug>/diff` carries the
document pair *and* the review state, so a tick can never produce two responses
describing two different moments.

## The store

`review.json` holds everything: phase, round, `nextSeq`, `lastSeenByClaude`, the
version manifest, and every thread with every message. One atomic write per
mutation (temp file plus rename, in `registry.mjs`'s `writeJsonAtomic`), so phase
and threads can never disagree.

Every mutation runs through one serialized promise chain. Node is single-threaded
but the handlers await, so two concurrent POSTs would otherwise interleave
read-modify-write and one would silently lose.

**If `review.json` does not parse, the store refuses to overwrite it** and
returns the error rather than resetting. That is what keeps comments
recoverable.

A `comments.json` from the v1 single-server layout is migrated into `review.json`
on first run, root comments folding into `messages[0]`. The old file is left on
disk untouched. It still lives beside the document even though current state does
not, so `createStore` takes the legacy directory separately.

## The diff

A prose diff, not a code diff. The engine is `dmp.js`, google/diff-match-patch,
Apache-2.0, vendored as one 78 KB dependency-free file. It is checked in, so
`npm install` is still false and the page still works offline.

**The library is here for `diff_cleanupSemantic`, not for the diff.** Myers
returns the shortest edit script, which is not the most readable one: on prose it
salvages coincidental fragments, a shared `" the "`, a stray vowel, and scatters
them through a rewritten sentence. Neil Fraser calls that chaff
(<https://neil.fraser.name/writing/diff/>). Cleaning it up correctly is harder
than writing the diff, and the hand-rolled Myers this replaced did not try.

`dvTokenDiff` is the bridge: diff-match-patch diffs characters, so each distinct
token gets mapped to one character, the characters are diffed, and the result is
mapped back. That is the library's own Line-or-Word-Diffs recipe, generalised
over the tokenizer, and it drives both the block pass and the word pass.

**Blocks, not lines, are the unit.** A run of plain prose lines is one block, so
reflowing a paragraph reads as the few words that changed rather than as every
line being replaced. Anything structural stays one block per line: bullets,
numbered items, headings, quotes, table rows, rules, and everything inside a
fence. Each block records the source lines it came from and the offset each one
starts at inside the block text, because a comment anchor is a source line plus
a character offset and has to survive the regrouping. `blockMarks` shifts a mark
onto the block; `data-lines` on the element maps a selection back to its line.

**Blocks pair by similarity.** Within a changed run, each old block is matched to
the new block it most resembles via an order-preserving DP over Dice
coefficients on character bigrams. Below `DV_PAIR_MIN_SIMILARITY` (0.35) a block
stays unpaired rather than being compared against a stranger.

**Words carry the change, characters refine it.** A changed run gets a tint. Only
when the two sides are recognisably the same text (similarity at or above
`DV_REFINE_MIN_SIMILARITY`, 0.5) do the characters that moved get underlined
inside it, so fixing `recieve` reads as one letter. Below that floor there is no
underline at all: `hot` means "these exact characters moved", and claiming it
about a whole rewritten sentence stacks a second emphasis on the tint for no
information.

**Markup-only changes are labelled.** A block differing only in bullet style,
emphasis, heading level, or link syntax is marked `~` instead of `-`/`+`, drawn
muted, and counted separately.

**Markdown is styled in place, never rendered away.** `dvMarkdownRanges` returns
character ranges over the same source string the diff parts and the comment
anchors use, and the renderer wraps them: syntax and link targets recede, bold
is bold, code is monospace. Rendering both sides to HTML instead would make
"this became bold" an invisible change and would break every anchor, because an
offset into rendered text is not an offset into the file.

`recieve` -> `receive` has two equally minimal edit scripts. The self-test
asserts that exactly one character is hot on each side, not which one.

## The client

`paintRows` reuses diff rows keyed on row identity, and `state.locked` preserves
a card being typed into. A naive `innerHTML = everything` is forty lines shorter
and destroys an in-progress text selection and any half-typed reply on every
poll. Selecting text to comment on is the entire product, so this is
load-bearing, not polish.

`diff.js` and `app.js` share one scope. They load as two classic scripts in that
order, and `selftest.mjs` concatenates them the same way. A name defined in one
is visible in the other, and a duplicate `const` in both is a hard error on load.

## The HTTP API

`review.mjs` covers every normal case. This is here for when you are changing it.

```
GET    /                                    index of every open document
GET    /s/<slug>/                           the viewer
GET    /api/index                           daemon url, pid, watcher count, open slugs
POST   /api/open                            {document, slug?}
POST   /api/close                           {slug}
POST   /api/shutdown

GET    /api/<slug>/diff?left=&right=        the whole client tick: document pair,
                                            phase, round, threads, summary.
                                            selectors: current | latest | previous | first | <n>
                                            `current` resolves to the last snapshot while phase is editing
GET    /api/<slug>/state                    phase, round, threads, derived summary (CLI only)
GET    /api/<slug>/pending                  unread messages plus orphaned threads, without claiming
GET    /api/<slug>/versions
POST   /api/<slug>/watch                    {watcherId} lease plus the current signature
GET    /api/<slug>/threads
POST   /api/<slug>/threads                  {side,line,quote,prefix,body,author} or {general:true,body,author}
PATCH  /api/<slug>/threads/:id              {resolved} or {line}
DELETE /api/<slug>/threads/:id
POST   /api/<slug>/threads/:id/messages     {body,author}
PATCH  /api/<slug>/threads/:id/messages/:messageId    {body}
DELETE /api/<slug>/threads/:id/messages/:messageId
POST   /api/<slug>/submit                             reviewing -> submitted
POST   /api/<slug>/claim                              submitted -> editing, returns unread + orphaned
POST   /api/<slug>/publish                            editing -> reviewing, mints a version, returns orphaned
```

Authors are `elliot` (the stored value for the human reviewer, and the default
when omitted) and `claude`.

There is no escape hatch for a wedged phase and none is needed: `claim` and
`publish` have no phase guards, so `publish` unsticks a stranded `editing` and
`claim` unsticks anything else.

## Known limits

**Pairing only looks inside one contiguous changed run.** If a deleted block and
the block that replaced it are separated by even one unchanged block, they never
reach `dvAlign` together, so both render flat instead of word-diffed against each
other. Measured on `ping-list-REVIEW.md`, v1 against v3: 121 changed rows, 51
paired and readable, 70 flat. Some of those 70 genuinely have no counterpart,
some are victims of this.

The fix, if it is wanted: let a replace group span a short equal gap. Gate it
hard, one block of gap and only when the two sides clear
`DV_PAIR_MIN_SIMILARITY` anyway, because it dissolves equal rows into replace
groups and a loose gate would start pairing unrelated text across the document.

**Moves are not detected**, and on this document that was measured and found not
to matter: of 84 removed lines in the v1-to-v3 diff, exactly one still existed
verbatim elsewhere. Do not build move detection on a hunch; measure first.

## Traps

Real failures from building this, not hypotheticals.

- **The client's poll loop swallows every exception.** A bug in the render path
  produces a blank page with no console error, identical to a page still loading.
  After touching anything, run `node selftest.mjs`. It renders against a stub DOM
  with open, resolved, threaded, orphaned, and general threads present, drives the
  button through all three phases, exercises version compare and history mode, and
  tests the store and version store directly for migration, seq monotonicity,
  concurrent writes, and restart recovery.
- **`selftest.mjs` cannot see the daemon.** It runs the client against a stub, so
  the frozen-document rule, orphan reporting, state placement, and the daemon's
  own exit path are covered by `node e2etest.mjs` instead. Run that after touching
  `daemon.mjs`. It opens and closes its own slug on port 4173, so do not run it
  while a review you care about is open.
- **Editing `daemon.mjs`, `store.mjs`, `versions.mjs`, or `registry.mjs` requires
  a daemon restart** (`review.mjs stop`, then `open` again). Static files are read
  per request, so client edits go live immediately, but the daemon keeps its old
  code and new endpoints will 404 while the page looks updated.
- **A class that sets `display` beats the `hidden` attribute.** The UA rule
  `[hidden]{display:none}` loses to any author rule of equal specificity, so
  `.editing-curtain{display:grid}` pinned the curtain open in every phase: an
  88%-opaque empty overlay that swallowed every click. `styles.css` now carries
  `[hidden]{display:none !important}` at the top, and `selftest.mjs` asserts it
  is still there. The stub DOM has no CSS, so nothing else can catch this.
- **`public/dmp.js` is vendored, not written here.** Upstream is
  <https://github.com/google/diff-match-patch>, file
  `javascript/diff_match_patch_uncompressed.js`. Re-download it to update;
  never hand-edit it. Its `diff_main` returns `Diff` objects that index like
  `[op, text]` but are **not iterable**, so destructuring one throws.
- **The browser does not reload its own JavaScript.** After editing
  `public/app.js` or `public/diff.js`, hard-refresh (Ctrl+Shift+R).

## Button behavior

One click sends, no confirm step. The button then reflects the daemon's phase,
not a browser timer, so a refresh, a restart, or a second window all agree:
`Sent, waiting on Claude` while the phase is `submitted`, and `Claude is editing`
while it is `editing`. A failed send names the failure next to the button and
leaves the button usable. The awaiting count comes from the server's
`summary.awaitingClaude`; the client does not recompute it.

Keyboard: `c` toggles the comments panel, `Ctrl+Enter` sends.
