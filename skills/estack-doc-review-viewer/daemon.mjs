#!/usr/bin/env node
// estack-doc-review-viewer daemon -- hosts every open document on one port.
//
// Started by `review.mjs open`, never by hand. Its stdout goes nowhere on
// purpose: waking an agent is the watcher's job, not the host's, because the
// Monitor tool only sees output from a process its own session launched. One
// shared host plus one watcher per session per slug is what lets two sessions
// review two documents at once without either hearing the other's traffic.
//
// Lifetime is a lease refcount. Every watcher heartbeats on each poll; when no
// lease has been live for longer than the grace period the daemon exits and
// removes daemon.json. A daemon nobody ever attaches to exits on its own, so a
// crashed or forgotten session cannot leave a stray process behind.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, StoreError, summarize, unseenMessages } from './store.mjs';
import { snapshot, resolveSide, defaultSelection, readDocument, workingBase } from './versions.mjs';
import { readRegistry, writeRegistry, writeDaemon, clearDaemon, allocateSlug, stateDirFor, DEFAULT_PORT } from './registry.mjs';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const requestedPort = Number(argOf('port', DEFAULT_PORT));

// Two missed heartbeats kills a lease. Two minutes with no lease at all kills
// the daemon; that window also covers the gap between `open` spawning it and
// the session getting its watcher armed.
// Overridable so the self-test can exercise the exit path in seconds instead of
// minutes. Nothing in normal operation sets these.
const LEASE_TTL_MS = Number(process.env.DOC_REVIEW_LEASE_TTL_MS || 20_000);
const GRACE_MS = Number(process.env.DOC_REVIEW_GRACE_MS || 120_000);
const REAP_MS = Number(process.env.DOC_REVIEW_REAP_MS || 5_000);
const leases = new Map();
let lastAttachedAt = Date.now();

const docs = new Map(); // slug -> { slug, document, stateDir, store }

// The viewer polls. It used to be pushed to over an EventSource, with an
// fs.watch on the document feeding it and a slow poll behind both as a
// backstop -- three mechanisms answering one question. Each had its own way of
// going quiet: fs.watch goes deaf when an editor saves by renaming over the
// file, an EventSource can be cut by a sleeping laptop without firing onerror,
// and neither survived a proxy without a heartbeat. The backstop had to exist
// regardless, so it is now the whole mechanism. One GET every couple of seconds
// on 127.0.0.1 costs nothing and has no silent failure mode.

function json(response, value, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}
function html(response, body, status = 200) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(body);
}
function esc(text) { return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function readJsonBody(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) { rejectPromise(new Error('Body too large')); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) { resolvePromise({}); return; }
      try { resolvePromise(JSON.parse(text)); } catch (error) { rejectPromise(error); }
    });
    request.on('error', rejectPromise);
  });
}

// --- documents ------------------------------------------------------------
function attach(slug, entry) {
  const record = {
    slug, document: entry.document, stateDir: entry.stateDir,
    store: createStore(entry.stateDir, dirname(entry.document)),
  };
  docs.set(slug, record);
  return record;
}
async function loadRegistry() {
  const registry = await readRegistry();
  for (const [slug, entry] of Object.entries(registry.slugs || {})) attach(slug, entry);
  return registry;
}

// v1 is taken the moment a document is opened, before the agent touches it, so
// the original text is always recoverable even if the first pass rewrites
// everything.
async function ensureInitialVersion(record) {
  const { state } = await record.store.ensurePersisted();
  if (state.versions.length) return state;
  const entry = await snapshot(record.stateDir, record.document, state.versions, { round: state.round, label: 'initial' });
  if (!entry) return state;
  const written = await record.store.addVersion(entry);
  return written.state;
}

