// Prose diff. Loaded as a plain script after dmp.js and before app.js, and
// concatenated in that order by selftest.mjs, so everything here shares one
// top-level scope with google/diff-match-patch.
//
// The engine underneath is diff-match-patch, not a hand-rolled Myers. Myers
// gives the shortest edit script, which is not the most readable one: on prose
// it salvages coincidental fragments -- a shared " the ", a stray vowel -- and
// scatters them through a rewritten sentence. Neil Fraser calls that chaff, and
// diff_cleanupSemantic is the pass that merges it back into human-sized edits.
// That pass is the whole reason for the dependency; writing it correctly is
// harder than writing the diff itself.
//
// What this file adds on top, because a document is not a flat string:
//
//   1. Blocks, not lines, are the unit. A wrapped paragraph is one block, so
//      reflowing it reads as the few words that changed rather than as every
//      line being replaced. Headings, list items and fenced code stay one block
//      each, because there the line really is the idea.
//   2. Blocks pair by similarity, not by position. Prose reflows: one sentence
//      becomes two, a bullet moves, a paragraph goes from the middle. Pairing
//      positionally after that word-diffs unrelated sentences against each
//      other and paints the whole run red and green.
//   3. Changes that only touch markdown syntax are called out as such. Turning
//      a bullet into a numbered item is not an edit to the prose and must not
//      compete for attention with one.

// --- the shared engine -----------------------------------------------------
// One instance, reused. Constructing it per call is not free and it holds no
// per-diff state that matters here.
let dvEngine = null;
function dvDmp() {
  if (!dvEngine) {
    dvEngine = new diff_match_patch();
    // The default is one second, after which diff_main returns whatever it has,
    // which for a long document is a bad diff rather than a slow one. These are
    // local files a person is reading, so buy the accuracy.
    dvEngine.Diff_Timeout = 5;
  }
  return dvEngine;
}

// diff-match-patch diffs strings of characters. To diff any other sequence --
// blocks, words -- map each distinct token to one character, diff those, and
// map back. This is the recipe from the library's own Line-or-Word-Diffs wiki
// page, generalised over the tokenizer.
const DV_MAX_TOKENS = 60000;   // under the surrogate range, so every token gets its own char
function dvTokensToChars(aTokens, bTokens) {
  const index = new Map();
  const array = [];
  const encode = (tokens) => {
    let out = '';
    for (const token of tokens) {
      let code = index.get(token);
      if (code === undefined) {
        if (array.length >= DV_MAX_TOKENS) return null;
        code = array.length;
        array.push(token);
        index.set(token, code);
      }
      out += String.fromCharCode(code);
    }
    return out;
  };
  const chars1 = encode(aTokens);
  const chars2 = chars1 === null ? null : encode(bTokens);
  if (chars1 === null || chars2 === null) return null;
  return { chars1, chars2, array };
}
// Returns [{op:-1|0|1, tokens:[...]}, ...] or null when the token count blew the
// budget, which the callers treat as "too big to diff honestly".
function dvTokenDiff(aTokens, bTokens, cleanup) {
  const mapped = dvTokensToChars(aTokens, bTokens);
  if (!mapped) return null;
  const dmp = dvDmp();
  const diffs = dmp.diff_main(mapped.chars1, mapped.chars2, false);
  if (cleanup) dmp.diff_cleanupSemantic(diffs);
  // A dmp Diff indexes like [op, text] but is not iterable, so read it by
  // index rather than destructuring it.
  return diffs.map((d) => ({ op: d[0], tokens: Array.from(d[1], (c) => mapped.array[c.charCodeAt(0)]) }));
}

