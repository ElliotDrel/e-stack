// doc-review-viewer self-test.
//
//   node selftest.mjs
//
// Runs public/app.js against a stub DOM and asserts that rendering survives
// comments and that the Send button behaves. Run this after editing app.js.
//
// Why this exists: the client's poll loop swallows exceptions, so a crash in the
// render path shows up as a blank page with no console error. Without this test
// you find out by opening the browser and seeing nothing.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// diff.js and app.js are two classic scripts sharing one top-level scope in the
// browser. Concatenating them here reproduces that, in the order the page loads
// them.
const src = ['public/dmp.js', 'public/diff.js', 'public/app.js']
  .map((file) => readFileSync(resolve(here, file), 'utf8')).join('\n');

const LEFT = `# Quarterly plan

## Hiring
- Open two roles in Q3.
- Interview loop stays at four rounds.

## Budget
- Hold spend flat.
`;
const RIGHT = `# Quarterly plan

## Hiring
- Open three roles in Q3, not two.
- Interview loop drops to three rounds.
- Add a take-home for senior candidates.

## Budget
- Hold spend flat.

## Marketing
- New section entirely.
`;

// --- stub DOM -------------------------------------------------------------
function makeElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    id: '', dataset: {}, className: '', children: [], style: {},
    disabled: false, hidden: false, title: '', value: '', tabIndex: -1, open: false, scrollTop: 0,
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); }, remove(c) { this._set.delete(c); },
      toggle(c, f) { if (f) this._set.add(c); else this._set.delete(c); return !!f; },
      contains(c) { return this._set.has(c); },
    },
    appendChild(c) { if (c && c.__fragment) { this.children.push(...c.children); c.children.length = 0; } else this.children.push(c); return c; },
    setAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, scrollIntoView() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, contains: () => false,
  };
  Object.defineProperty(el, 'innerHTML', { get() { return this._innerHTML || ''; }, set(v) { this._innerHTML = v; this.children = []; }, configurable: true });
  Object.defineProperty(el, 'textContent', { get() { return this._text || ''; }, set(v) { this._text = v; this.children = []; }, configurable: true });
  return el;
}
const els = {};
const mkEl = (id) => (els[id] ??= Object.assign(makeElement('div'), { id }));
const h1 = makeElement('h1');
globalThis.document = {
  getElementById: mkEl, createElement: makeElement,
  createDocumentFragment: () => ({ __fragment: true, children: [], appendChild(c) { this.children.push(c); return c; } }),
  querySelectorAll: () => [], querySelector: (sel) => (sel === 'h1' ? h1 : null),
  documentElement: { dataset: {} }, body: makeElement('body'), addEventListener() {},
  get title() { return this._t || ''; }, set title(v) { this._t = v; },
};
globalThis.window = { scrollY: 0, scrollX: 0, scrollTo() {}, getSelection: () => null };
// The page reads its slug out of the path, so the stub has to look like a real
// viewer URL or every API call lands on /api//...
globalThis.location = { pathname: '/s/selftest/', href: 'http://127.0.0.1:4173/s/selftest/' };
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.setInterval = () => 0;
globalThis.setTimeout = (fn) => { void fn; return 0; };


