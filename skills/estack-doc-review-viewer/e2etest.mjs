// doc-review-viewer end-to-end test.
//
//   node e2etest.mjs
//
// Runs against a real daemon and a real document. It covers what selftest.mjs
// structurally cannot: that a poll of /diff carries the review state with it,
// that the working file is frozen while the agent holds the round, that a
// rewritten quote is reported back to the agent as an orphaned comment, that
// state never lands beside the document, and that a daemon nobody is watching
// exits on its own.
//
// It opens and closes its own slug and stops the daemon afterwards. Do not run
// it while a review you care about is open on port 4173.
import { writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir, homedir } from 'node:os';

const SKILL = dirname(fileURLToPath(import.meta.url));
const dir = resolve(tmpdir(), 'doc-review-e2e');
const doc = resolve(dir, 'brief.md');
const BASE = 'http://127.0.0.1:4173';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected;
  if (!ok) { failures++; console.log(`  FAIL ${label}\n       got: ${JSON.stringify(actual)}`); }
  else console.log(`  ok   ${label} -> ${JSON.stringify(actual)}`);
};
const run = (...args) => new Promise((res) => {
  const p = spawn(process.execPath, [`${SKILL}/review.mjs`, ...args], { cwd: dir });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', () => res(out));
});
const api = async (path, method = 'GET', body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return r.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// State lives under ~/.claude/doc-review now, so it outlives the working
// directory and a previous run would otherwise hand this one its versions.
const stateHome = resolve(homedir(), '.claude', 'doc-review', 'docs', 'brief');
await rm(dir, { recursive: true, force: true });
await rm(stateHome, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
await writeFile(doc, '# Brief\n\n## Scope\n- Ship the redesign in Q3.\n- Keep the old export path.\n', 'utf8');

try {
  console.log('open');
  console.log((await run('open', 'brief.md', '--no-browser')).split('\n').slice(0, 2).join('\n'));

  // --- one endpoint carries the whole tick --------------------------------
  console.log('\n1. a poll of /diff carries the review state with it');
  const first = await api('/api/brief/diff');
  check('the diff carries the phase', first.phase, 'reviewing');
  check('and the threads', Array.isArray(first.threads), true);
  check('and the summary the send button reads', Array.isArray(first.summary.awaitingClaude), true);
  check('no thread is awaiting a reply yet', first.summary.awaitingClaude.length, 0);

  const thread = await api('/api/brief/threads', 'POST', { side: 'right', line: 4, quote: 'Ship the redesign in Q3.', prefix: '- ', body: 'Why Q3 and not Q2?' });
  const withComment = await api('/api/brief/diff');
  check('a new comment shows up in the next poll', withComment.threads.length, 1);
  check('and the send button would enable', withComment.summary.awaitingClaude.length, 1);

  await api('/api/brief/submit', 'POST');
  check('submitting flips the phase', (await api('/api/brief/diff')).phase, 'submitted');

  // --- nothing this skill makes lands beside the document -----------------
  console.log('\n2. state lives outside the working directory');
  check('the working directory holds only the document', (await readdir(dir)).join(','), 'brief.md');
  check('state lives under ~/.claude/doc-review', existsSync(resolve(homedir(), '.claude', 'doc-review', 'docs', 'brief', 'review.json')), true);

  // --- freezing the working file -----------------------------------------
  console.log('\n3. the working file is frozen while the round is claimed');
  const claimed = await api('/api/brief/claim', 'POST', {});
  check('claim reports the message', claimed.messages.length, 1);
  check('nothing is orphaned yet', claimed.orphaned.length, 0);

  // Simulate a mid-write file: truncated, exactly what a reader would catch.
  await writeFile(doc, '# Brie', 'utf8');
  const midWrite = await api('/api/brief/diff?left=1&right=current');
  check('the diff refuses to serve the half-written file', midWrite.frozen, true);
  check('it serves the last snapshot instead', midWrite.right.text.includes('Keep the old export path'), true);

  // --- orphan reporting ---------------------------------------------------
  console.log('\n4. an edit that strands a comment is reported to the agent');
  await writeFile(doc, '# Brief\n\n## Scope\n- Ship the redesign in Q2.\n- Keep the old export path.\n', 'utf8');
  const published = await api('/api/brief/publish', 'POST', {});
  check('publishing mints v2', published.version.n, 2);
  check('the rewritten quote is reported orphaned', published.orphaned.length, 1);
  check('and it names the thread', published.orphaned[0].id, thread.id);

  const cli = await run('publish', '--slug', 'brief');
  check('a second publish changes nothing', cli.includes('byte-identical'), true);
  const pendingOut = await run('pending', '--slug', 'brief');
  check('the CLI warns about the lost anchor', pendingOut.includes('lost their anchor'), true);
  check('and tells the agent what to do', pendingOut.includes('resolve it'), true);

  // Once the agent answers and resolves, it stops being reported.
  await api(`/api/brief/threads/${thread.id}/messages`, 'POST', { author: 'claude', body: 'Moved it to Q2 as asked; the line you quoted was rewritten.' });
  await api(`/api/brief/threads/${thread.id}`, 'PATCH', { resolved: true });
  const after = await api('/api/brief/pending');
  check('a resolved thread is no longer reported orphaned', after.orphaned.length, 0);

  // --- an outside edit reaches the next poll ------------------------------
  console.log('\n5. an edit made outside the viewer reaches the next poll');
  await writeFile(doc, '# Brief\n\n## Scope\n- Ship the redesign in Q2.\n- Keep the old export path, for now.\n', 'utf8');
  const edited = await api('/api/brief/diff');
  check('the poll sees the outside edit', edited.right.text.includes('for now'), true);

  await run('close', '--slug', 'brief');
} finally {
  await run('stop');
  await rm(dir, { recursive: true, force: true });
  await rm(stateHome, { recursive: true, force: true });
}

// --- the daemon exits on its own -----------------------------------------
// The guarantee that no stray process is ever left behind, and the one
// load-bearing property no test touched. The three timing constants are
// env-overridable exactly so this can run in seconds instead of two minutes.
console.log('\n6. a daemon nobody is watching exits on its own');
{
  const child = spawn(process.execPath, [`${SKILL}/daemon.mjs`], {
    detached: true, stdio: 'ignore',
    env: { ...process.env, DOC_REVIEW_LEASE_TTL_MS: '400', DOC_REVIEW_GRACE_MS: '800', DOC_REVIEW_REAP_MS: '200' },
  });
  child.unref();
  await sleep(700);
  let up = false;
  try { up = (await fetch(`${BASE}/api/index`)).ok; } catch { up = false; }
  check('it came up', up, true);

  // No watcher ever heartbeats, so the grace period runs out and takes it.
  await sleep(2_000);
  let down = false;
  try { await fetch(`${BASE}/api/index`); } catch { down = true; }
  check('and it exited with no watcher attached', down, true);
  if (!down) await run('stop');
}

console.log(failures === 0 ? '\nOK: end-to-end passed.' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
