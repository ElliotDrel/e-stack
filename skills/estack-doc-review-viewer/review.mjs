#!/usr/bin/env node
// doc-review-viewer CLI -- the only interface Claude needs.
//
//   node review.mjs open <file.md>          start hosting a document, snapshot v1
//   node review.mjs watch --slug <slug>     the Monitor stream for one document
//   node review.mjs status  [--slug s]      phase, round, counts
//   node review.mjs pending [--slug s]      what Elliot said that you have not read
//   node review.mjs claim   [--slug s]      read it and take the round
//   node review.mjs reply <threadId> <text...>
//   node review.mjs resolve <threadId>   |  reopen <threadId>
//   node review.mjs comment --body <text>            leave a general note on the document
//   node review.mjs publish [--slug s]      hand the document back, snapshot a version
//   node review.mjs threads  [--slug s]     every thread with its messages
//   node review.mjs versions [--slug s]     the version history
//   node review.mjs ps                      the daemon and everything it hosts
//   node review.mjs close --slug <slug>     stop hosting one document
//   node review.mjs stop                    shut the daemon down now
//
// Slug resolution, when --slug is omitted: --doc <file> if given, else the only
// open document, else an error naming the choices.

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRegistry, readDaemon, clearDaemon, isAlive } from './registry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const command = argv[0];

function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return fallback;
}
function has(name) { return argv.includes(`--${name}`); }
function positionals() {
  const out = [];
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) { if (argv[i + 1] && !argv[i + 1].startsWith('--')) i++; continue; }
    out.push(token);
  }
  return out;
}
function usage() {
  console.log(`doc-review-viewer

  open <file.md> [--slug s] [--no-browser]   host a document, snapshot v1, print the watch command
  watch --slug <slug>                        run this through Monitor with persistent: true
  status | pending | claim | publish | threads | versions   [--slug s]
  reply <threadId> <text...>
  resolve <threadId> | reopen <threadId>
  comment --body <text>                      leave a general note on the document
  ps | stop | close --slug <slug>`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- daemon ---------------------------------------------------------------
async function daemonUrl({ probe = true } = {}) {
  const info = await readDaemon();
  if (!info || !info.url) return null;
  if (info.pid && !isAlive(info.pid)) { await clearDaemon(); return null; }
  if (!probe) return info.url;
  try {
    const response = await fetch(`${info.url}/api/index`, { signal: AbortSignal.timeout(2000) });
    if (response.ok) return info.url;
  } catch { /* stale file, fall through */ }
  await clearDaemon();
  return null;
}

async function ensureDaemon() {
  const existing = await daemonUrl();
  if (existing) return existing;
  // Fully detached: its stdout is nobody's business, and it must not die with
  // the shell that happened to start it. Lease expiry is what ends its life.
  const child = spawn(process.execPath, [resolve(here, 'daemon.mjs')], { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    const url = await daemonUrl();
    if (url) return url;
  }
  throw new Error('The daemon did not come up within 9 seconds. Run it in the foreground to see why: node daemon.mjs');
}

async function call(method, path, body, base) {
  const url = `${base || (await ensureDaemon())}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(`Cannot reach the viewer at ${url}: ${error.message}`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${method} ${path} returned ${response.status}`);
  return data;
}

// --- slug resolution ------------------------------------------------------
async function resolveSlug() {
  const explicit = flag('slug');
  if (explicit) return explicit;
  const registry = await readRegistry();
  const slugs = Object.entries(registry.slugs || {});
  const doc = flag('doc');
  if (doc) {
    const target = resolve(process.cwd(), doc);
    const found = slugs.find(([, entry]) => resolve(entry.document) === target);
    if (found) return found[0];
    throw new Error(`${target} is not open. Run: review.mjs open ${doc}`);
  }
  if (slugs.length === 1) return slugs[0][0];
  if (!slugs.length) throw new Error('Nothing is open. Run: review.mjs open <file.md>');
  throw new Error(`${slugs.length} documents are open (${slugs.map(([s]) => s).join(', ')}). Pass --slug <slug>.`);
}

// --- printing -------------------------------------------------------------
function printSummary(s, slug) {
  console.log(`slug       ${slug}`);
  console.log(`phase      ${s.phase}   round ${s.round}`);
  console.log(`threads    ${s.threads} total, ${s.openThreads} open, ${s.awaitingClaude.length} awaiting a reply from Claude`);
  console.log(`messages   seq ${s.lastSeenByClaude}/${s.highestSeq} seen, ${s.unseenMessages} unread`);
  console.log(`versions   ${s.versions}`);
}
function printThread(thread, unseenFrom = Infinity) {
  const where = thread.side === 'general' ? 'general' : `${thread.side} line ${thread.line}`;
  console.log(`\n[${thread.id}]  ${where}${thread.resolved ? '  (resolved)' : ''}`);
  if (thread.quote) console.log(`  > ${thread.quote.replace(/\n/g, ' ').slice(0, 160)}`);
  for (const m of thread.messages) {
    const mark = m.seq > unseenFrom ? '*' : ' ';
    console.log(`  ${mark} ${m.author.padEnd(6)} #${m.seq}  ${m.body.replace(/\n/g, '\n              ')}`);
  }
}

// Orphan reporting. The daemon computes which open comments no longer match any
// text in the document; printing it here is what turns "Elliot sees a yellow
// card" into "the agent knows it did that and can answer for it".
function printOrphans(orphaned, when) {
  if (!orphaned || !orphaned.length) return;
  console.log(`\n!! ${orphaned.length} comment(s) lost their anchor ${when}:`);
  for (const t of orphaned) {
    console.log(`   ${t.id}  quoted: ${JSON.stringify(t.quote.slice(0, 70))}`);
  }
  console.log('   The quoted text is no longer in the document. Reply in each thread saying what');
  console.log('   you changed, then resolve it, or Elliot is left with a flagged card and no answer.');
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try { const child = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }); child.on('error', () => {}); child.unref(); }
  catch { /* opening a browser is a convenience, never fatal */ }
}

