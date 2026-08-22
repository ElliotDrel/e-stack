// estack-doc-review-viewer state store.
//
// One file holds everything: the review phase, the round counter, the sequence
// counter, and every thread with every message in it. One atomic write per
// mutation, so phase and threads can never disagree.
//
// The design rule that matters here: this state is LEVEL-TRIGGERED. Nothing is
// an event that has to be consumed exactly once. "the reviewer is waiting on Claude"
// is a field, not a signal, so any process starting at any time reads the file
// and knows the truth. A dead watcher, a restarted server, or a crashed agent
// session cannot lose a click, because there is no click to lose.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeJsonAtomic } from './registry.mjs';

export const SCHEMA = 2;

// Phases, and who moves them:
//   reviewing  the reviewer's turn. He reads, comments, and eventually submits.
//   submitted  the reviewer clicked Send. Claude has not picked the round up yet.
//   editing    Claude claimed the round and is working. The page freezes.
// Only claim(), submit(), and publish() ever move it, so the list is here to
// read, not to validate against.

export const MAX_QUOTE = 1000;
export const MAX_BODY = 4000;

export class StoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function emptyState() {
  return {
    schema: SCHEMA,
    phase: 'reviewing',
    round: 1,
    nextSeq: 1,
    lastSeenByClaude: 0,
    claudeSeenAt: null,
    versions: [],
    threads: [],
  };
}

export function normalizeAuthor(value) {
  return value === 'agent' || value === 'claude' ? 'claude' : 'elliot';
}

