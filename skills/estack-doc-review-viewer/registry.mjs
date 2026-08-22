// Global registry for estack-doc-review-viewer.
//
// Lives outside any single document so that two Claude Code sessions running in
// different working directories agree on which slugs exist and where the daemon
// is. Everything here is plain JSON with atomic writes; there is no lock, and
// the daemon is the only process that mutates review.json.

import { homedir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Every e-stack skill that needs to persist something owns exactly one folder
// under ~/.e-stack, named for the skill. One directory to find, one to back up,
// one to delete -- and no skill scatters dotfiles across the home directory.
// The folder carries the full skill name so that the installed skill, its
// frontmatter, and its state all answer to one identity.
export const ESTACK_ROOT = resolve(homedir(), '.e-stack');
export const ROOT = resolve(ESTACK_ROOT, 'estack-doc-review-viewer');
export const REGISTRY_PATH = resolve(ROOT, 'registry.json');
export const DAEMON_PATH = resolve(ROOT, 'daemon.json');
export const DEFAULT_PORT = 4173;

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { return fallback; }
}
// The one atomic JSON write in the codebase. store.mjs writes review.json
// through this too, so tmp-then-rename lives in exactly one place.
export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await rename(tmp, path);
}

export function readRegistry() { return readJson(REGISTRY_PATH, { slugs: {} }); }
export function writeRegistry(data) { return writeJsonAtomic(REGISTRY_PATH, data); }
export function readDaemon() { return readJson(DAEMON_PATH, null); }
export function writeDaemon(data) { return writeJsonAtomic(DAEMON_PATH, data); }

export async function clearDaemon() {
  // Overwrite rather than unlink: a half-deleted file on Windows with a lock on
  // it is a worse failure than an explicit null.
  await writeJsonAtomic(DAEMON_PATH, null);
}

// process.kill(pid, 0) throws if the process is gone, which is the cheapest
// liveness check that does not shell out.
export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

// State lives under ~/.e-stack/estack-doc-review-viewer, never beside the document. The
// directory the user is working in holds their files and nothing this skill made.
export function stateDirFor(docPath, slug) {
  return resolve(ROOT, 'docs', slug);
}

function baseSlug(docPath) {
  const raw = basename(docPath).replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return raw.toLowerCase() || 'doc';
}
function dirTag(docPath) {
  return createHash('sha256').update(resolve(dirname(docPath))).digest('hex').slice(0, 4);
}

// Deterministic and stable across restarts: the same file always gets the same
// slug, and a second file with the same basename in a different directory gets
// a suffix derived from that directory rather than a counter.
export function allocateSlug(registry, docPath, requested) {
  const target = resolve(docPath);
  if (requested) return requested.replace(/[^\w.-]+/g, '-').toLowerCase();
  for (const [slug, entry] of Object.entries(registry.slugs || {})) {
    if (resolve(entry.document) === target) return slug;
  }
  const base = baseSlug(target);
  const taken = registry.slugs || {};
  if (!taken[base]) return base;
  const tagged = `${base}-${dirTag(target)}`;
  if (!taken[tagged] || resolve(taken[tagged].document) === target) return tagged;
  let n = 2;
  while (taken[`${tagged}-${n}`]) n += 1;
  return `${tagged}-${n}`;
}

// Which open document owns this thread? A thread id already identifies its
// document, so reply/resolve/reopen do not need --slug when several are open.
// An unreadable or half-written state file is skipped rather than fatal: the
// document that owns the thread can come after it in the list.
export async function slugOwningThread(slugs, threadId) {
  for (const [slug, entry] of slugs) {
    try {
      const state = JSON.parse(await readFile(resolve(entry.stateDir, 'review.json'), 'utf8'));
      if ((state.threads || []).some((thread) => thread.id === threadId)) return slug;
    } catch { /* unreadable or not yet written: it cannot be the owner */ }
  }
  return null;
}