// --- similarity ------------------------------------------------------------
// Dice coefficient over character bigrams of the case-folded, whitespace-
// collapsed text. Cheap, forgiving of a reordered clause, and strict enough
// that two unrelated sentences score near zero.
function dvBigrams(text) {
  const s = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const gram = s.slice(i, i + 2);
    out.set(gram, (out.get(gram) || 0) + 1);
  }
  return out;
}
function dvSimilarity(left, right) {
  if (left === right) return 1;
  const a = dvBigrams(left), b = dvBigrams(right);
  // Under two characters there are no bigrams to compare, so fall back to
  // equality rather than reporting a confident zero.
  if (!a.size || !b.size) return left.trim() === right.trim() ? 1 : 0;
  let shared = 0, total = 0;
  a.forEach((count, gram) => { total += count; shared += Math.min(count, b.get(gram) || 0); });
  b.forEach((count) => { total += count; });
  return (2 * shared) / total;
}

// --- markdown normalisation ------------------------------------------------
// What survives is the prose a reader would say out loud. Two blocks whose
// normalised forms match differ only in markup.
function dvNormalizeProse(line) {
  return line
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function dvFormattingOnly(left, right) {
  return left !== right && dvNormalizeProse(left) === dvNormalizeProse(right);
}

// --- blocks ----------------------------------------------------------------
// A block is one unit of meaning and one row in the viewer. Every block records
// which source lines it came from and where each of those lines starts inside
// its text, because comments anchor to source line numbers and character
// offsets and have to survive the regrouping.
//
// Only runs of plain prose merge. A line carrying any markdown structure --
// bullet, number, heading, quote, table pipe, fence, rule -- is its own block,
// because there the line genuinely is the idea, and merging two bullets into
// one row would be worse than not merging at all.
function dvLines(text) { return text ? text.replace(/\r\n?/g, '\n').split('\n') : []; }

function dvIsStructural(line) {
  return line.trim() === ''
    || /^\s*([-*+]|\d+[.)])\s/.test(line)
    || /^\s*#{1,6}\s/.test(line)
    || /^\s*>/.test(line)
    || /^\s*(\|| {4}|\t)/.test(line)
    || /^\s*([-*_]\s*){3,}$/.test(line);
}