const iso = (offset = 0) => new Date(Date.now() + offset).toISOString();
const msg = (id, seq, author, body, at) => ({ id, seq, author, body, createdAt: iso(at), updatedAt: iso(at) });
// Monotonic and always distinct, so the client's change stamp cannot collide
// when two updates land inside the same millisecond.
let stampN = 0;
const stamp = () => iso(1000 * ++stampN);
let threads = [
  // anchored, open, awaiting the agent
  { id: 'c1', side: 'right', line: 4, quote: 'three roles', prefix: 'Open ', resolved: false, createdAt: iso(-5000), updatedAt: iso(-5000), messages: [msg('m1', 1, 'elliot', 'Why three?', -5000)] },
  // threaded, agent replied last
  { id: 'c2', side: 'right', line: 6, quote: 'take-home', prefix: 'Add a ', resolved: false, createdAt: iso(-4000), updatedAt: iso(-3000), messages: [msg('m2', 2, 'elliot', 'Is this new?', -4000), msg('m3', 3, 'claude', 'Yes, new in this draft.', -3000)] },
  // resolved
  { id: 'c3', side: 'left', line: 4, quote: 'two roles', prefix: 'Open ', resolved: true, createdAt: iso(-2000), updatedAt: iso(-2000), messages: [msg('m4', 4, 'elliot', 'Old number.', -2000)] },
  // orphaned: this text exists in neither file
  { id: 'c4', side: 'right', line: 99, quote: 'a passage that no longer exists anywhere', prefix: '', resolved: false, createdAt: iso(-1000), updatedAt: iso(-1000), messages: [msg('m5', 5, 'elliot', 'Stale anchor.', -1000)] },
  // general, unanchored
  { id: 'c5', side: 'general', line: null, quote: '', prefix: '', resolved: false, createdAt: iso(-500), updatedAt: iso(-500), messages: [msg('m6', 6, 'elliot', 'Overall: tighten it.', -500)] },
];
let submits = [];
let submitBehavior = 'ok';
let readOnly = false;
const VERSIONS = [
  { n: 1, round: 1, label: 'initial', file: 'v0001.md', createdAt: iso(-90000), bytes: LEFT.length, sha256: 'a' },
  { n: 2, round: 2, label: 'round 2', file: 'v0002.md', createdAt: iso(-60000), bytes: RIGHT.length, sha256: 'b' },
];
// The server owns the phase, so the stub does too: /api/submit flips it and the
// next /api/state read is what the button reacts to.
let review = { phase: 'reviewing', round: 2, lastSeenByClaude: 3, updatedAt: iso(-400) };
const open = () => threads.filter((t) => !t.resolved);
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('/submit')) {
    if (submitBehavior === 'network') throw new Error('Failed to fetch');
    if (submitBehavior === 'http500') return { ok: false, status: 500, json: async () => ({ error: 'review.json is corrupt' }) };
    submits.push(opts && opts.body ? JSON.parse(opts.body) : {});
    review = { ...review, phase: 'submitted', updatedAt: stamp() };
    return { ok: true, status: 201, json: async () => ({ phase: 'submitted', round: review.round }) };
  }
  // /api/<slug>/diff
  const params = new URL(String(url), 'http://x').searchParams;
  const leftSel = params.get('left') || 'previous';
  const rightSel = params.get('right') || 'current';
  const asVersion = (sel) => VERSIONS.find((v) => String(v.n) === String(sel));
  const side = (sel, text) => (sel === 'current'
    ? { kind: 'current', n: null, label: 'working file', text, mtimeMs: 2, exists: true }
    : { kind: 'version', n: asVersion(sel)?.n ?? 1, label: `v${asVersion(sel)?.n ?? 1} (${asVersion(sel)?.label ?? 'initial'})`, text, mtimeMs: 1, exists: true });
  const leftText = leftSel === 'current' ? RIGHT : LEFT;
  const rightText = rightSel === 'current' ? RIGHT : (asVersion(rightSel)?.n === 1 ? LEFT : RIGHT);
  return { ok: true, json: async () => ({
    slug: 'selftest', title: 'Self test', document: 'd',
    left: side(leftSel, leftText), right: side(rightSel, rightText),
    selection: { left: leftSel, right: rightSel },
    versions: VERSIONS, identical: leftText === rightText, readOnly,
    ...review, threads,
    summary: { phase: review.phase, round: review.round, lastSeenByClaude: review.lastSeenByClaude, threads: threads.length, openThreads: open().length, awaitingClaude: open().filter((t) => t.messages[t.messages.length - 1].author !== 'claude').map((t) => t.id), unseenMessages: 0 },
  }) };
};

const mod = new Function(`${src}\nreturn { state, render, poll, renderSendButton, doSendToClaude, openComposer, dvDiffDocument, dvWordDiff, dvStats, dvSimilarity, dvNormalizeProse, dvAlign, dvBlocks, dvMarkdownRanges, diffOf, blockMarks, lineSpans, activeMarks: () => activeMarks, setMarks: (m) => { activeMarks = m; } };`)();
const settle = () => new Promise((r) => setImmediate(r));
let failures = 0;
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected;
  if (!ok) { failures++; console.log(`  FAIL ${label}\n       got: ${JSON.stringify(actual)}`); }
  else console.log(`  ok   ${label} -> ${JSON.stringify(actual)}`);
};
// The comments sidebar is built with createElement/appendChild (keyed DOM reuse,
// so a card being edited survives a poll refresh), not innerHTML. Walk the stub
// tree to read its text rather than asserting on innerHTML, which stays empty.
const deepText = (el) => {
  if (!el) return '';
  let out = (el._text || '') + (el._innerHTML || '');
  for (const child of el.children || []) out += deepText(child);
  return out;
};
// #diff is no longer one innerHTML string: paintRows appends a node per row so
// unchanged rows survive a re-render. Reassemble what the page shows from the
// html each node was built from.
const diffHtml = () => els.diff.children.map((n) => (n.dataset && n.dataset.rowHtml) || n._innerHTML || '').join('');
const balanced = (html) => {
  const open = (html.match(/<(?!\/)[a-z]+[^>]*?(?<!\/)>/g) || []).length;
  const close = (html.match(/<\/[a-z]+>/g) || []).length;
  return open === close;
};