// --- watch ----------------------------------------------------------------
// One line per hand-off, for one slug, printed by a process this session owns.
// That ownership is the whole point: Monitor only sees output from a process
// its own session launched, so a shared host cannot do this job.
async function watch(slug) {
  const base = await ensureDaemon();
  const watcherId = `${process.pid}-${slug}`;
  console.log(`WATCHING :: slug=${slug} url=${base}/s/${slug}/`);
  let signature = null;
  let down = false;
  let downSince = 0;
  for (;;) {
    try {
      const data = await call('POST', `/api/${encodeURIComponent(slug)}/watch`, { watcherId }, base);
      if (down) { console.log(`VIEWER BACK :: slug=${slug}`); down = false; }
      const next = `${data.phase}:${data.round}:${data.highestSeq}`;
      if (next !== signature) {
        signature = next;
        // Level-triggered: the first poll after a restart re-reports a pending
        // submission, so a watcher that was not running cannot miss a click.
        if (data.phase === 'submitted') {
          console.log(`REVIEW SUBMITTED :: slug=${slug} round=${data.round} unseen=${data.unseenMessages} awaiting=${data.awaitingClaude.length} open=${data.openThreads} doc=${data.document}`);
        }
      }
    } catch {
      // Edge-triggered, never repeated: a viewer that has been down for ten
      // minutes must not produce a hundred and twenty notifications.
      if (!down) { down = true; downSince = Date.now(); console.log(`VIEWER DOWN :: slug=${slug} is not reachable, the Send button will fail until it is restarted`); }
      if (Date.now() - downSince > 300_000) { console.log(`WATCH ENDED :: slug=${slug} unreachable for 5 minutes`); return; }
    }
    await sleep(3000);
  }
}