function dvBlocks(text) {
  const lines = dvLines(text);
  const blocks = [];
  // A fenced code block is verbatim: its blank lines and indentation carry
  // meaning, so nothing inside it merges.
  let fenced = false;
  let run = null;
  const flush = () => { if (run) { blocks.push(run); run = null; } };
  const single = (line, no) => blocks.push({ text: line, no, shape: dvBlockShape(line), lines: [{ no, offset: 0, text: line }] });
  lines.forEach((line, index) => {
    const no = index + 1;
    if (/^\s*(```|~~~)/.test(line)) { flush(); fenced = !fenced; single(line, no); return; }
    if (fenced || dvIsStructural(line)) { flush(); single(line, no); return; }
    // Plain prose: continue the paragraph, joined by the single space a reader
    // sees rather than the newline the file holds.
    if (!run) run = { text: line, no, shape: { kind: '', depth: 0 }, lines: [{ no, offset: 0, text: line }] };
    else { run.lines.push({ no, offset: run.text.length + 1, text: line }); run.text += ` ${line}`; }
  });
  flush();
  return blocks;
}

// What shape of markdown this block is, so the renderer can give it the size
// and indentation a reader expects. The text is untouched -- this is a label,
// not a transform -- which keeps every character offset intact.
// Returns { kind, depth }.
function dvBlockShape(text) {
  const heading = text.match(/^\s*(#{1,6})\s/);
  if (heading) return { kind: `h${Math.min(heading[1].length, 4)}`, depth: 0 };
  if (/^\s*([-*_]\s*){3,}$/.test(text)) return { kind: 'rule', depth: 0 };
  if (/^\s*>/.test(text)) return { kind: 'quote', depth: 0 };
  const bullet = text.match(/^(\s*)([-*+]|\d+[.)])\s/);
  // Two spaces per level is the common convention and the one a tab lands on.
  if (bullet) return { kind: 'li', depth: Math.min(Math.floor(bullet[1].replace(/\t/g, '  ').length / 2), 4) };
  if (/^\s*(```|~~~)/.test(text) || /^\s*(\| {4}|\t)/.test(text)) return { kind: 'code', depth: 0 };
  return { kind: '', depth: 0 };
}

// --- word and character diff ----------------------------------------------
// Tokens are runs of letters and digits, single punctuation marks, or runs of
// whitespace. Splitting whitespace out as its own token means an added comma
// does not drag the words on either side of it into the change.
function dvTokenize(text) { return text.match(/\s+|[^\s\p{L}\p{N}]|[\p{L}\p{N}]+/gu) || []; }

const DV_REFINE_MIN_SIMILARITY = 0.5;   // below this the two sides are a rewrite, not an edit
const DV_REFINE_MAX_CHARS = 2000;       // guard on the character pass

// A chunk is one contiguous run of changed text on each side. Refining it per
// character only informs when the two runs are recognisably the same text.
// Otherwise every shared vowel lights up and the eye gets nothing.
function dvRefineChunk(oldText, freshText) {
  // No refinement means no underline. `hot` is the "look at these characters
  // specifically" signal; painting it across a whole rewritten phrase says
  // nothing the tint has not already said, and two overlapping emphases on the
  // same run is what made the old diff hard to scan.
  const plain = (text) => (text ? [{ text, changed: true, hot: false }] : []);
  if (!oldText || !freshText) return { old: plain(oldText), fresh: plain(freshText) };
  if (oldText.length > DV_REFINE_MAX_CHARS || freshText.length > DV_REFINE_MAX_CHARS) {
    return { old: plain(oldText), fresh: plain(freshText) };
  }
  if (dvSimilarity(oldText, freshText) < DV_REFINE_MIN_SIMILARITY) {
    return { old: plain(oldText), fresh: plain(freshText) };
  }
  const dmp = dvDmp();
  const diffs = dmp.diff_main(oldText, freshText);
  dmp.diff_cleanupSemantic(diffs);
  const out = { old: [], fresh: [] };
  const push = (list, text, hot) => {
    const last = list[list.length - 1];
    if (last && last.hot === hot) last.text += text;
    else list.push({ text, changed: true, hot });
  };
  for (const d of diffs) {
    const op = d[0], text = d[1];
    if (op === 0) { push(out.old, text, false); push(out.fresh, text, false); }
    else if (op === -1) push(out.old, text, true);
    else push(out.fresh, text, true);
  }
  return out;
}

// Diff two blocks into flat part lists that concatenate back to the originals.
// A part is {text, changed, hot}: `changed` tints the run, `hot` marks the
// characters inside it that actually moved.
function dvWordDiff(oldText, freshText) {
  const diffs = dvTokenDiff(dvTokenize(oldText), dvTokenize(freshText), true);
  if (!diffs) return { old: [{ text: oldText, changed: true, hot: false }], fresh: [{ text: freshText, changed: true, hot: false }] };
  const out = { old: [], fresh: [] };
  const keep = (list, text) => {
    const last = list[list.length - 1];
    if (last && !last.changed) last.text += text;
    else list.push({ text, changed: false, hot: false });
  };
  // Changed runs are buffered until the next equal run so the whole run is
  // refined at once. Refining piece by piece would never see that "recieve"
  // and "receive" are the same word.
  let pendingOld = '', pendingFresh = '';
  const flush = () => {
    if (!pendingOld && !pendingFresh) return;
    const refined = dvRefineChunk(pendingOld, pendingFresh);
    out.old.push(...refined.old);
    out.fresh.push(...refined.fresh);
    pendingOld = ''; pendingFresh = '';
  };
  for (const piece of diffs) {
    const text = piece.tokens.join('');
    if (piece.op === 0) { flush(); keep(out.old, text); keep(out.fresh, text); }
    else if (piece.op === -1) pendingOld += text;
    else pendingFresh += text;
  }
  flush();
  return out;
}

// --- block pairing ---------------------------------------------------------
// Order-preserving alignment that maximises total similarity. Pairs below the
// threshold are refused, so a deleted paragraph and an unrelated new one stay
// separate rows instead of being word-diffed into mush.
const DV_PAIR_MIN_SIMILARITY = 0.35;

function dvAlign(deletes, inserts) {
  const n = deletes.length, m = inserts.length;
  if (!n) return inserts.map((ins) => ({ del: null, ins }));
  if (!m) return deletes.map((del) => ({ del, ins: null }));
  const sim = [];
  for (let i = 0; i < n; i++) {
    sim.push(new Float64Array(m));
    for (let j = 0; j < m; j++) sim[i][j] = dvSimilarity(deletes[i].left, inserts[j].right);
  }
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim[i - 1][j - 1];
      const paired = s >= DV_PAIR_MIN_SIMILARITY ? score[i - 1][j - 1] + s : -Infinity;
      score[i][j] = Math.max(score[i - 1][j], score[i][j - 1], paired);
    }
  }
  // Scores are sums of non-negative similarities, so they are never negative
  // and a refused pair (-Infinity) can never tie with the cell it sits in.
  const rows = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const s = sim[i - 1][j - 1];
    const paired = s >= DV_PAIR_MIN_SIMILARITY ? score[i - 1][j - 1] + s : -Infinity;
    if (paired === score[i][j]) { rows.push({ del: deletes[i - 1], ins: inserts[j - 1] }); i--; j--; }
    else if (score[i - 1][j] >= score[i][j - 1]) rows.push({ del: deletes[--i], ins: null });
    else rows.push({ del: null, ins: inserts[--j] });
  }
  while (i > 0) rows.push({ del: deletes[--i], ins: null });
  while (j > 0) rows.push({ del: null, ins: inserts[--j] });
  return rows.reverse();
}