await mod.poll(); await settle(); mod.render();

console.log('1. diff mode renders with comments present');
let html = diffHtml();
check('rows produced', (html.match(/class="diff-row"/g) || []).length, (n) => n > 5);
check('added cells', (html.match(/class="cell added"/g) || []).length, (n) => n > 0);
check('deleted cells', (html.match(/class="cell deleted"/g) || []).length, (n) => n > 0);
check('comment marks', (html.match(/comment-mark/g) || []).length, (n) => n >= 2);
check('tags balanced', balanced(html), true);
check('title applied', h1.textContent, 'Self test');
check('sidebar sections', (els.sections.innerHTML.match(/section-link/g) || []).length, (n) => n >= 3);
check('orphan not dropped', deepText(els['comments-list']).includes('Stale anchor.'), true);
check('general shown', deepText(els['comments-list']).includes('Overall: tighten it.'), true);

console.log('\n2. unified mode');
mod.state.mode = 'unified'; mod.render();
html = diffHtml();
check('rows produced', (html.match(/class="diff-row"/g) || []).length, (n) => n > 5);
check('tags balanced', balanced(html), true);

console.log('\n3. all-lines mode');
mod.state.changesOnly = false; mod.render();
check('tags balanced', balanced(diffHtml()), true);

console.log('\n4. send button follows the server phase');
mod.state.changesOnly = true; mod.state.mode = 'side-by-side';
check('enabled with work waiting', els['send-toggle'].disabled, false);
check('label counts open threads', els['send-toggle'].textContent, (t) => /^Send to Claude \(3\)$/.test(t));
await mod.doSendToClaude(); await settle();
check('one POST fired', submits.length, 1);
check('locked once phase is submitted', els['send-toggle'].disabled, true);
check('label names the wait', els['send-toggle'].textContent, 'Sent, waiting on Claude');
check('status text set', els['send-status'].textContent, (t) => /has not picked it up/.test(t));
// A second click must be refused by the phase alone, with no browser-side timer
// to expire and no localStorage entry that could survive onto a different port.
await mod.doSendToClaude(); await settle();
check('second click refused', submits.length, 1);
review = { ...review, phase: 'editing', updatedAt: stamp() };
await mod.poll();
check('editing phase shows in the button', els['send-toggle'].textContent, 'Claude is editing');
check('editing phase stays locked', els['send-toggle'].disabled, true);
// Claude published: back to Elliot, and every thread now ends with a Claude
// message, so there is nothing left to send.
threads = threads.map((t) => (t.resolved ? t : { ...t, messages: [...t.messages, msg(`${t.id}-r`, 20, 'claude', 'Handled.', 0)] }));
review = { ...review, phase: 'reviewing', round: 3, lastSeenByClaude: 20, updatedAt: stamp() };
await mod.poll();
check('re-armed but nothing to send', els['send-toggle'].textContent, 'Send to Claude');
check('disabled with nothing waiting', els['send-toggle'].disabled, true);

console.log('\n5. failures surface, never silent');
review = { ...review, phase: 'reviewing', updatedAt: stamp() };
threads[0] = { ...threads[0], messages: [msg('m1', 30, 'elliot', 'Still wrong.', 0)] };
await mod.poll();
submitBehavior = 'http500';
await mod.doSendToClaude(); await settle();
check('http error shown', els['send-status'].textContent, (t) => /^Send failed: review\.json is corrupt/.test(t));
submitBehavior = 'network';
await mod.doSendToClaude(); await settle();
check('network error shown', els['send-status'].textContent, (t) => /^Send failed: Failed to fetch/.test(t));
check('button still usable', els['send-toggle'].disabled, false);