// --- commands -------------------------------------------------------------
try {
  const args = positionals();
  if (!command || command === '--help' || command === '-h' || command === 'help') { usage(); process.exit(command ? 0 : 1); }

  switch (command) {
    case 'open': {
      const file = args[0] || flag('doc');
      if (!file) throw new Error('usage: open <file.md>');
      const base = await ensureDaemon();
      const info = await call('POST', '/api/open', { document: resolve(process.cwd(), file), slug: flag('slug') }, base);
      const url = `${base}/s/${info.slug}/`;
      console.log(`slug       ${info.slug}`);
      console.log(`url        ${url}`);
      console.log(`document   ${info.document}`);
      console.log(`state      ${info.stateDir}`);
      console.log(`versions   ${info.versions} (v1 snapshotted before any edits)`);
      console.log(`\nArm the watcher through the Monitor tool with persistent: true:`);
      console.log(`  node "${resolve(here, 'review.mjs')}" watch --slug ${info.slug}`);
      if (!has('no-browser')) openBrowser(url);
      break;
    }
    case 'watch': {
      await watch(await resolveSlug());
      break;
    }
    case 'ps': {
      const url = await daemonUrl();
      if (!url) { console.log('No daemon running.'); break; }
      const data = await call('GET', '/api/index', null, url);
      console.log(`daemon     ${data.url}  pid ${data.pid}  ${data.watchers} watcher(s) attached`);
      if (!data.slugs.length) { console.log('Nothing open.'); break; }
      for (const entry of data.slugs) {
        console.log(`\n  ${entry.slug}  ${entry.summary.phase}  round ${entry.summary.round}  ${entry.summary.openThreads} open  ${entry.summary.versions} versions`);
        console.log(`    ${entry.document}`);
      }
      break;
    }
    case 'stop': {
      const url = await daemonUrl();
      if (!url) { console.log('No daemon running.'); break; }
      await call('POST', '/api/shutdown', {}, url);
      console.log('Daemon shutting down.');
      break;
    }
    case 'close': {
      const slug = await resolveSlug();
      await call('POST', '/api/close', { slug });
      console.log(`Closed ${slug}. Its review.json and versions are left on disk.`);
      break;
    }
    case 'status': {
      const slug = await resolveSlug();
      const state = await call('GET', `/api/${slug}/state`);
      printSummary(state.summary, slug);
      break;
    }
    case 'versions': {
      const slug = await resolveSlug();
      const data = await call('GET', `/api/${slug}/versions`);
      if (!data.versions.length) { console.log('No versions yet.'); break; }
      for (const v of data.versions) console.log(`v${v.n}  round ${v.round}  ${v.createdAt}  ${v.bytes} bytes  ${v.label}`);
      break;
    }
    case 'pending': {
      const slug = await resolveSlug();
      const data = await call('GET', `/api/${slug}/pending`);
      if (has('json')) { console.log(JSON.stringify(data, null, 2)); break; }
      printSummary(data.summary, slug);
      if (data.messages.length) {
        console.log(`\n${data.messages.length} unread message(s) across ${data.threads.length} thread(s):`);
        data.threads.forEach((t) => printThread(t, data.summary.lastSeenByClaude));
      } else console.log('\nNothing unread.');
      // Printed after the early "nothing unread" case too: a stranded comment
      // is outstanding work whether or not a new message came with it.
      printOrphans(data.orphaned, 'as the document stands');
      break;
    }
    case 'claim': {
      const slug = await resolveSlug();
      const data = await call('POST', `/api/${slug}/claim`, {});
      console.log(`Claimed round ${data.round} of "${slug}". Phase is now "editing".`);
      if (data.messages.length) {
        console.log(`${data.messages.length} message(s) across ${data.threads.length} thread(s):`);
        data.threads.forEach((t) => printThread(t));
      } else console.log('Nothing was unread.');
      printOrphans(data.orphaned, 'before you started');
      break;
    }
    case 'reply': {
      const slug = await resolveSlug();
      const [id, ...rest] = args;
      const text = rest.join(' ') || flag('body');
      if (!id || !text) throw new Error('usage: reply <threadId> <text...>');
      const message = await call('POST', `/api/${slug}/threads/${encodeURIComponent(id)}/messages`, { author: 'claude', body: text });
      console.log(`Replied to ${id} as message #${message.seq}.`);
      break;
    }
    case 'resolve':
    case 'reopen': {
      const slug = await resolveSlug();
      const [id] = args;
      if (!id) throw new Error(`usage: ${command} <threadId>`);
      await call('PATCH', `/api/${slug}/threads/${encodeURIComponent(id)}`, { resolved: command === 'resolve' });
      console.log(`Thread ${id} ${command === 'resolve' ? 'resolved' : 'reopened'}.`);
      break;
    }
    case 'comment': {
      const slug = await resolveSlug();
      const body = flag('body') || args.join(' ');
      if (!body) throw new Error('usage: comment --body <text>');
      const thread = await call('POST', `/api/${slug}/threads`, { author: 'claude', general: true, body });
      console.log(`Created thread ${thread.id}.`);
      break;
    }
    case 'publish': {
      const slug = await resolveSlug();
      const data = await call('POST', `/api/${slug}/publish`, {});
      if (data.unchanged) console.log(`Published "${slug}" as round ${data.round}. The document is byte-identical to v${data.versions}, so no new version was created.`);
      else console.log(`Published "${slug}" as v${data.version.n}. Phase is now "reviewing", round ${data.round}.`);
      printOrphans(data.orphaned, 'because of the edits you just published');
      break;
    }
    case 'threads': {
      const slug = await resolveSlug();
      const data = await call('GET', `/api/${slug}/threads`);
      if (has('json')) { console.log(JSON.stringify(data, null, 2)); break; }
      if (!data.threads.length) { console.log('No threads yet.'); break; }
      data.threads.forEach((t) => printThread(t));
      break;
    }
    default:
      throw new Error(`Unknown command "${command}". Run with --help for the list.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