// --- the whole document ----------------------------------------------------
// Ops keep the shape the renderer consumes: `left`/`right` are block text,
// `leftNo`/`rightNo` the block's first source line, and `leftBlock`/`rightBlock`
// the block itself so the renderer can rebase comment marks onto it. A replace
// op carries `rows`, the paired and word-diffed alignment; a row that only
// changed markup carries `formatting`.
function dvDiffDocument(leftText, rightText) {
  const a = dvBlocks(leftText), b = dvBlocks(rightText);
  const diffs = dvTokenDiff(a.map((x) => x.text), b.map((x) => x.text), false);
  // Past sixty thousand distinct blocks there is no honest diff to draw.
  if (!diffs) return [{ type: 'overflow' }];
  const ops = [];
  let ai = 0, bi = 0;
  for (const piece of diffs) {
    for (let n = 0; n < piece.tokens.length; n++) {
      if (piece.op === 0) { ops.push({ type: 'equal', left: a[ai].text, right: b[bi].text, leftNo: a[ai].no, rightNo: b[bi].no, leftBlock: a[ai], rightBlock: b[bi] }); ai++; bi++; }
      else if (piece.op === -1) { ops.push({ type: 'delete', left: a[ai].text, leftNo: a[ai].no, leftBlock: a[ai] }); ai++; }
      else { ops.push({ type: 'insert', right: b[bi].text, rightNo: b[bi].no, rightBlock: b[bi] }); bi++; }
    }
  }
  const grouped = [];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].type !== 'equal' && ops[k + 1] && ops[k + 1].type !== 'equal') {
      const del = [], ins = [];
      while (ops[k] && ops[k].type !== 'equal') { (ops[k].type === 'delete' ? del : ins).push(ops[k]); k++; }
      k--;
      // A run that is all deletes or all inserts has nothing to pair against.
      if (!del.length || !ins.length) { grouped.push(...del, ...ins); continue; }
      grouped.push(dvBuildReplace(del, ins));
    } else grouped.push(ops[k]);
  }
  return grouped;
}