console.log('\n6. version compare and history mode');
mod.state.changesOnly = true;
check('version selectors populated', els['left-version'].innerHTML, (h) => /value="1"/.test(h) && /value="current"/.test(h));
check('left pinned to a concrete version', mod.state.selection.left, '1');
check('right on the working file', mod.state.selection.right, 'current');
// Point both sides at v1. The texts are identical, so the render must not
// collapse the entire document behind one "unchanged lines" button.
readOnly = true;
mod.state.selection = { left: '1', right: '1' };
mod.state.lastMtime = null;
await mod.poll(); await settle();
check('identical pair reported', mod.state.data.identical, true);
check('nothing collapsed when identical', /unchanged-collapse/.test(diffHtml()), false);
check('history banner shown', els['history-banner'].hidden, false);
check('commenting refused in history view', (() => { mod.state.pending = null; mod.openComposer({ general: true }); return mod.state.pending; })(), null);
readOnly = false;
mod.state.selection = { left: '1', right: 'current' };
mod.state.lastMtime = null;
await mod.poll(); await settle();
check('banner hidden again', els['history-banner'].hidden, true);
check('commenting allowed again', (() => { mod.state.pending = null; mod.openComposer({ general: true }); const p = mod.state.pending; mod.state.pending = null; mod.state.locked.delete('__composer__'); return !!p; })(), true);

// --- store -----------------------------------------------------------------
// The client can look right while the file underneath it is wrong, so the store
// is tested directly: migration off the old layout, seq monotonicity, and the
// level-triggered phase loop.
console.log('\n7. store: migration, seq, and the phase loop');
const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
const { tmpdir } = await import('node:os');
const { createStore, migrateFromV1, unseenMessages, summarize } = await import('./store.mjs');

const v1 = { comments: [
  { id: 'a', side: 'right', line: 3, quote: 'q', prefix: '', author: 'elliot', body: 'first', resolved: false, createdAt: iso(-9000), updatedAt: iso(-9000), replies: [{ id: 'ar', author: 'claude', body: 'answered', createdAt: iso(-8000), updatedAt: iso(-8000) }] },
  { id: 'b', side: 'general', line: null, quote: '', prefix: '', author: 'elliot', body: 'later', resolved: false, createdAt: iso(-7000), updatedAt: iso(-7000), replies: [] },
] };
const migrated = migrateFromV1(v1);
check('threads carried over', migrated.threads.length, 2);
check('root folded into messages[0]', migrated.threads[0].messages.length, 2);
check('seq is global and chronological', migrated.threads.map((t) => t.messages.map((m) => m.seq)).flat().join(','), '1,2,3');
check('nextSeq past the end', migrated.nextSeq, 4);
check('claude presumed to have seen its own last message', migrated.lastSeenByClaude, 2);
check('one unseen message survives migration', unseenMessages(migrated).length, 1);

const dir = await mkdtemp(resolve(tmpdir(), 'doc-review-test-'));
try {
  await writeFile(resolve(dir, 'comments.json'), JSON.stringify(v1), 'utf8');
  const store2 = createStore(dir);
  const created = await store2.createThread({ side: 'right', line: 1, quote: 'x', body: 'new note', author: 'elliot' });
  check('migration happens on first touch', created.state.threads.length, 3);
  check('new message continues the sequence', created.result.messages[0].seq, 4);

  // Concurrent writes must not lose each other. Without the serialized queue in
  // store.mjs these two interleave and one silently disappears.
  await Promise.all([
    store2.addMessage(created.result.id, { author: 'elliot', body: 'one' }),
    store2.addMessage(created.result.id, { author: 'elliot', body: 'two' }),
  ]);
  const after = await store2.read();
  const target = after.threads.find((t) => t.id === created.result.id);
  check('both concurrent writes landed', target.messages.length, 3);
  check('no duplicate seq', new Set(after.threads.flatMap((t) => t.messages.map((m) => m.seq))).size, after.threads.reduce((n, t) => n + t.messages.length, 0));

  await store2.submit();
  const submitted = await store2.read();
  check('phase recorded on disk, not in memory', JSON.parse(await readFile(resolve(dir, 'review.json'), 'utf8')).phase, 'submitted');
  check('unseen counted for claude', summarize(submitted).unseenMessages, (n) => n >= 3);

  // Level-triggered: a brand new store object over the same directory, standing
  // in for a restarted server, sees the pending submission with no replay.
  const restarted = createStore(dir);
  check('a fresh reader still sees the submission', (await restarted.read()).phase, 'submitted');

  const claimed = await store2.claim();
  check('claim reports what was unread', claimed.result.messages.length, (n) => n >= 3);
  check('claim moves to editing', (await store2.read()).phase, 'editing');
  check('nothing unread after claiming', unseenMessages(await store2.read()).length, 0);

  const published = await store2.publish({ version: 2, path: 'v2.md' });
  check('publish returns to reviewing', published.result.phase, 'reviewing');
  check('publish bumps the round', published.result.round, 2);
  check('version recorded', (await store2.read()).versions.length, 1);
  check('comments.json left untouched', JSON.parse(await readFile(resolve(dir, 'comments.json'), 'utf8')).comments.length, 2);
} finally {
  await rm(dir, { recursive: true, force: true });
}