async function openDocument(docPath, requestedSlug) {
  const target = resolve(docPath);
  const registry = await readRegistry();
  const slug = allocateSlug(registry, target, requestedSlug);
  const stateDir = stateDirFor(target, slug);
  registry.slugs = registry.slugs || {};
  registry.slugs[slug] = { document: target, stateDir };
  await writeRegistry(registry);
  const record = docs.get(slug) || attach(slug, registry.slugs[slug]);
  record.document = target; record.stateDir = stateDir;
  const state = await ensureInitialVersion(record);
  return { slug, document: target, stateDir, versions: state.versions.length, summary: summarize(state) };
}

async function closeDocument(slug) {
  const registry = await readRegistry();
  if (registry.slugs) delete registry.slugs[slug];
  await writeRegistry(registry);
  docs.delete(slug);
  return { ok: true, slug };
}

// --- lifetime -------------------------------------------------------------
let server = null;
let shuttingDown = false;
async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  await clearDaemon().catch(() => {});
  if (server) server.close();
  // A short delay lets an in-flight response finish before the process goes.
  setTimeout(() => process.exit(0), 50).unref();
  if (process.env.DOC_REVIEW_VERBOSE) console.error(`daemon exiting: ${reason}`);
}
setInterval(() => {
  const now = Date.now();
  for (const [id, lastSeen] of leases) if (now - lastSeen > LEASE_TTL_MS) leases.delete(id);
  if (leases.size) lastAttachedAt = now;
  else if (now - lastAttachedAt > GRACE_MS) void shutdown('no watcher attached');
}, REAP_MS).unref();
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// --- index page -----------------------------------------------------------
// `open` sends the reviewer straight to /s/<slug>/, so this page exists for the rare
// moment he lands on the root with several documents open. A list of links is
// the whole job; it does not need a stylesheet of its own to keep in sync.
async function indexPage() {
  const items = [];
  for (const record of docs.values()) {
    const s = summarize(await record.store.read());
    items.push(`<li><a href="/s/${esc(record.slug)}/">${esc(record.slug)}</a> &mdash; ${esc(s.phase)}, round ${s.round}, ${s.openThreads} open thread${s.openThreads === 1 ? '' : 's'}<br><small>${esc(record.document)}</small></li>`);
  }
  return `<!doctype html><meta charset="utf-8"><title>Document reviews</title>
<body style="font:14px/1.6 ui-sans-serif,system-ui,sans-serif;margin:2rem">
<h1>Document reviews</h1>
${items.length ? `<ul>${items.join('')}</ul>` : '<p>Nothing open. Run <code>review.mjs open &lt;file.md&gt;</code>.</p>'}
`;
}