function dvBuildReplace(deletes, inserts) {
  const rows = dvAlign(deletes, inserts).map((pair) => {
    if (!pair.del || !pair.ins) return { del: pair.del, ins: pair.ins, oldParts: null, freshParts: null, formatting: false };
    const parts = dvWordDiff(pair.del.left, pair.ins.right);
    return { del: pair.del, ins: pair.ins, oldParts: parts.old, freshParts: parts.fresh, formatting: dvFormattingOnly(pair.del.left, pair.ins.right) };
  });
  return { type: 'replace', deletes, inserts, rows, formatting: rows.length > 0 && rows.every((r) => r.formatting) };
}

// Counts for the summary line. Formatting-only rows are counted apart so a pass
// that reflowed the markdown does not read as a pass that rewrote it.
function dvStats(ops) {
  let added = 0, deleted = 0, formatting = 0;
  for (const op of ops) {
    if (op.type === 'insert') added++;
    else if (op.type === 'delete') deleted++;
    else if (op.type === 'replace') {
      for (const pair of op.rows) {
        if (pair.formatting) { formatting++; continue; }
        if (pair.del) deleted++;
        if (pair.ins) added++;
      }
    }
  }
  return { added, deleted, formatting, changed: added + deleted };
}

// --- inline markdown -------------------------------------------------------
// The viewer shows markdown source, not rendered HTML, and that is deliberate.
// A comment anchors to a character offset in the source, and a diff of prose
// has to be able to say "this became bold", which rendered output cannot show:
// render both sides and an added pair of asterisks becomes an invisible change.
// So the source stays and the markup is styled in place. The prose reads like
// prose, the syntax recedes, and the syntax is still there to be diffed.
//
// Every range is an offset into the same string the diff parts and the comment
// anchors use, so this composes with both instead of fighting them.
//
// Returns [{start, end, cls}], possibly overlapping only where a style sits
// inside a link label.
function dvMarkdownRanges(text) {
  const ranges = [];
  const push = (start, end, cls) => { if (end > start) ranges.push({ start, end, cls }); };
  // Leading structure: bullet, number, heading hashes, quote marker.
  const lead = text.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+|#{1,6}\s+|>\s?)/);
  if (lead) push(0, lead[0].length, 'md-lead');
  const taken = [];
  const claimed = (start, end) => taken.some((s) => start < s.end && end > s.start);
  const scan = (re, handler) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      if (claimed(m.index, m.index + m[0].length)) continue;
      handler(m);
      taken.push({ start: m.index, end: m.index + m[0].length });
    }
  };
  // Code first: whatever is inside it is literal, not markup.
  scan(/`+[^`]+`+/g, (m) => push(m.index, m.index + m[0].length, 'md-code'));
  // A link keeps its label readable and pushes the target out of the way.
  scan(/(!?)\[([^\]]*)\]\(([^)\s]*)\)/g, (m) => {
    const start = m.index, open = m[1].length + 1, closeAt = start + open + m[2].length;
    push(start, start + open, 'md-syntax');   // the leading [ , or ![
    push(closeAt, closeAt + 1, 'md-syntax');  // the closing ]
    push(closeAt + 1, start + m[0].length, 'md-url');
  });
  scan(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, (m) => {
    const start = m.index, len = m[1].length;
    push(start, start + len, 'md-syntax');
    push(start + len, start + m[0].length - len, 'md-strong');
    push(start + m[0].length - len, start + m[0].length, 'md-syntax');
  });
  scan(/(\*|_)(?=\S)([^*_]*?\S)\1/g, (m) => {
    const start = m.index;
    push(start, start + 1, 'md-syntax');
    push(start + 1, start + m[0].length - 1, 'md-em');
    push(start + m[0].length - 1, start + m[0].length, 'md-syntax');
  });
  scan(/~~(?=\S)([\s\S]*?\S)~~/g, (m) => {
    const start = m.index;
    push(start, start + 2, 'md-syntax');
    push(start + 2, start + m[0].length - 2, 'md-strike');
    push(start + m[0].length - 2, start + m[0].length, 'md-syntax');
  });
  // A bare URL is unreadable and never the point of the sentence.
  scan(/https?:\/\/\S+/g, (m) => push(m.index, m.index + m[0].length, 'md-url'));
  return ranges;
}
