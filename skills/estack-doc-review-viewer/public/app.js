const $ = (id) => document.getElementById(id);
// The daemon hosts every open document on one origin at /s/<slug>/, so the page
// reads its own slug out of the path and every stored preference is namespaced
// by it. One origin also means these keys survive a daemon restart, which the
// old one-server-per-document build could not manage.
const SLUG = (location.pathname.match(/^\/s\/([^/]+)/) || [])[1] || '';
const API = `/api/${SLUG}`;
const LS = {
  get: (key) => localStorage.getItem(`${SLUG}:${key}`),
  set: (key, value) => localStorage.setItem(`${SLUG}:${key}`, String(value)),
};
function initialSelection() {
  const q = new URLSearchParams(location.search);
  const ok = (v) => (v && (v === 'current' || /^\d+$/.test(v)) ? v : null);
  return { left: ok(q.get('left')), right: ok(q.get('right')) };
}
const state = {
  mode: LS.get('diff-view-mode') || 'side-by-side',
  changesOnly: LS.get('diff-changes-only') !== 'false',
  theme: LS.get('diff-theme') || 'system',
  lastMtime: null, data: null, expanded: new Set(),
  threads: [], review: null, stateStamp: null,
  // A comparison in the address bar is honoured on load, so a link to
  // "v1 against the working file" opens on that pair instead of silently
  // resetting to the default. Left null, the server picks.
  versions: [], selection: initialSelection(), readOnly: false,
  commentsOpen: LS.get('comments-panel-open') !== 'false',
  resolvedOpen: false,
  pending: null,          // { side, line, quote, prefix, general } - a new-comment composer is open
  locked: new Set(),      // thread ids (or '__composer__') with an open reply/edit/confirm UI; skipped on re-render
  reanchoring: new Set(), // thread ids with an in-flight re-anchor PATCH, to avoid duplicate requests
};
// Which two texts the diff is showing. Concrete values only ('current' or a
// version number) so the query is stable and shareable; the server accepts the
// symbolic 'previous'/'first'/'latest' too, and resolves them for the first
// request before the client pins them down.
function sideValue(side) { return side.kind === 'current' ? 'current' : String(side.n); }
function diffQuery() {
  const { left, right } = state.selection;
  return left && right ? `?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}` : '';
}
let sending = false;      // declared here, not next to doSendToClaude, so renderSendButton can never hit its TDZ
let activeMarks = { left: new Map(), right: new Map() };

const lines = dvLines;