function staticFile(pathname, response) {
  const target = resolve(publicDir, normalize(pathname.replace(/^\/+/, '')));
  if (target !== publicDir && !target.startsWith(publicDir + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
  readFile(target)
    .then((body) => { response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(body); })
    .catch(() => { response.writeHead(404); response.end('Not found'); });
}

// --- per-document API -----------------------------------------------------
const RESERVED = new Set(['index', 'open', 'close', 'shutdown']);

// A comment anchors to the text it quotes. Rewrite that text and the comment
// has nothing to point at. The client already flags these for the reviewer; this is
// the same fact computed for the agent, so it learns its edit orphaned a
// comment instead of leaving a card on screen with no explanation.
async function orphanedThreads(record) {
  const [state, doc] = await Promise.all([record.store.read(), readDocument(record.document)]);
  if (!doc.exists) return [];
  return state.threads.filter((t) => !t.resolved && t.side !== 'general' && t.quote && !doc.text.includes(t.quote));
}

async function documentRoute(request, response, record, rest, query) {
  const { store, document: docPath, stateDir } = record;
  const method = request.method;

  // Lease plus poll in one request. The response is a signature the watcher
  // compares against what it last printed; there is no event log to fall
  // behind, because the current state IS the message.
  if (rest === 'watch' && method === 'POST') {
    const body = await readJsonBody(request);
    if (body.watcherId) leases.set(body.watcherId, Date.now());
    const state = await store.read();
    const s = summarize(state);
    json(response, { slug: record.slug, document: docPath, stateDir, ...s });
    return true;
  }

  if (rest === 'state' && method === 'GET') {
    const state = await store.read();
    json(response, { ...state, slug: record.slug, document: docPath, summary: summarize(state) });
    return true;
  }
  if (rest === 'versions' && method === 'GET') {
    const state = await store.read();
    json(response, { versions: state.versions, selection: defaultSelection(state.versions) });
    return true;
  }
  if (rest === 'pending' && method === 'GET') {
    const state = await store.read();
    const messages = unseenMessages(state);
    const ids = [...new Set(messages.map((m) => m.threadId))];
    json(response, { summary: summarize(state), messages, threads: ids.map((id) => state.threads.find((t) => t.id === id)), orphaned: await orphanedThreads(record) });
    return true;
  }
  if (rest === 'diff' && method === 'GET') {
    const state = await store.read();
    const fallback = defaultSelection(state.versions);
    const leftSel = query.get('left') || fallback.left;
    const rightSel = query.get('right') || fallback.right;
    // While the agent holds the round, the working file is mid-edit: a Write is
    // not atomic to a reader, so `current` can be a truncated document or a
    // half-applied rewrite. Serve the last published snapshot instead and say
    // so. The page also curtains itself during `editing`, but a viewer opened
    // fresh in that window would otherwise render the tear.
    const frozen = state.phase === 'editing' && state.versions.length > 0;
    const settle = (sel) => (frozen && sel === 'current' ? String(state.versions[state.versions.length - 1].n) : sel);
    const [left, right, working] = await Promise.all([
      resolveSide(stateDir, docPath, state.versions, settle(leftSel)),
      resolveSide(stateDir, docPath, state.versions, settle(rightSel)),
      workingBase(docPath, state.versions),
    ]);
    json(response, {
      slug: record.slug, title: basename(docPath), document: docPath,
      left, right, selection: { left: leftSel, right: rightSel },
      versions: state.versions, identical: left.text === right.text,
      // Which snapshot the file on disk sits on, so the picker can say
      // "v2 * working copy" instead of an unmoored "working file".
      working,
      // Commenting is only allowed against the working file. Historical views
      // are read-only, which removes a whole class of "which version is this
      // comment even on" confusion.
      readOnly: rightSel !== 'current',
      frozen,
      // Threads ride along with the diff so a client tick is one request. Two
      // endpoints meant two responses describing two different moments.
      phase: state.phase, round: state.round, updatedAt: state.updatedAt,
      threads: state.threads, summary: summarize(state),
    });
    return true;
  }

  if (rest === 'threads' && method === 'GET') { json(response, { threads: (await store.read()).threads }); return true; }
  if (rest === 'threads' && method === 'POST') { const { result } = await store.createThread(await readJsonBody(request)); json(response, result, 201); return true; }

  const threadMatch = rest.match(/^threads\/([^/]+)$/);
  if (threadMatch) {
    const id = decodeURIComponent(threadMatch[1]);
    if (method === 'PATCH') { const { result } = await store.patchThread(id, await readJsonBody(request)); json(response, result); return true; }
    if (method === 'DELETE') { const { result } = await store.deleteThread(id); json(response, result); return true; }
  }
  const messagesMatch = rest.match(/^threads\/([^/]+)\/messages$/);
  if (messagesMatch && method === 'POST') {
    const { result } = await store.addMessage(decodeURIComponent(messagesMatch[1]), await readJsonBody(request));
    json(response, result, 201); return true;
  }
  const messageMatch = rest.match(/^threads\/([^/]+)\/messages\/([^/]+)$/);
  if (messageMatch) {
    const id = decodeURIComponent(messageMatch[1]), messageId = decodeURIComponent(messageMatch[2]);
    if (method === 'PATCH') { const { result } = await store.patchMessage(id, messageId, await readJsonBody(request)); json(response, result); return true; }
    if (method === 'DELETE') { const { result } = await store.deleteMessage(id, messageId); json(response, result); return true; }
  }

  if (rest === 'submit' && method === 'POST') { const { result } = await store.submit(); json(response, result, 201); return true; }
  if (rest === 'claim' && method === 'POST') {
    const { result } = await store.claim();
    json(response, { ...result, orphaned: await orphanedThreads(record) });
    return true;
  }

  // Publishing is the one place a version is minted. The agent asks to hand the
  // document back; the numbering, hashing, and skip-if-unchanged decision all
  // happen here rather than in the agent's head.
  if (rest === 'publish' && method === 'POST') {
    const before = await store.read();
    const entry = await snapshot(stateDir, docPath, before.versions, { round: before.round, label: `round ${before.round}` });
    const { result, state } = await store.publish(entry);
    json(response, { ...result, version: entry, unchanged: !entry, versions: state.versions.length, orphaned: await orphanedThreads(record) });
    return true;
  }

  return false;
}

// --- routing --------------------------------------------------------------
async function route(request, response) {
  let url;
  try { url = new URL(request.url, 'http://127.0.0.1'); } catch { response.writeHead(400); response.end('Bad request'); return; }
  const pathname = decodeURIComponent(url.pathname);
  const method = request.method;

  if (pathname === '/' && method === 'GET') { html(response, await indexPage()); return; }

  if (pathname.startsWith('/api/')) {
    const segments = pathname.slice(5).split('/').filter(Boolean);
    const head = segments[0];
    if (RESERVED.has(head)) {
      if (head === 'index' && method === 'GET') {
        const out = [];
        for (const record of docs.values()) {
          const state = await record.store.read();
          out.push({ slug: record.slug, document: record.document, stateDir: record.stateDir, summary: summarize(state) });
        }
        json(response, { url: baseUrl, pid: process.pid, slugs: out, watchers: leases.size });
        return;
      }
      if (head === 'open' && method === 'POST') {
        const body = await readJsonBody(request);
        if (!body.document) { json(response, { error: 'document is required' }, 400); return; }
        json(response, await openDocument(body.document, body.slug), 201);
        return;
      }
      if (head === 'close' && method === 'POST') { json(response, await closeDocument((await readJsonBody(request)).slug)); return; }
      if (head === 'shutdown' && method === 'POST') { json(response, { ok: true }); void shutdown('requested'); return; }
      json(response, { error: `No route for ${method} ${pathname}` }, 404);
      return;
    }
    const record = docs.get(head);
    if (!record) { json(response, { error: `No open document with slug "${head}"` }, 404); return; }
    if (await documentRoute(request, response, record, segments.slice(1).join('/'), url.searchParams)) return;
    json(response, { error: `No route for ${method} ${pathname}` }, 404);
    return;
  }

  if (method !== 'GET') { response.writeHead(405); response.end('Method not allowed'); return; }
  // Every viewer URL serves the same shell; app.js reads its slug out of the
  // path, so there is no templating step.
  if (/^\/s\/[^/]+\/?$/.test(pathname)) { staticFile('/index.html', response); return; }
  staticFile(pathname, response);
}

// --- boot -----------------------------------------------------------------
if (!existsSync(publicDir)) { console.error(`Missing public directory: ${publicDir}`); process.exit(1); }
await loadRegistry();

let baseUrl = '';
let attempts = 0;
function listen(port) {
  server = createServer(async (request, response) => {
    try { await route(request, response); }
    catch (error) {
      const status = error instanceof StoreError ? error.status : 500;
      if (!response.headersSent) json(response, { error: error.message || 'Internal error' }, status);
      else response.end();
    }
  });
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempts < 20) { attempts += 1; server.close(() => listen(port + 1)); return; }
    console.error(`Unable to start the daemon on ports ${requestedPort}-${port}: ${error.message}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', async () => {
    baseUrl = `http://127.0.0.1:${port}`;
    await writeDaemon({ url: baseUrl, port, pid: process.pid, startedAt: new Date().toISOString() });
    console.log(baseUrl); // read by `review.mjs open` while it waits for boot
  });
}
listen(requestedPort);