// --- versions and slugs ----------------------------------------------------
// Snapshotting is deterministic and code-owned; the agent never picks a number
// or decides whether a pass counted. These assertions are that promise.
console.log('\n8. versions and slug allocation');
const { snapshot, resolveSide, defaultSelection } = await import('./versions.mjs');
const { allocateSlug } = await import('./registry.mjs');

const emptyReg = { slugs: {} };
check('slug from the filename', allocateSlug(emptyReg, '/a/b/Quarterly Plan.md'), 'quarterly-plan');
const oneReg = { slugs: { plan: { document: resolve('/a/b/plan.md') } } };
check('same document keeps its slug', allocateSlug(oneReg, '/a/b/plan.md'), 'plan');
const other = allocateSlug(oneReg, '/c/d/plan.md');
check('same name elsewhere gets a directory suffix', other, (s) => /^plan-[0-9a-f]{4}$/.test(s));
check('that suffix is deterministic', allocateSlug(oneReg, '/c/d/plan.md'), other);

const vdir = await mkdtemp(resolve(tmpdir(), 'doc-review-versions-'));
try {
  const doc = resolve(vdir, 'plan.md');
  await writeFile(doc, LEFT, 'utf8');
  const versions = [];
  const v1 = await snapshot(vdir, doc, versions, { round: 1, label: 'initial' });
  versions.push(v1);
  check('v1 minted', v1.n, 1);
  check('v1 file named by number', v1.file, 'v0001.md');
  check('an unchanged pass mints nothing', await snapshot(vdir, doc, versions, { round: 2 }), null);
  await writeFile(doc, RIGHT, 'utf8');
  const v2 = await snapshot(vdir, doc, versions, { round: 2 });
  versions.push(v2);
  check('a changed pass mints v2', v2.n, 2);
  check('the snapshot is the text, not a pointer', (await resolveSide(vdir, doc, versions, 1)).text, LEFT);
  check('current reads the live file', (await resolveSide(vdir, doc, versions, 'current')).text, RIGHT);
  check('previous walks back one', (await resolveSide(vdir, doc, versions, 'previous')).n, 1);
  check('a missing version is reported, not thrown', (await resolveSide(vdir, doc, versions, 9)).exists, false);
  check('default compares the last pass', JSON.stringify(defaultSelection(versions)), '{"left":"previous","right":"current"}');
  check('a fresh document compares against itself', JSON.stringify(defaultSelection([])), '{"left":"current","right":"current"}');
} finally {
  await rm(vdir, { recursive: true, force: true });
}