function isText(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

// --- derived views --------------------------------------------------------
// Everything below is computed, never stored, so it cannot drift from the
// messages it describes.

export function newestMessage(thread) {
  return thread.messages[thread.messages.length - 1] || null;
}
export function isAwaitingClaude(thread) {
  const last = newestMessage(thread);
  return !thread.resolved && !!last && last.author !== 'claude';
}
// The whole "what changed since I last looked" question, answered by an integer
// comparison instead of a diff. Every message carries a monotonic seq.
export function unseenMessages(state) {
  const out = [];
  for (const thread of state.threads) {
    for (const message of thread.messages) {
      if (message.seq > state.lastSeenByClaude && message.author !== 'claude') {
        out.push({ threadId: thread.id, ...message });
      }
    }
  }
  return out.sort((a, b) => a.seq - b.seq);
}
export function summarize(state) {
  const open = state.threads.filter((t) => !t.resolved);
  const awaiting = open.filter(isAwaitingClaude);
  const unseen = unseenMessages(state);
  return {
    phase: state.phase,
    round: state.round,
    lastSeenByClaude: state.lastSeenByClaude,
    highestSeq: state.nextSeq - 1,
    threads: state.threads.length,
    openThreads: open.length,
    awaitingClaude: awaiting.map((t) => t.id),
    unseenMessages: unseen.length,
    versions: state.versions.length,
  };
}

// --- migration from the v1 comments.json layout ---------------------------
// v1 stored a root message on the comment itself plus a replies array, and had
// no seq, phase, or round. Flattening the root into messages[0] is what removes
// the root/reply special-casing that ran through the whole client.
export function migrateFromV1(v1) {
  const state = emptyState();
  const rows = [];
  for (const c of v1.comments || []) {
    const messages = [
      { id: randomUUID(), author: normalizeAuthor(c.author), body: String(c.body ?? ''), createdAt: c.createdAt, updatedAt: c.updatedAt || c.createdAt },
      ...(c.replies || []).map((r) => ({ id: r.id || randomUUID(), author: normalizeAuthor(r.author), body: String(r.body ?? ''), createdAt: r.createdAt, updatedAt: r.updatedAt || r.createdAt })),
    ];
    const thread = {
      id: c.id || randomUUID(),
      side: c.side === 'left' || c.side === 'general' ? c.side : 'right',
      line: c.side === 'general' ? null : c.line,
      quote: c.quote || '',
      prefix: c.prefix || '',
      resolved: !!c.resolved,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt || c.createdAt,
      messages,
    };
    state.threads.push(thread);
    messages.forEach((m) => rows.push(m));
  }
  // Assign seq in global chronological order so the numbering means the same
  // thing across threads as it does inside one.
  rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  rows.forEach((m, index) => { m.seq = index + 1; });
  state.nextSeq = rows.length + 1;
  // Claude demonstrably saw everything written before its own last message.
  state.lastSeenByClaude = rows.reduce((best, m) => (m.author === 'claude' && m.seq > best ? m.seq : best), 0);
  return state;
}

// --- the store ------------------------------------------------------------

export function createStore(stateDir, legacyDir = stateDir) {
  const statePath = resolve(stateDir, 'review.json');
  // v1 wrote comments.json beside the document. State has since moved out of
  // the working directory, so the legacy lookup keeps its own path.
  const legacyPath = resolve(legacyDir, 'comments.json');

  // Every mutation runs through this chain. Node is single-threaded but our
  // handlers await, so two concurrent POSTs would otherwise interleave
  // read-modify-write and one would silently lose. This serializes them.
  let queue = Promise.resolve();

  async function loadRaw() {
    let text;
    try {
      text = await readFile(statePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw new StoreError(`Unable to read review.json: ${error.message}`, 500);
      return null;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      // Never overwrite a file we cannot parse. Resetting it would eat every
      // comment; refusing keeps it recoverable by hand.
      throw new StoreError(`review.json contains invalid JSON, refusing to overwrite it: ${error.message}`, 500);
    }
    if (!data || !Array.isArray(data.threads)) throw new StoreError('review.json is valid JSON but has no "threads" array', 500);
    return { ...emptyState(), ...data };
  }

  async function loadLegacy() {
    try {
      const text = await readFile(legacyPath, 'utf8');
      const v1 = JSON.parse(text);
      if (!v1 || !Array.isArray(v1.comments)) return null;
      return migrateFromV1(v1);
    } catch {
      // No legacy file, or an unreadable one. Starting clean is correct here:
      // comments.json is left on disk untouched either way.
      return null;
    }
  }

  async function load() {
    const existing = await loadRaw();
    if (existing) return existing;
    return (await loadLegacy()) || emptyState();
  }

  // Atomic, so a crash mid-write cannot truncate the store.
  function save(state) {
    return writeJsonAtomic(statePath, state);
  }

  function read() {
    const run = queue.then(load);
    queue = run.then(() => {}, () => {});
    return run;
  }

  // fn may mutate the state object and return a value. The state is saved
  // afterwards unless fn throws.
  function mutate(fn) {
    const run = queue.then(async () => {
      const state = await load();
      const result = await fn(state, helpers(state));
      state.updatedAt = new Date().toISOString();
      await save(state);
      return { state, result };
    });
    queue = run.then(() => {}, () => {});
    return run;
  }

  function helpers(state) {
    return {
      addMessage(thread, author, body) {
        const now = new Date().toISOString();
        const message = { id: randomUUID(), seq: state.nextSeq++, author: normalizeAuthor(author), body, createdAt: now, updatedAt: now };
        thread.messages.push(message);
        thread.updatedAt = now;
        return message;
      },
    };
  }

  function requireThread(state, id) {
    const thread = state.threads.find((t) => t.id === id);
    if (!thread) throw new StoreError(`No thread with id ${id}`, 404);
    return thread;
  }

  return {
    statePath,
    legacyPath,
    read,

    // Write the current state out even if nothing changed, so a migration from
    // the old comments.json layout lands on disk at startup rather than the
    // first time somebody happens to comment.
    ensurePersisted() { return mutate(() => null); },

    // Version entries are built by versions.mjs and recorded here. The store
    // never decides what a version is, only that it happened.
    addVersion(entry) { return mutate((state) => { if (entry) state.versions.push(entry); return entry; }); },

    createThread(input) {
      return mutate((state, h) => {
        if (!isText(input.body, MAX_BODY)) throw new StoreError(`body must be 1-${MAX_BODY} characters`);
        let anchor;
        if (input.general === true) {
          anchor = { side: 'general', line: null, quote: '', prefix: '' };
        } else {
          if (input.side !== 'left' && input.side !== 'right') throw new StoreError('side must be "left" or "right"');
          if (!Number.isInteger(input.line) || input.line < 1) throw new StoreError('line must be a positive integer');
          if (!isText(input.quote, MAX_QUOTE)) throw new StoreError(`quote must be 1-${MAX_QUOTE} characters`);
          anchor = { side: input.side, line: input.line, quote: input.quote, prefix: typeof input.prefix === 'string' ? input.prefix.slice(0, 32) : '' };
        }
        const now = new Date().toISOString();
        const thread = { id: randomUUID(), ...anchor, resolved: false, createdAt: now, updatedAt: now, messages: [] };
        h.addMessage(thread, input.author, input.body);
        state.threads.push(thread);
        return thread;
      });
    },

    addMessage(id, input) {
      return mutate((state, h) => {
        if (!isText(input.body, MAX_BODY)) throw new StoreError(`body must be 1-${MAX_BODY} characters`);
        const thread = requireThread(state, id);
        return h.addMessage(thread, input.author, input.body);
      });
    },

    patchThread(id, input) {
      return mutate((state) => {
        const thread = requireThread(state, id);
        if (Object.prototype.hasOwnProperty.call(input, 'resolved')) {
          if (typeof input.resolved !== 'boolean') throw new StoreError('resolved must be a boolean');
          thread.resolved = input.resolved;
          thread.updatedAt = new Date().toISOString();
        }
        // The client re-anchors comments as the document changes under them and
        // persists the new line number here.
        if (Object.prototype.hasOwnProperty.call(input, 'line')) {
          if (!Number.isInteger(input.line) || input.line < 1) throw new StoreError('line must be a positive integer');
          thread.line = input.line;
        }
        return thread;
      });
    },

    deleteThread(id) {
      return mutate((state) => {
        const index = state.threads.findIndex((t) => t.id === id);
        if (index === -1) throw new StoreError(`No thread with id ${id}`, 404);
        state.threads.splice(index, 1);
        return { ok: true };
      });
    },

    patchMessage(id, messageId, input) {
      return mutate((state) => {
        if (!isText(input.body, MAX_BODY)) throw new StoreError(`body must be 1-${MAX_BODY} characters`);
        const thread = requireThread(state, id);
        const message = thread.messages.find((m) => m.id === messageId);
        if (!message) throw new StoreError(`No message with id ${messageId}`, 404);
        message.body = input.body;
        message.updatedAt = new Date().toISOString();
        thread.updatedAt = message.updatedAt;
        return message;
      });
    },

    deleteMessage(id, messageId) {
      return mutate((state) => {
        const thread = requireThread(state, id);
        const index = thread.messages.findIndex((m) => m.id === messageId);
        if (index === -1) throw new StoreError(`No message with id ${messageId}`, 404);
        // Deleting the only message would leave an anchor with nothing in it,
        // which renders as an empty card nobody can act on. Drop the thread.
        if (thread.messages.length === 1) {
          state.threads.splice(state.threads.indexOf(thread), 1);
          return { ok: true, threadDeleted: true };
        }
        thread.messages.splice(index, 1);
        thread.updatedAt = new Date().toISOString();
        return { ok: true, threadDeleted: false };
      });
    },

    // the reviewer's Send button. Flips the phase and nothing else: the messages are
    // already durable, so this only records whose turn it is.
    submit() {
      return mutate((state) => {
        if (state.phase === 'editing') throw new StoreError('Claude is still editing this round', 409);
        state.phase = 'submitted';
        state.submittedAt = new Date().toISOString();
        return summarize(state);
      });
    },

    // Claude picking the round up. Returns what it has not seen, then marks it
    // seen in the same atomic write so a crash cannot half-claim a round.
    claim() {
      return mutate((state) => {
        const pending = unseenMessages(state);
        const threads = [...new Set(pending.map((m) => m.threadId))].map((id) => state.threads.find((t) => t.id === id));
        state.lastSeenByClaude = state.nextSeq - 1;
        state.claudeSeenAt = new Date().toISOString();
        state.phase = 'editing';
        return { round: state.round, messages: pending, threads };
      });
    },

    // Claude handing the document back. Ends the round.
    publish(versionEntry) {
      return mutate((state) => {
        if (versionEntry) state.versions.push(versionEntry);
        state.round += 1;
        state.phase = 'reviewing';
        state.publishedAt = new Date().toISOString();
        return summarize(state);
      });
    },
  };
}