// The diff is the expensive part of a render, and render() runs on plenty of
// things that cannot have changed the text: toggling the comments panel,
// expanding a collapsed run, posting a reply, every poll that returns the same
// document. Cache on the two strings themselves so the work happens once per
// document change. Comparing the same string reference is constant time.
let diffCache = { left: null, right: null, ops: null, stats: null, secs: null };
function diffOf(leftText, rightText) {
  if (diffCache.ops && diffCache.left === leftText && diffCache.right === rightText) return diffCache;
  const ops = dvDiffDocument(leftText, rightText);
  diffCache = { left: leftText, right: rightText, ops, stats: dvStats(ops), secs: sections(rightText, ops) };
  return diffCache;
}
function sections(right, ops) { const result=[]; let current=null, proposedLine=0; const headings=lines(right).map((text,index)=>({text,index:index+1})).filter(x=>/^##\s+/.test(x.text)); headings.forEach((h,index)=>result.push({id:`section-${index}`,title:h.text.replace(/^##\s+/,'').trim(),line:h.index,added:0,deleted:0})); const locate=(n)=>{let found=null; for(const s of result)if(s.line<=n)found=s; return found;}; for(const op of ops){ if(op.type==='equal'||op.type==='insert') proposedLine=op.rightNo||proposedLine; if(op.type==='replace'){ proposedLine=op.inserts[0]?.rightNo||proposedLine; } current=locate(proposedLine); if(!current)continue; if(op.type==='insert')current.added+=op.inserts?.length||1; if(op.type==='delete')current.deleted++; if(op.type==='replace'){current.added+=op.inserts.length;current.deleted+=op.deletes.length;} } return result; }
function esc(text) { return text.replace(/[&<>"']/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
// Two levels of highlight. `changed` tints the whole word so the eye finds it
// while scanning; `hot` picks out the characters inside it that actually moved,
// which is what makes a one-letter typo fix read as one letter.
function partClass(part, cls) { return `${part.changed ? cls : ''}${part.hot ? ' char-hot' : ''}`.trim(); }
// Markdown ranges are computed once per distinct block text. The same block is
// re-rendered on every poll and the regex scan is the only per-render work here
// that grows with document size.
const mdCache = new Map();
function mdRangesFor(text) {
  let ranges = mdCache.get(text);
  if (!ranges) { ranges = dvMarkdownRanges(text); if (mdCache.size > 4000) mdCache.clear(); mdCache.set(text, ranges); }
  return ranges;
}

// --- comment anchoring ----------------------------------------------------
// Re-derived every render, never trusted from the stored line number alone.
// The rule, in order:
//   1. If the stored line still contains the quote, the comment stays there.
//      This is the common case and costs one string search.
//   2. Otherwise every line is searched for the quote. No match anywhere means
//      the comment is orphaned: flagged in the sidebar, never silently dropped
//      and never reattached to text it was not written about.
//   3. With several matches, prefer the ones whose preceding characters equal
//      the stored prefix. That is what tells two identical bullets apart.
//   4. Among the survivors, take the one nearest the stored line, and write the
//      new line number back so the next resolve starts from the right place.
function findOffset(text, quote, prefix) {
  let idx = text.indexOf(quote);
  if (prefix) { while (idx >= 0) { if (text.slice(Math.max(0, idx - prefix.length), idx) === prefix) return idx; idx = text.indexOf(quote, idx + 1); } return text.indexOf(quote); }
  return idx;
}
function resolveOne(comment, fileLines) {
  const quote = comment.quote, storedLine = comment.line;
  const stored = fileLines[storedLine - 1];
  if (stored != null && stored.includes(quote)) return { comment, line: storedLine, orphaned: false, general: false, offset: findOffset(stored, quote, comment.prefix), reanchored: false };
  const matches = [];
  fileLines.forEach((text, idx) => { if (text.includes(quote)) matches.push(idx + 1); });
  if (!matches.length) return { comment, line: storedLine, orphaned: true, general: false, offset: -1, reanchored: false };
  let chosen = matches[0];
  if (matches.length > 1) {
    const byPrefix = comment.prefix ? matches.filter((ln) => { const text = fileLines[ln - 1]; const idx = text.indexOf(quote); return idx >= 0 && text.slice(Math.max(0, idx - comment.prefix.length), idx) === comment.prefix; }) : [];
    const pool = byPrefix.length ? byPrefix : matches;
    chosen = pool.reduce((best, ln) => Math.abs(ln - storedLine) < Math.abs(best - storedLine) ? ln : best, pool[0]);
  }
  return { comment, line: chosen, orphaned: false, general: false, offset: findOffset(fileLines[chosen - 1], quote, comment.prefix), reanchored: true };
}
function computeAnchors(comments, leftText, rightText) {
  const leftLines = lines(leftText), rightLines = lines(rightText);
  return comments.map((c) => c.side === 'general'
    ? { comment: c, line: null, orphaned: false, general: true, offset: -1, reanchored: false }
    : resolveOne(c, c.side === 'left' ? leftLines : rightLines));
}
function buildMarksIndex(anchors) {
  const idx = { left: new Map(), right: new Map() };
  anchors.forEach((a) => { if (a.orphaned || a.general) return; const map = idx[a.comment.side]; const list = map.get(a.line) || []; list.push({ id: a.comment.id, start: a.offset, end: a.offset + a.comment.quote.length, resolved: a.comment.resolved }); map.set(a.line, list); });
  return idx;
}
function persistReanchors(anchors) {
  anchors.forEach((a) => {
    if (!a.reanchored || a.orphaned || a.general || state.reanchoring.has(a.comment.id)) return;
    state.reanchoring.add(a.comment.id);
    fetch(`${API}/threads/${a.comment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line: a.line }) })
      .then(() => { a.comment.line = a.line; }).catch(() => {}).finally(() => state.reanchoring.delete(a.comment.id));
  });
}

// --- marking matched quotes inside a line, without touching raw HTML ------
// Never string-replace on assembled HTML: the quote can cross a word-added /
// word-deleted span boundary, or contain characters that got HTML-escaped.
// Instead work entirely in plain-text offsets, split the word-diff parts and
// the comment ranges into the same set of atomic segments, and escape each
// segment fresh. That makes crossing a span boundary a non-event.
function splitSegments(text, parts, marks, mdRanges) {
  const baseParts = parts || [{ text, changed: false }];
  const clamp = (n) => Math.max(0, Math.min(n, text.length));
  const cuts = new Set([0, text.length]); let pos = 0;
  const partRanges = baseParts.map((p) => { const r = { start: pos, end: pos + p.text.length, changed: !!p.changed, hot: !!p.hot }; pos += p.text.length; cuts.add(r.start); cuts.add(r.end); return r; });
  marks.forEach((m) => { cuts.add(clamp(m.start)); cuts.add(clamp(m.end)); });
  mdRanges.forEach((r) => { cuts.add(clamp(r.start)); cuts.add(clamp(r.end)); });
  const points = [...cuts].sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i], end = points[i + 1]; if (start === end) continue;
    const part = partRanges.find((r) => r.start <= start && end <= r.end);
    const marksHere = marks.filter((m) => m.start <= start && end <= m.end).sort((x, y) => x.id.localeCompare(y.id));
    const md = mdRanges.filter((r) => r.start <= start && end <= r.end).map((r) => r.cls);
    segments.push({ text: text.slice(start, end), changed: part ? part.changed : false, hot: part ? part.hot : false, marks: marksHere, md });
  }
  return segments;
}
function renderMarkedText(text, parts, marks, changedCls) {
  const md = mdRangesFor(text);
  if (!marks.length && !md.length && !parts) return esc(text);
  // Innermost first: the markdown styling wraps the characters, the diff tint
  // wraps that, and a comment highlight wraps the lot. Keeping the order fixed
  // is what lets a quote cross a bold marker without the spans interleaving.
  return splitSegments(text, parts, marks, md).map((seg) => {
    let html = esc(seg.text);
    if (seg.md.length) html = `<span class="${seg.md.join(' ')}">${html}</span>`;
    const cls = partClass(seg, changedCls);
    if (cls) html = `<span class="${cls}">${html}</span>`;
    seg.marks.forEach((m) => { html = `<mark class="comment-mark${m.resolved ? ' resolved' : ''}" data-comment-id="${m.id}">${html}</mark>`; });
    return html;
  }).join('');
}
// Comments anchor to a source line and a character offset in that line. A block
// may cover several source lines, so a mark on line 12 has to move to where line
// 12 starts inside the block before it can be drawn. Nothing else in the
// anchoring path changes: the stored anchor is still a source line and offset.
function blockMarks(block, side) {
  if (!block || !side) return [];
  const map = activeMarks[side]; if (!map) return [];
  const out = [];
  for (const ln of block.lines) {
    for (const m of map.get(ln.no) || []) out.push({ ...m, start: m.start + ln.offset, end: m.end + ln.offset });
  }
  return out;
}
// The map back, carried on the element: which source line each stretch of the
// block came from. handleSelection needs it so a quote taken out of a wrapped
// paragraph is still stored against the line it actually sits on.
function lineSpans(block) { return block ? block.lines.map((ln) => `${ln.no},${ln.offset},${ln.text.length}`).join(';') : ''; }

function cell(block, kind, marker, parts, side, marksArg) {
  const text = block ? block.text : '';
  const marks = Array.isArray(marksArg) ? marksArg : blockMarks(block, side);
  const inner = renderMarkedText(text, parts, marks, kind === 'added' ? 'word-added' : 'word-deleted');
  const spans = lineSpans(block);
  // The block's markdown shape becomes a class, so a heading reads as a heading
  // and a nested bullet sits where a nested bullet belongs. The source text is
  // untouched; only its size and indentation change. Without this, a document
  // whose structure was reorganised is 240 rows of identical-looking text and
  // there is nowhere for the eye to rest.
  const shape = block && block.shape ? block.shape : { kind: '', depth: 0 };
  const shapeCls = shape.kind ? ` md-block md-${shape.kind}${shape.depth ? ` md-depth-${shape.depth}` : ''}` : '';
  return `<div class="cell ${kind || ''}"><span class="gutter">${block ? block.no : ''}</span><span class="marker">${marker || ''}</span><span class="line-text${shapeCls}"${spans ? ` data-lines="${spans}"` : ''}>${inner}</span></div>`;
}
const NO_BLOCK = null;
function row(op) {
  if (op.type === 'overflow') return '<div class="diff-row"><div class="cell"><span class="line-text">This document has too many distinct blocks to diff.</span></div></div>';
  if (op.type === 'equal') return `<div class="diff-row">${cell(op.leftBlock, '', '', null, 'left')}${cell(op.rightBlock, '', '', null, 'right')}</div>`;
  if (op.type === 'replace') {
    // Pairing and word-diffing already happened in dvDiffDocument, by
    // similarity rather than by position. An unpaired block has no counterpart
    // to highlight against, so it gets the row tint and nothing finer.
    return op.rows.map((pair) => {
      const mark = pair.formatting ? '~' : null;   // '~' reads as "markup only", and keeps the gutter one column wide
      const left = pair.del ? cell(pair.del.leftBlock, 'deleted', mark || '-', pair.oldParts, 'left') : cell(NO_BLOCK, 'empty', '', null, null);
      const right = pair.ins ? cell(pair.ins.rightBlock, 'added', mark || '+', pair.freshParts, 'right') : cell(NO_BLOCK, 'empty', '', null, null);
      return `<div class="diff-row${pair.formatting ? ' formatting-only' : ''}">${left}${right}</div>`;
    }).join('');
  }
  if (op.type === 'delete') return `<div class="diff-row">${cell(op.leftBlock, 'deleted', '-', null, 'left')}${cell(NO_BLOCK, 'empty', '', null, null)}</div>`;
  return `<div class="diff-row">${cell(NO_BLOCK, 'empty', '', null, null)}${cell(op.rightBlock, 'added', '+', null, 'right')}</div>`;
}
function unifiedRow(op) {
  if (op.type === 'overflow') return row(op);
  if (op.type === 'equal') { const merged = [...blockMarks(op.leftBlock, 'left'), ...blockMarks(op.rightBlock, 'right')]; return `<div class="diff-row">${cell(op.rightBlock, '', '', null, 'right', merged)}</div>`; }
  if (op.type === 'replace') {
    // Each old block sits directly above the block that replaced it. The old
    // build listed every deletion and then every insertion, which for prose put
    // a sentence and its rewrite several rows apart.
    const rows = [];
    op.rows.forEach((pair) => {
      const cls = `diff-row${pair.formatting ? ' formatting-only' : ''}`;
      const mark = pair.formatting ? '~' : null;
      if (pair.del) rows.push(`<div class="${cls}">${cell(pair.del.leftBlock, 'deleted', mark || '-', pair.oldParts, 'left')}</div>`);
      if (pair.ins) rows.push(`<div class="${cls}">${cell(pair.ins.rightBlock, 'added', mark || '+', pair.freshParts, 'right')}</div>`);
    });
    return rows.join('');
  }
  if (op.type === 'delete') return `<div class="diff-row">${cell(op.leftBlock, 'deleted', '-', null, 'left')}</div>`;
  return `<div class="diff-row">${cell(op.rightBlock, 'added', '+', null, 'right')}</div>`;
}

// Rows are reused by key. render() runs on things that change one row or no
// rows at all -- a reply posted, a phase flip, a panel toggle -- and reassigning
// #diff.innerHTML throws away every node, which drops an in-progress text
// selection, kills focus, and forces the browser to re-parse the whole
// document. Keeping the nodes whose HTML did not change means selecting a
// passage no longer races the next update.
let rowNodes = new Map();   // key -> element, from the previous render
function paintRows(container, entries) {
  const next = new Map();
  const frag = document.createDocumentFragment();
  for (const entry of entries) {
    const previous = rowNodes.get(entry.key);
    if (previous && previous.dataset.rowHtml === entry.html) { next.set(entry.key, previous); frag.appendChild(previous); continue; }
    const el = document.createElement('div');
    el.innerHTML = entry.html;
    // Each entry is one or more sibling rows, so unwrap rather than nesting a
    // wrapper div inside the grid and breaking the column layout.
    const node = el.children.length === 1 ? el.children[0] : el;
    if (node === el) el.className = 'diff-group';
    node.dataset.rowHtml = entry.html;
    next.set(entry.key, node);
    frag.appendChild(node);
  }
  container.innerHTML = '';
  container.appendChild(frag);
  rowNodes = next;
}

function render() {
  if (!state.data) return;
  const keepY = window.scrollY, keepDiff = $('diff').scrollTop;
  const { ops, stats, secs } = diffOf(state.data.left.text, state.data.right.text);
  const touched = secs.filter((s) => s.added || s.deleted).length;
  const parts = [`${stats.added} added`, `${stats.deleted} removed`];
  // Formatting-only lines are reported apart from real edits. Folding them in
  // makes a pass that reflowed markdown look like a pass that rewrote prose.
  if (stats.formatting) parts.push(`${stats.formatting} formatting only`);
  parts.push(`${touched} of ${secs.length} sections touched`);
  $('summary').textContent = parts.join(' · ');
  $('sections').innerHTML = secs.map((s) => `<button class="section-link" data-line="${s.line}"><span class="dot ${s.added && s.deleted ? 'both' : s.added ? 'add' : s.deleted ? 'del' : ''}"></span><span>${esc(s.title)}</span><span class="badge">${s.added + s.deleted}</span></button>`).join('');

  // Marks must be re-derived here, every call: render() blows away #diff's
  // DOM on every poll-triggered re-render, so nothing attached earlier
  // survives, and the underlying files can be edited out from under a comment
  // between one render and the next.
  const anchors = computeAnchors(state.threads, state.data.left.text, state.data.right.text);
  activeMarks = buildMarksIndex(anchors);

  // Comparing a version against itself produces an all-equal script; collapsing
  // it would hide the entire document behind one "N unchanged lines" button.
  const changesOnly = state.changesOnly && !state.data.identical;
  // The key has to name the row's identity, not its position, or inserting one
  // line above renumbers every key below it and the reuse buys nothing.
  const keyOf = (o) => `${o.type}:${o.leftNo ?? o.deletes?.[0]?.leftNo ?? ''}:${o.rightNo ?? o.inserts?.[0]?.rightNo ?? ''}`;
  const out = []; let unchanged = []; let collapseId = 0;
  const flush = () => {
    if (!unchanged.length) return;
    const id = collapseId++;
    if (changesOnly && unchanged.length > 6 && !state.expanded.has(id)) {
      out.push({ key: `collapse:${id}:${unchanged.length}`, html: `<button class="unchanged-collapse" data-expand="${id}" type="button">… ${unchanged.length} unchanged lines</button>` });
    } else {
      unchanged.forEach((o) => out.push({ key: keyOf(o), html: state.mode === 'unified' ? unifiedRow(o) : row(o) }));
    }
    unchanged = [];
  };
  ops.forEach((o) => { if (o.type === 'equal') unchanged.push(o); else { flush(); out.push({ key: keyOf(o), html: state.mode === 'unified' ? unifiedRow(o) : row(o) }); } });
  flush();
  const wanted = `diff ${state.mode === 'unified' ? 'unified' : 'side-by-side'}`;
  // Switching view mode changes every row's HTML, so drop the cache rather than
  // comparing every key against a body it can never match.
  if ($('diff').className !== wanted) { rowNodes = new Map(); $('diff').className = wanted; }
  paintRows($('diff'), out);
  $('view-toggle').textContent = state.mode === 'unified' ? 'Side-by-side view' : 'Unified view';
  $('changes-toggle').textContent = state.changesOnly ? 'All lines' : 'Changes only';
  $('changes-toggle').setAttribute('aria-pressed', String(state.changesOnly));
  $('sections').querySelectorAll('[data-line]').forEach((button) => button.onclick = () => { const target = [...document.querySelectorAll('.line-text')].find((el) => el.textContent === lines(state.data.right.text)[Number(button.dataset.line) - 1]); target?.scrollIntoView({ block: 'start' }); });
  document.querySelectorAll('.unchanged-collapse').forEach((button) => button.onclick = () => { state.expanded.add(Number(button.dataset.expand)); render(); });
  window.scrollTo(0, keepY); $('diff').scrollTop = keepDiff;

  // Re-anchoring writes back to the working file's stored line number, so it
  // must not run while a historical pair is on screen.
  renderCurtain();
  if (!state.readOnly) persistReanchors(anchors);
  renderVersionPickers();
  renderHistoryBanner();
  renderCommentsPanel(anchors);
  renderSendButton();
}

// --- comments sidebar -------------------------------------------------
function truncateQuote(text, max = 120) { return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
function relativeTime(iso) {
  const then = new Date(iso).getTime(); if (Number.isNaN(then)) return '';
  const diff = Date.now() - then, min = 60000, hour = 3600000, day = 86400000;
  if (diff < min) return 'just now';
  if (diff < hour) return `${Math.max(1, Math.floor(diff / min))}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 2 * day) return 'yesterday';
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}
// A thread is just an anchor plus an ordered messages array. There is no
// special "root" message: the first entry is the opening comment and every
// later entry is a reply, which is what removes the root/reply branching that
// used to run through every edit, delete, and render path.
function newestClaudeSeq(thread) { return thread.messages.reduce((best, m) => (m.author === 'claude' && m.seq > best ? m.seq : best), 0); }
function isUnread(thread) { const seq = newestClaudeSeq(thread); if (!seq) return false; return seq > Number(LS.get(`thread-read-${thread.id}`) || 0); }
function markSeen(thread) { const seq = newestClaudeSeq(thread); if (seq) LS.set(`thread-read-${thread.id}`, seq); }

function messageHtml(msg, threadId) {
  // The stored author value stays `elliot` for wire compatibility; only the
  // label a reader sees is generic.
  const badge = msg.author === 'claude' ? 'Claude' : 'You';
  return `<div class="thread-msg ${msg.author}" data-message-id="${msg.id}">
    <div class="msg-head"><span class="author-badge ${msg.author}">${badge}</span><span class="msg-time">${relativeTime(msg.updatedAt || msg.createdAt)}</span></div>
    <div class="msg-body">${esc(msg.body)}</div>
    <div class="msg-actions"><button type="button" data-act="edit" data-id="${threadId}" data-message="${msg.id}">Edit</button><button type="button" data-act="delete" data-id="${threadId}" data-message="${msg.id}">Delete</button></div>
  </div>`;
}
function cardInnerHtml(anchor) {
  const c = anchor.comment;
  let quoteBlock;
  if (anchor.general) quoteBlock = `<div class="card-quote card-quote-general">General comment</div>`;
  else if (anchor.orphaned) quoteBlock = `<div class="card-orphan-note">Anchor lost &middot; was line ${c.line}</div><div class="card-quote card-quote-orphaned">${esc(truncateQuote(c.quote))}</div><div class="card-orphan-hint">That text is no longer in the document. The comment still counts and still sends.</div>`;
  else quoteBlock = `<div class="card-quote">${esc(truncateQuote(c.quote))}</div><div class="card-line-ref">Line ${anchor.line} &middot; ${c.side}</div>`;
  const thread = c.messages.map((m) => messageHtml(m, c.id)).join('');
  return `${isUnread(c) ? '<span class="unread-dot" aria-hidden="true"></span>' : ''}${quoteBlock}<div class="card-thread">${thread}</div><div class="card-actions"><button type="button" data-act="reply" data-id="${c.id}">Reply</button><button type="button" data-act="toggle-resolve" data-id="${c.id}">${c.resolved ? 'Reopen' : 'Resolve'}</button></div><div class="reply-slot" data-reply-slot="${c.id}"></div>`;
}
function buildCardElement(anchor) {
  const c = anchor.comment;
  const card = document.createElement('div');
  card.className = `comment-card${anchor.orphaned ? ' orphaned' : ''}${c.resolved ? ' resolved' : ''}${anchor.general ? ' general' : ''}`;
  card.dataset.cardKey = c.id; card.tabIndex = 0;
  card.innerHTML = cardInnerHtml(anchor);
  return card;
}
function composerInnerHtml(pending) {
  const label = pending.general ? `<div class="composer-label">General comment</div>` : `<div class="composer-quote">${esc(truncateQuote(pending.quote, 200))}</div>`;
  return `${label}<textarea class="composer-input" data-role="new-comment" placeholder="Leave a comment…" rows="3"></textarea><div class="composer-actions"><button type="button" data-act="submit-comment">Comment</button><button type="button" data-act="cancel-comment">Cancel</button></div>`;
}
function buildComposerElement(pending) {
  const card = document.createElement('div');
  card.className = 'comment-card composer-card'; card.dataset.cardKey = '__composer__';
  card.innerHTML = composerInnerHtml(pending);
  return card;
}

// Comment cards are re-derived from state.threads every call, same as the
// diff body. The one exception: a card whose id is in state.locked (an open
// reply box, edit box, or delete confirmation) is reused as-is rather than
// rebuilt, so a poll-triggered refresh never clobbers text the reviewer is mid-typing.
function renderCommentsPanel(anchors) {
  const openGeneral = anchors.filter((a) => a.general && !a.comment.resolved).sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt));
  const openLine = anchors.filter((a) => !a.general && !a.orphaned && !a.comment.resolved).sort((a, b) => a.line - b.line);
  const resolved = anchors.filter((a) => a.comment.resolved).sort((a, b) => b.comment.updatedAt.localeCompare(a.comment.updatedAt));
  const orphaned = anchors.filter((a) => a.orphaned && !a.comment.resolved);
  const openCount = openGeneral.length + openLine.length;

  $('comments-toggle').textContent = `Comments (${openCount})`;
  $('comments-toggle').setAttribute('aria-pressed', String(state.commentsOpen));
  $('comments-panel').classList.toggle('open', state.commentsOpen);
  document.body.classList.toggle('comments-open', state.commentsOpen);

  const list = $('comments-list');
  const existing = new Map();
  [...list.children].forEach((node) => {
    if (node.dataset && node.dataset.cardKey) existing.set(node.dataset.cardKey, node);
    if (node.tagName === 'DETAILS') (node.children || []).forEach((inner) => { if (inner.className === 'resolved-body') (inner.children || []).forEach((c2) => { if (c2.dataset?.cardKey) existing.set(c2.dataset.cardKey, c2); }); });
  });
  const appendCard = (anchor, target) => {
    const key = anchor.comment.id;
    if (state.locked.has(key) && existing.has(key)) { target.appendChild(existing.get(key)); return; }
    target.appendChild(buildCardElement(anchor));
    if (state.commentsOpen) markSeen(anchor.comment);
  };

  const frag = document.createDocumentFragment();
  if (state.pending) { if (state.locked.has('__composer__') && existing.has('__composer__')) frag.appendChild(existing.get('__composer__')); else frag.appendChild(buildComposerElement(state.pending)); }
  if (!openGeneral.length && !openLine.length && !resolved.length && !orphaned.length && !state.pending) {
    const empty = document.createElement('div'); empty.className = 'comments-empty'; empty.textContent = 'No comments yet. Select text in the diff, or start a general comment.'; frag.appendChild(empty);
  }
  [...openGeneral, ...openLine].forEach((a) => appendCard(a, frag));
  if (orphaned.length) {
    const header = document.createElement('div'); header.className = 'orphaned-header'; header.dataset.cardKey = 'group-orphaned';
    header.textContent = `Anchor lost (${orphaned.length})`;
    frag.appendChild(header);
    orphaned.forEach((a) => appendCard(a, frag));
  }
  if (resolved.length) {
    const group = document.createElement('details');
    group.className = 'resolved-group'; group.dataset.cardKey = 'group-resolved'; group.open = state.resolvedOpen;
    group.addEventListener('toggle', () => { state.resolvedOpen = group.open; });
    const summary = document.createElement('summary'); summary.textContent = `Resolved (${resolved.length})`;
    const body = document.createElement('div'); body.className = 'resolved-body';
    resolved.forEach((a) => appendCard(a, body));
    group.appendChild(summary); group.appendChild(body);
    frag.appendChild(group);
  }
  list.innerHTML = '';
  list.appendChild(frag);
}

// --- send-to-claude button ----------------------------------------------
// The button reflects server truth, not a browser timer. `phase` is the single
// source of whose turn it is, so a refresh, a restart onto a different port, or
// a second browser window all show the same thing, and there is no local lock
// left to get stuck in the wrong position.
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Sticky until the next successful send. A failed send leaves the phase alone,
// so without this the very next render would wipe the only notice the reviewer gets.
let sendError = null;

function setSendStatus(text, kind) {
  ['send-status', 'send-status-panel'].forEach((id) => {
    const el = $(id); if (!el) return;
    el.textContent = text;
    el.className = `send-status${kind ? ' ' + kind : ''}`;
  });
}

function renderSendButton() {
  const button = $('send-toggle'); if (!button) return;
  // The server already answered this in summarize(); recomputing it here is
  // how the same predicate ends up living in two files and drifting.
  const awaiting = state.review?.summary?.awaitingClaude || [];
  const phase = state.review?.phase || 'reviewing';
  const setBtn = (label, enabled, title, pulse) => {
    button.textContent = label;
    button.disabled = !enabled;
    button.title = title;
    button.classList.toggle('pulse-waiting', !!pulse);
    button.classList.toggle('primary-disabled', !enabled && !pulse);
  };

  if (sending) { setBtn('Sending...', false, '', true); return; }

  if (phase === 'editing') {
    setBtn('Claude is editing', false, 'Claude has this round and is working on it', true);
    setSendStatus('Claude is editing. The page updates when it hands the document back.', 'pending');
    return;
  }
  if (phase === 'submitted') {
    setBtn('Sent, waiting on Claude', false, 'Claude has not picked this round up yet', true);
    setSendStatus(`Sent round ${state.review?.round ?? ''}. Claude has not picked it up yet.`, 'pending');
    return;
  }
  if (!awaiting.length) {
    setBtn('Send to Claude', false, 'nothing to send', false);
    const seen = state.review?.summary?.lastSeenByClaude || 0;
    if (sendError) setSendStatus(sendError, 'error');
    else setSendStatus(seen ? 'Nothing awaiting a reply.' : '', seen ? 'done' : null);
    return;
  }
  setBtn(`Send to Claude (${awaiting.length})`, true, `${plural(awaiting.length, 'thread')} awaiting a reply`, false);
  // A failed send leaves the phase at "reviewing", so this branch is exactly
  // where the error has to survive. Clearing it here is how the old build made
  // a dead server look like a working one.
  setSendStatus(sendError || '', sendError ? 'error' : null);
}

let titleApplied = false;
function applyServerConfig(data) {
  if (titleApplied || !data.title) return;
  titleApplied = true;
  const h = document.querySelector('h1'); if (h) h.textContent = data.title;
  document.title = data.title;
}

// --- version history ------------------------------------------------------
// Versions are minted by the daemon on publish, never by the agent and never by
// this page. All the client does is choose which two to look at.
function renderVersionPickers() {
  // "working file" on its own told him nothing: he could not tell whether the
  // file on disk was still v2 or had moved past it. The server answers that, so
  // the option names its base version and whether it has drifted off it.
  const workingLabel = () => {
    const w = state.review?.working;
    if (!w || w.base == null) return 'working file';
    return w.clean ? `v${w.base} · working copy` : `v${w.base} + edits · working copy`;
  };
  const build = (id, selected, includeCurrent) => {
    const select = $(id); if (!select) return;
    const options = state.versions.map((v) => ({ value: String(v.n), label: `v${v.n} · ${v.label}` }));
    if (includeCurrent) options.push({ value: 'current', label: workingLabel() });
    const signature = options.map((o) => `${o.value}=${o.label}`).join(',') + '|' + selected;
    if (select.dataset.signature === signature) return; // rebuilding steals focus mid-click
    select.dataset.signature = signature;
    select.innerHTML = options.map((o) => `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  };
  build('left-version', state.selection.left, true);
  build('right-version', state.selection.right, true);
}
// While the agent holds the round there is nothing here worth reading: the file
// on disk is mid-rewrite and the diff underneath is the last published version.
// Curtain it rather than showing a document that is about to change out from
// under him, and take commenting away for the same reason a historical view
// does -- a comment written now would anchor to text that may not survive.
function renderCurtain() {
  const editing = (state.review?.phase || 'reviewing') === 'editing';
  document.body.classList.toggle('editing', editing);
  const curtain = $('editing-curtain');
  if (!curtain) return;
  curtain.hidden = !editing;
  if (!editing) return;
  const round = state.review?.round ?? '';
  const frozen = state.data?.frozen;
  curtain.innerHTML = `<div class="curtain-card"><div class="curtain-spinner" aria-hidden="true"></div>
    <h2>Claude is editing</h2>
    <p>Round ${esc(String(round))} is with Claude. The document comes back the moment it publishes.</p>
    <p class="curtain-note">${frozen ? 'Showing the last published version until then.' : 'No version has been published yet.'}</p></div>`;
}

function renderHistoryBanner() {
  const el = $('history-banner'); if (!el) return;
  document.body.classList.toggle('read-only', state.readOnly);
  if (!state.readOnly) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = `Viewing history: ${state.data.left.label} against ${state.data.right.label}. Commenting is off until the right side is back on the working file.`;
}
function chooseVersion(which, value) {
  state.selection = { ...state.selection, [which]: value };
  state.lastMtime = null; // force the next poll to accept the new pair
  state.expanded.clear();
  void poll();
}
$('left-version').onchange = (event) => chooseVersion('left', event.target.value);
$('right-version').onchange = (event) => chooseVersion('right', event.target.value);

// One request per tick. /diff carries the document pair and the review state
// together, so the two can never describe different moments.
async function poll(force = false) {
  let touched = force;
  try {
    const response = await fetch(`${API}/diff${diffQuery()}`, { cache: 'no-store' });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    state.review = data;
    const reviewStamp = `${data.updatedAt || ''}:${data.phase}:${data.round}:${data.threads.length}`;
    if (state.stateStamp !== reviewStamp) {
      state.stateStamp = reviewStamp;
      state.threads = Array.isArray(data.threads) ? data.threads : [];
      touched = true;
    }
    // Pin the symbolic selection the server resolved for us, so every later
    // request asks for the same concrete pair.
    state.selection = { left: sideValue(data.left), right: sideValue(data.right) };
    state.versions = data.versions || [];
    state.readOnly = !!data.readOnly;
    const stamp = `${state.selection.left}:${state.selection.right}:${data.left.text.length}:${data.right.text.length}:${data.left.mtimeMs}:${data.right.mtimeMs}`;
    if (state.lastMtime !== stamp) {
      state.lastMtime = stamp; state.data = data; touched = true;
      $('status').textContent = data.right.exists ? 'reloaded ' + new Date().toLocaleTimeString() : 'document missing';
    }
    applyServerConfig(data);
  } catch { $('status').textContent = 'viewer offline'; }
  if (touched) render(); else renderSendButton();
}

function setupTheme(){const saved=state.theme;if(saved!=='system')document.documentElement.dataset.theme=saved;$('theme-toggle').textContent=saved==='dark'?'Light mode':'Dark mode';$('theme-toggle').onclick=()=>{state.theme=(state.theme==='dark'?'light':'dark');LS.set('diff-theme',state.theme);document.documentElement.dataset.theme=state.theme;$('theme-toggle').textContent=state.theme==='dark'?'Light mode':'Dark mode';};}
$('view-toggle').onclick=()=>{state.mode=state.mode==='unified'?'side-by-side':'unified';LS.set('diff-view-mode',state.mode);render();};
$('changes-toggle').onclick=()=>{state.changesOnly=!state.changesOnly;LS.set('diff-changes-only',state.changesOnly);render();};
setupTheme();

// --- comments panel toggle + keyboard shortcut ---------------------------
function toggleCommentsPanel() { state.commentsOpen = !state.commentsOpen; LS.set('comments-panel-open', state.commentsOpen); render(); }
$('comments-toggle').onclick = toggleCommentsPanel;
function openPanelIfClosed() { if (!state.commentsOpen) { state.commentsOpen = true; LS.set('comments-panel-open', true); } }

// --- new-comment composer (anchored + general) ----------------------------
// Historical views are read-only. A comment written against v2 while the file
// has moved on to v5 would anchor to text that is not in the working document,
// so it is refused rather than silently orphaned.
function openComposer(pending) { if (state.readOnly) return; state.pending = pending; state.locked.add('__composer__'); openPanelIfClosed(); render(); const ta = document.querySelector('[data-card-key="__composer__"] textarea'); ta?.focus(); }
function closeComposer() { state.pending = null; state.locked.delete('__composer__'); render(); }
async function submitNewComment() {
  const composer = document.querySelector('[data-card-key="__composer__"]'); const textarea = composer?.querySelector('textarea.composer-input'); const text = textarea?.value.trim();
  if (!text || !state.pending) return;
  const payload = state.pending.general
    ? { general: true, body: text, author: 'elliot' }
    : { side: state.pending.side, line: state.pending.line, quote: state.pending.quote, prefix: state.pending.prefix, body: text, author: 'elliot' };
  await fetch(`${API}/threads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  state.pending = null; state.locked.delete('__composer__');
  await poll(true);
}
$('new-general-comment').onclick = () => openComposer({ general: true });

// --- reply / edit / delete / resolve -------------------------------------
function openReplyBox(id) {
  if (state.readOnly) return;
  state.locked.add(id);
  const card = document.querySelector(`[data-card-key="${id}"]`); const slot = card?.querySelector('.reply-slot'); if (!slot) return;
  slot.innerHTML = `<textarea class="reply-input" data-id="${id}" placeholder="Reply…" rows="2"></textarea><div class="composer-actions"><button type="button" data-act="submit-reply" data-id="${id}">Reply</button><button type="button" data-act="cancel-reply" data-id="${id}">Cancel</button></div>`;
  slot.querySelector('textarea').focus();
}
function closeReplyBox(id) { state.locked.delete(id); render(); }
// A reply appends to the bottom of its card. On a long thread that lands below
// the panel fold, so the click produced no visible change and read as a dead
// button -- the reviewer posted the same reply three times before giving up. Every
// write to a thread now brings its result into view.
function revealThread(id) {
  const card = document.querySelector(`[data-card-key="${id}"]`);
  if (!card) return;
  const messages = card.querySelectorAll('[data-message-id]');
  (messages[messages.length - 1] || card).scrollIntoView({ block: 'nearest' });
}
async function submitReply(id) {
  const card = document.querySelector(`[data-card-key="${id}"]`); const textarea = card?.querySelector('textarea.reply-input'); const text = textarea?.value.trim();
  if (!text) return;
  await fetch(`${API}/threads/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text, author: 'elliot' }) });
  state.locked.delete(id); await poll(true); revealThread(id);
}
function openEdit(id, messageId) {
  state.locked.add(id);
  const card = document.querySelector(`[data-card-key="${id}"]`);
  const msg = card?.querySelector(`[data-message-id="${messageId}"]`); if (!msg) return;
  const bodyEl = msg.querySelector('.msg-body'); const current = bodyEl.textContent;
  bodyEl.innerHTML = `<textarea class="edit-input" rows="3">${esc(current)}</textarea><div class="composer-actions"><button type="button" data-act="save-edit" data-id="${id}" data-message="${messageId}">Save</button><button type="button" data-act="cancel-edit" data-id="${id}" data-message="${messageId}">Cancel</button></div>`;
  bodyEl.querySelector('textarea').focus();
}
async function saveEdit(id, messageId) {
  const card = document.querySelector(`[data-card-key="${id}"]`);
  const msg = card?.querySelector(`[data-message-id="${messageId}"]`);
  const textarea = msg?.querySelector('textarea.edit-input'); const text = textarea?.value.trim();
  if (!text) return;
  await fetch(`${API}/threads/${id}/messages/${messageId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) });
  state.locked.delete(id); await poll(true);
}
async function toggleResolve(id) {
  const thread = state.threads.find((t) => t.id === id); if (!thread) return;
  await fetch(`${API}/threads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolved: !thread.resolved }) });
  // Resolving drops the card into the fold. If that fold is closed the card just
  // vanishes, which is indistinguishable from a dead button, so open it and
  // scroll to where the card landed.
  if (!thread.resolved) state.resolvedOpen = true;
  await poll(true); revealThread(id);
}
function showDeleteConfirm(actionsEl, id, messageId) { actionsEl.innerHTML = `<span class="confirm-label">Delete?</span> <button type="button" class="confirm-yes" data-act="confirm-delete" data-id="${id}" data-message="${messageId}">yes</button> <button type="button" class="confirm-no" data-act="cancel-delete-confirm" data-id="${id}" data-message="${messageId}">no</button>`; }
function restoreDeleteButtons(actionsEl, id, messageId) { actionsEl.innerHTML = `<button type="button" data-act="edit" data-id="${id}" data-message="${messageId}">Edit</button><button type="button" data-act="delete" data-id="${id}" data-message="${messageId}">Delete</button>`; }
// Deleting the last message in a thread deletes the thread, server-side, so the
// UI never has to special-case "this was the opening comment".
async function confirmDelete(id, messageId) {
  await fetch(`${API}/threads/${id}/messages/${messageId}`, { method: 'DELETE' });
  state.locked.delete(id); await poll(true);
}

$('comments-list').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-act]');
  if (!btn) { const card = event.target.closest('.comment-card'); if (card && card.dataset.cardKey && card.dataset.cardKey !== '__composer__') focusDiffMark(card.dataset.cardKey); return; }
  const act = btn.dataset.act, id = btn.dataset.id, messageId = btn.dataset.message;
  if (act === 'reply') return openReplyBox(id);
  if (act === 'cancel-reply') return closeReplyBox(id);
  if (act === 'submit-reply') return void submitReply(id);
  if (act === 'toggle-resolve') return void toggleResolve(id);
  if (act === 'edit') return openEdit(id, messageId);
  if (act === 'cancel-edit') { state.locked.delete(id); render(); return; }
  if (act === 'save-edit') return void saveEdit(id, messageId);
  if (act === 'delete') { state.locked.add(id); showDeleteConfirm(btn.closest('.msg-actions'), id, messageId); return; }
  if (act === 'cancel-delete-confirm') { state.locked.delete(id); restoreDeleteButtons(btn.closest('.msg-actions'), id, messageId); return; }
  if (act === 'confirm-delete') return void confirmDelete(id, messageId);
  if (act === 'submit-comment') return void submitNewComment();
  if (act === 'cancel-comment') return closeComposer();
});
$('comments-list').addEventListener('keydown', (event) => {
  const el = event.target; if (el.tagName !== 'TEXTAREA') return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (el.classList.contains('composer-input')) closeComposer();
    else if (el.classList.contains('reply-input')) closeReplyBox(el.dataset.id);
    else if (el.classList.contains('edit-input')) { const card = el.closest('.comment-card'); state.locked.delete(card?.dataset.cardKey); render(); }
    return;
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (el.classList.contains('composer-input')) submitNewComment();
    else if (el.classList.contains('reply-input')) submitReply(el.dataset.id);
    else if (el.classList.contains('edit-input')) { const msg = el.closest('[data-message-id]'); const card = el.closest('.comment-card'); saveEdit(card.dataset.cardKey, msg.dataset.messageId); }
  }
});

// --- two-way link between a diff highlight and its sidebar card ----------
function focusDiffMark(commentId) {
  const mark = document.querySelector(`mark.comment-mark[data-comment-id="${commentId}"]`); if (!mark) return;
  mark.scrollIntoView({ block: 'center' }); mark.classList.add('pulse'); setTimeout(() => mark.classList.remove('pulse'), 900);
}
function focusCommentCard(commentId) {
  openPanelIfClosed();
  if (!state.commentsOpen) { /* already opened above */ }
  const after = () => { const card = document.querySelector(`.comment-card[data-card-key="${commentId}"]`); if (!card) return; card.scrollIntoView({ block: 'center' }); card.classList.add('pulse'); card.focus(); setTimeout(() => card.classList.remove('pulse'), 900); };
  if (state.commentsOpen && !document.querySelector('.comment-card')) render();
  after();
}
$('diff').addEventListener('click', (event) => { const mark = event.target.closest('mark.comment-mark'); if (mark) focusCommentCard(mark.dataset.commentId); });

// --- text selection -> floating "Comment" button --------------------------
let pendingSelection = null, selectionButtonEl = null;
function ensureSelectionButton() {
  if (selectionButtonEl) return selectionButtonEl;
  selectionButtonEl = document.createElement('button');
  selectionButtonEl.type = 'button'; selectionButtonEl.id = 'selection-comment-btn'; selectionButtonEl.className = 'selection-comment-btn'; selectionButtonEl.hidden = true;
  selectionButtonEl.addEventListener('mousedown', (e) => e.preventDefault());
  selectionButtonEl.addEventListener('click', () => { if (pendingSelection) openComposer({ side: pendingSelection.side, line: pendingSelection.line, quote: pendingSelection.quote, prefix: pendingSelection.prefix, general: false }); hideSelectionButton(); window.getSelection?.()?.removeAllRanges(); });
  document.body.appendChild(selectionButtonEl);
  return selectionButtonEl;
}
function hideSelectionButton() { if (selectionButtonEl) selectionButtonEl.hidden = true; pendingSelection = null; }
function closestLineText(node) { const el = node.nodeType === 3 ? node.parentElement : node; return el ? el.closest?.('.line-text') : null; }
function firstTextNode(node) { if (node.nodeType === 3) return node.textContent.length ? node : null; for (const child of node.childNodes) { const t = firstTextNode(child); if (t) return t; } return null; }
function lastTextNode(node) { if (node.nodeType === 3) return node.textContent.length ? node : null; for (let i = node.childNodes.length - 1; i >= 0; i--) { const t = lastTextNode(node.childNodes[i]); if (t) return t; } return null; }
function normalizeBoundary(node, offset) {
  if (node.nodeType === 3) return { node, offset };
  if (offset < node.childNodes.length) { const t = firstTextNode(node.childNodes[offset]); if (t) return { node: t, offset: 0 }; }
  const t = lastTextNode(node); return t ? { node: t, offset: t.textContent.length } : null;
}
function textOffsetWithin(root, node, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let total = 0, n;
  while ((n = walker.nextNode())) { if (n === node) return total + offset; total += n.textContent.length; }
  return total;
}
function deriveSide(cellEl) {
  if (state.mode === 'unified') { if (cellEl.classList.contains('added')) return 'right'; if (cellEl.classList.contains('deleted')) return 'left'; return 'right'; }
  const rowEl = cellEl.closest('.diff-row'); const cells = [...rowEl.querySelectorAll('.cell')]; return cells.indexOf(cellEl) === 0 ? 'left' : 'right';
}
function handleSelection() {
  if (state.readOnly) return hideSelectionButton();
  const sel = window.getSelection?.(); if (!sel || sel.isCollapsed || sel.rangeCount === 0) return hideSelectionButton();
  const range = sel.getRangeAt(0);
  if (!$('diff').contains(range.commonAncestorContainer)) return hideSelectionButton();
  const startLT = closestLineText(range.startContainer), endLT = closestLineText(range.endContainer);
  if (!startLT || !endLT) return hideSelectionButton();
  const cellEl = startLT.closest('.cell'); if (!cellEl) return hideSelectionButton();
  const lineNo = Number(cellEl.querySelector('.gutter')?.textContent.trim()); if (!lineNo) return hideSelectionButton();
  const side = deriveSide(cellEl);
  const plainText = startLT.textContent;
  const startB = normalizeBoundary(range.startContainer, range.startOffset); if (!startB) return hideSelectionButton();
  const startOffset = textOffsetWithin(startLT, startB.node, startB.offset);
  const multiLine = startLT !== endLT;
  let endOffset;
  if (multiLine) endOffset = plainText.length;
  else { const endB = normalizeBoundary(range.endContainer, range.endOffset); if (!endB) return hideSelectionButton(); endOffset = textOffsetWithin(startLT, endB.node, endB.offset); }
  const lo = Math.min(startOffset, endOffset), hi = Math.max(startOffset, endOffset);
  // A row may be a whole wrapped paragraph, so the offsets above are into the
  // block, not into a source line. The anchor stored on the server is a source
  // line and an offset within it, and it has to stay that way: that is what
  // survives the document being re-blocked after the next edit. Map back here,
  // and clip a selection that ran past the end of its line rather than storing
  // a quote no single line contains.
  const spans = (startLT.dataset.lines || '').split(';').filter(Boolean)
    .map((entry) => { const [no, offset, len] = entry.split(',').map(Number); return { no, offset, len }; });
  const span = spans.find((sp) => lo >= sp.offset && lo < sp.offset + sp.len)
    || spans[0] || { no: lineNo, offset: 0, len: plainText.length };
  const spanEnd = span.offset + span.len;
  const clipped = hi > spanEnd;
  const quote = plainText.slice(lo, Math.min(hi, spanEnd)).slice(0, 1000);
  if (!quote.trim()) return hideSelectionButton();
  const prefix = plainText.slice(Math.max(span.offset, lo - 32), lo);
  const partial = multiLine || clipped;
  pendingSelection = { side, line: span.no, quote, prefix, multiLine: partial };
  showSelectionButton(range, partial);
}
function showSelectionButton(range, multiLine) {
  const button = ensureSelectionButton();
  const rect = range.getBoundingClientRect();
  button.textContent = multiLine ? 'Comment on first line' : 'Comment';
  button.style.top = `${window.scrollY + rect.top - 34}px`;
  button.style.left = `${window.scrollX + rect.left}px`;
  button.hidden = false;
}
document.addEventListener('mouseup', (e) => { if (e.target.closest?.('#selection-comment-btn')) return; handleSelection(); });
document.addEventListener('selectionchange', () => { const sel = window.getSelection?.(); if (!sel || sel.isCollapsed) hideSelectionButton(); });
document.addEventListener('scroll', () => hideSelectionButton(), true);

// --- send to claude --------------------------------------------------
// One click sends. There is deliberately no confirm step: the previous two-step
// composer made a successful click look like nothing had happened, and the catch
// below used to swallow failures silently. Every outcome now writes to #send-status.
async function doSendToClaude() {
  if (sending || $('send-toggle').disabled) return;
  sending = true; setSendStatus('Sending...', 'pending'); renderSendButton();
  try {
    const response = await fetch(`${API}/submit`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `server returned ${response.status}`);
    sendError = null;
  } catch (error) {
    // Never fail quietly. A dead server is the most likely cause and the reviewer has
    // no other way to find out that the click did nothing.
    sendError = `Send failed: ${error.message}. Is the viewer server still running?`;
    sending = false; renderSendButton(); return;
  }
  sending = false;
  // The phase now says "submitted" on the server, and that is what locks the
  // button. No local timer, so a refresh or a second window agrees.
  await poll(true);
}
$('send-toggle').onclick = doSendToClaude;

// --- global keyboard shortcuts ---------------------------------------
document.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName;
  if ((event.key === 'c' || event.key === 'C') && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    toggleCommentsPanel();
  }
  if (event.key === 'Enter' && event.ctrlKey) {
    if (tag === 'TEXTAREA') return; // the textarea's own Enter binding applies instead
    if (!$('send-toggle').disabled) { event.preventDefault(); doSendToClaude(); }
  }
});

// One timer, one request, no push channel to lose. A render only happens when
// a stamp actually moves, so an idle page does nothing but a cheap localhost GET.
const POLL_MS = 2_000;
poll();
setInterval(() => poll(), POLL_MS);