console.log('9. prose diff: word pairing, character refinement, formatting-only');
{
  const { dvDiffDocument, dvWordDiff, dvStats, dvSimilarity, dvNormalizeProse, dvAlign, dvBlocks, dvMarkdownRanges } = mod;

  // Blocks are the unit, and the block boundaries are what make a reflowed
  // paragraph read as a few changed words instead of as every line replaced.
  const prose = dvBlocks('One sentence here\nand its wrapped tail.\n\n- a bullet\n- another bullet\n## Heading\n');
  check('a wrapped paragraph is one block', prose[0].text, 'One sentence here and its wrapped tail.');
  check('and remembers both source lines', prose[0].lines.map((l) => l.no).join(','), '1,2');
  check('with the offset the second line starts at', prose[0].lines[1].offset, 'One sentence here '.length);
  check('bullets never merge', dvBlocks('- a\n- b\n').filter((b) => b.text.trim()).length, 2);
  check('a heading is its own block', prose.find((b) => b.text === '## Heading') !== undefined, true);
  check('a fenced block stays verbatim', dvBlocks('```\nnot prose\nstill code\n```\n').filter((b) => b.text.trim()).length, 4);

  // Reflowing a paragraph must not read as a rewrite. This is the case the old
  // line-based diff got worst: every line changed because the wrap moved.
  const reflow = dvDiffDocument('The quick brown fox\njumps over the lazy dog.\n', 'The quick brown fox jumps\nover the lazy dog.\n');
  check('a pure rewrap is no change at all', reflow.every((o) => o.type === 'equal'), true);

  // Markdown syntax is located, not stripped: the offsets have to land on the
  // same string the diff and the comment anchors use.
  const md = dvMarkdownRanges('- See **the plan** at [docs](http://x.test/a).');
  const clsAt = (needle, cls) => md.some((r) => r.cls === cls && '- See **the plan** at [docs](http://x.test/a).'.slice(r.start, r.end) === needle);
  check('the bullet marker is marked as lead', clsAt('- ', 'md-lead'), true);
  check('the bold text is marked strong', clsAt('the plan', 'md-strong'), true);
  check('its asterisks are marked as syntax', clsAt('**', 'md-syntax'), true);
  check('the link target is marked as a url', clsAt('(http://x.test/a)', 'md-url'), true);
  check('every range is inside the text', md.every((r) => r.start >= 0 && r.end <= 46 && r.end > r.start), true);

  // A one-letter typo fix. The word is tinted, but only the moved characters
  // are hot; if the whole word came back hot the refinement did not run.
  const typo = dvWordDiff('Please recieve the report.', 'Please receive the report.');
  check('parts concatenate back to the old line', typo.old.map((p) => p.text).join(''), 'Please recieve the report.');
  check('parts concatenate back to the new line', typo.fresh.map((p) => p.text).join(''), 'Please receive the report.');
  // Two minimal scripts exist for this transposition (move the i, or move the
  // e). Either is correct, so assert on how little gets highlighted rather than
  // on which of the two letters Myers happened to pick.
  check('one character is hot on the left', typo.old.filter((p) => p.hot).map((p) => p.text).join('').length, 1);
  check('one character is hot on the right', typo.fresh.filter((p) => p.hot).map((p) => p.text).join('').length, 1);
  check('the word around them is still marked changed', typo.fresh.some((p) => p.changed && !p.hot), true);
  check('untouched words stay untouched', typo.fresh.filter((p) => p.changed).map((p) => p.text).join('').includes('report'), false);

  // A full rewrite must NOT be refined per character, or the row turns into
  // confetti of shared vowels. It also must not come back hot: `hot` means
  // "these exact characters moved", and claiming that about a whole rewritten
  // sentence stacks a second emphasis on top of the tint for no information.
  const rewrite = dvWordDiff('Hold spend flat.', 'Ship the redesign before October.');
  check('a rewrite is tinted', rewrite.fresh.some((p) => p.changed), true);
  check('but nothing in it is hot', rewrite.fresh.some((p) => p.hot), false);
  check('and it still rebuilds the line', rewrite.fresh.map((p) => p.text).join(''), 'Ship the redesign before October.');

  // Positional pairing would line the deleted bullet up with the first
  // insertion. Similarity pairing has to find its real counterpart instead.
  const aligned = dvAlign(
    [{ left: '- Hold spend flat.' }, { left: '- Interview loop stays at four rounds.' }],
    [{ right: '- A brand new bullet about something else entirely.' }, { right: '- Interview loop stays at three rounds.' }],
  );
  const paired = aligned.find((r) => r.del && r.del.left.includes('Interview'));
  check('similarity pairs the interview lines', !!(paired && paired.ins && paired.ins.right.includes('Interview')), true);
  check('the unrelated bullet stays unpaired', aligned.some((r) => !r.del && r.ins.right.includes('brand new')), true);
  check('the dropped line stays unpaired', aligned.some((r) => r.del && r.del.left.includes('Hold spend') && !r.ins), true);

  check('similarity is 1 for identical text', dvSimilarity('same line', 'same line'), 1);
  check('similarity is near 0 for unrelated text', dvSimilarity('Hiring plan for Q3', 'zzz qqq'), (n) => n < 0.2);

  // Markup-only changes are classified, not counted as prose edits.
  check('normalising strips the bullet', dvNormalizeProse('- **Hold** spend flat.'), 'Hold spend flat.');
  check('normalising strips heading hashes', dvNormalizeProse('## Budget'), 'Budget');
  check('normalising keeps link text', dvNormalizeProse('See [the plan](http://x/y).'), 'See the plan.');
  const fmtStats = dvStats(dvDiffDocument('- Hold spend flat.\n', '1. Hold *spend* flat.\n'));
  check('a markup-only change counts as formatting', fmtStats.formatting, 1);
  check('a markup-only change is not counted as an edit', fmtStats.added + fmtStats.deleted, 0);
  const proseStats = dvStats(dvDiffDocument('- Hold spend flat.\n', '- Raise spend by 12 percent.\n'));
  check('a real edit is not called formatting', proseStats.formatting, 0);
  check('a real edit counts on both sides', proseStats.added + proseStats.deleted, 2);

  // Every replace op must carry a paired, order-preserving row list whose
  // lines add up to the deletes and inserts it was built from.
  const replaces = dvDiffDocument(LEFT, RIGHT).filter((o) => o.type === 'replace');
  check('the sample document produces replace ops', replaces.length, (n) => n > 0);
  check('every replace carries rows', replaces.every((o) => Array.isArray(o.rows) && o.rows.length > 0), true);
  check('rows account for every deleted line', replaces.every((o) => o.rows.filter((r) => r.del).length === o.deletes.length), true);
  check('rows account for every inserted line', replaces.every((o) => o.rows.filter((r) => r.ins).length === o.inserts.length), true);
  check('parts exist exactly where a row is paired', replaces.every((o) => o.rows.every((r) => (r.del && r.ins) ? (!!r.oldParts && !!r.freshParts) : (!r.oldParts && !r.freshParts))), true);

  // The cache exists so render() can run freely. Same strings in, same object
  // out; different strings in, a fresh object.
  const first = mod.diffOf(LEFT, RIGHT);
  check('the diff cache returns the same object for the same text', mod.diffOf(LEFT, RIGHT) === first, true);
  check('the diff cache recomputes for different text', mod.diffOf(LEFT, RIGHT + '\nextra') === first, false);
}

console.log('10. the rendered diff carries both highlight levels');
{
  mod.state.threads = [];
  mod.state.data = { left: { text: 'Please recieve the report.\n' }, right: { text: 'Please receive the report.\n' }, identical: false, mtimeMs: 1 };
  mod.render();
  const typoHtml = diffHtml();
  check('character-level marks reach the DOM', typoHtml.includes('char-hot'), true);
  check('word-level marks are still there', typoHtml.includes('word-added'), true);
  check('the typo row is balanced html', balanced(typoHtml), true);

  mod.state.data = { left: { text: '- Hold spend flat.\n' }, right: { text: '1. Hold *spend* flat.\n' }, identical: false, mtimeMs: 2 };
  mod.render();
  check('a formatting-only row is classed as such', diffHtml().includes('formatting-only'), true);
  check('the summary names the formatting count', els.summary.textContent.includes('formatting only'), true);
}



console.log('11. orphaned comments are flagged, not buried');
{
  mod.state.data = { left: { text: LEFT }, right: { text: RIGHT }, identical: false, mtimeMs: 3, frozen: false };
  mod.state.threads = threads;
  mod.state.review = { phase: 'reviewing', round: 2 };
  mod.render();
  const panel = deepText(els['comments-list']);
  check('the orphan group is present', panel.includes('Anchor lost'), true);
  check('the lost quote is still shown', panel.includes('a passage that no longer exists anywhere'), true);
  check('the card says the comment still counts', panel.includes('still sends'), true);
  const cards = els['comments-list'].children;
  const orphanCard = cards.find((c) => c.dataset && c.dataset.cardKey === 'c4');
  check('the orphan card carries the orphaned class', !!orphanCard && orphanCard.className.includes('orphaned'), true);
  check('it is not also styled as a general comment', !!orphanCard && !orphanCard.className.includes('general'), true);
  // It must sit above the resolved fold, not after it.
  const keys = cards.map((c) => (c.dataset ? c.dataset.cardKey : '')).filter(Boolean);
  check('the orphan sits above the resolved group', keys.indexOf('c4') < keys.indexOf('group-resolved'), true);
}

console.log('12. the editing curtain');
{
  mod.state.review = { phase: 'editing', round: 3 };
  mod.state.data = { left: { text: LEFT }, right: { text: RIGHT }, identical: false, mtimeMs: 4, frozen: true };
  mod.render();
  check('the curtain is shown while claude edits', els['editing-curtain'].hidden, false);
  check('the curtain names the round', els['editing-curtain'].innerHTML.includes('Round 3'), true);
  check('the curtain says what is underneath', els['editing-curtain'].innerHTML.includes('last published version'), true);
  check('the body is flagged for the css', document.body.classList.contains('editing'), true);
  check('the send button is locked while editing', els['send-toggle'].disabled, true);

  mod.state.review = { phase: 'reviewing', round: 3 };
  mod.state.data = { left: { text: LEFT }, right: { text: RIGHT }, identical: false, mtimeMs: 5, frozen: false };
  mod.render();
  check('the curtain lifts when the round comes back', els['editing-curtain'].hidden, true);
  check('the body flag is cleared', document.body.classList.contains('editing'), false);
}

console.log('13. diff rows are reused, not rebuilt');
{
  mod.state.review = { phase: 'reviewing', round: 3 };
  mod.state.threads = [];
  mod.state.data = { left: { text: LEFT }, right: { text: RIGHT }, identical: false, mtimeMs: 6, frozen: false };
  mod.render();
  const first = els.diff.children.slice();
  check('rows were produced', first.length, (n) => n > 3);
  mod.render();
  const second = els.diff.children;
  check('an unchanged re-render reuses every node', second.every((node, i) => node === first[i]), true);
  check('the row count is stable', second.length, first.length);

  // A changed document must produce fresh nodes for the rows that changed and
  // reuse the ones that did not. Reusing a stale row is the failure that would
  // show the old text after an edit.
  mod.state.data = { left: { text: LEFT }, right: { text: RIGHT.replace('Hold spend flat.', 'Hold spend flat for now.') }, identical: false, mtimeMs: 7, frozen: false };
  mod.render();
  const third = els.diff.children;
  check('some nodes survive an edit elsewhere', third.some((node) => first.includes(node)), true);
  check('the edited row is a new node', third.some((node) => !first.includes(node)), true);
  check('every row carries its html key', third.every((node) => typeof node.dataset.rowHtml === 'string'), true);

  // Switching view mode rewrites every row, so the cache must be dropped rather
  // than matched against bodies it can never equal.
  mod.state.mode = 'unified';
  mod.render();
  check('switching to unified rebuilds', els.diff.children.every((node) => !third.includes(node)), true);
  check('the container class follows the mode', els.diff.className, 'diff unified');
  mod.state.mode = 'side-by-side';
  mod.render();
}


// --- a comment anchored inside a merged block ------------------------------
// Blocks made the row bigger than a line, and a comment anchor is still a
// source line plus an offset into that line. If the shift is wrong the
// highlight silently lands on the wrong words, which no other assertion here
// would notice.
{
  console.log('\nanchors survive block merging');
  const { dvBlocks, blockMarks, lineSpans, setMarks } = mod;
  const block = dvBlocks('Ship the redesign\nbefore the October board.\n')[0];
  check('the paragraph merged', block.text, 'Ship the redesign before the October board.');
  // A comment on line 2, offset 7, quoting "October".
  const at = block.text.indexOf('October');
  setMarks({ right: new Map([[2, [{ id: 'c1', start: 'before the '.length, end: 'before the October'.length, resolved: false }]]]), left: new Map() });
  const marks = blockMarks(block, 'right');
  check('the mark moved onto the block', marks.length, 1);
  check('and lands on the quoted word', block.text.slice(marks[0].start, marks[0].end), 'October');
  check('and it is where the raw text says it is', marks[0].start, at);
  check('the element carries the line map', lineSpans(block), '1,0,17;2,18,25');
  setMarks({ left: new Map(), right: new Map() });
}

// --- the stylesheet cannot override the hidden attribute -------------------
// The stub DOM has no CSS, so nothing above can catch a class that pins a
// hidden element open. .editing-curtain{display:grid} did exactly that and put
// an 88%-opaque, empty overlay across the page in every phase.
{
  console.log('\nhidden elements stay hidden');
  const html = readFileSync(resolve(here, 'public/index.html'), 'utf8');
  const css = readFileSync(resolve(here, 'public/styles.css'), 'utf8');
  check('the page marks elements hidden', /\shidden(\s|>)/.test(html), true);
  check('so the stylesheet must force them so', /\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/.test(css), true);
}

console.log(failures === 0 ? '\nOK: doc-review-viewer self-test passed.' : `\n${failures} ASSERTION(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
