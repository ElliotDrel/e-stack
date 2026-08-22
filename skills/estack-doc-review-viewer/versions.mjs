// Version history for estack-doc-review-viewer.
//
// Snapshots are taken by code, never by the agent. Claude edits one file and
// nothing else; the numbering, the hashing, and the decision about whether a
// pass produced a real change all happen here. That is deliberate: version
// bookkeeping is exactly the kind of work that should not consume any of the
// agent's attention.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';

export function versionsDir(stateDir) { return resolve(stateDir, 'versions'); }
export function versionPath(stateDir, entry) { return resolve(versionsDir(stateDir), entry.file); }

function sha(text) { return createHash('sha256').update(text, 'utf8').digest('hex'); }
const pad = (n) => String(n).padStart(4, '0');

export async function readDocument(docPath) {
  try {
    const [text, info] = await Promise.all([readFile(docPath, 'utf8'), stat(docPath)]);
    return { text, mtimeMs: info.mtimeMs, exists: true };
  } catch {
    // A document that does not exist yet is a normal state: the agent may be
    // about to create it. Report it, never throw.
    return { text: '', mtimeMs: 0, exists: false };
  }
}

// Returns the new entry, or null when the document is byte-identical to the
// last snapshot. A pass that changed nothing does not earn a version number.
export async function snapshot(stateDir, docPath, versions, { round, label }) {
  const doc = await readDocument(docPath);
  if (!doc.exists) return null;
  const digest = sha(doc.text);
  const last = versions[versions.length - 1];
  if (last && last.sha256 === digest) return null;
  const n = (last?.n || 0) + 1;
  const entry = {
    n,
    round,
    label: label || `round ${round}`,
    file: `v${pad(n)}${extname(docPath) || '.md'}`,
    createdAt: new Date().toISOString(),
    bytes: Buffer.byteLength(doc.text, 'utf8'),
    sha256: digest,
  };
  await mkdir(versionsDir(stateDir), { recursive: true });
  await writeFile(versionPath(stateDir, entry), doc.text, 'utf8');
  return entry;
}

// Which snapshot the file on disk currently corresponds to. The picker says
// "working file" and the reviewer could not tell whether that was v2 or something
// past it, so the label names its base and whether it has moved off it. Not a
// version number: v3 does not exist until publish mints it, and calling the
// working file v3 early would make the same label mean two different documents.
export async function workingBase(docPath, versions) {
  const last = versions[versions.length - 1];
  if (!last) return { base: null, clean: false };
  const doc = await readDocument(docPath);
  if (!doc.exists) return { base: last.n, clean: false };
  return { base: last.n, clean: sha(doc.text) === last.sha256 };
}

export async function readVersion(stateDir, entry) {
  try { return await readFile(versionPath(stateDir, entry), 'utf8'); }
  catch { return ''; }
}

// Selectors the client and the CLI can both use:
//   'current'   the file on disk right now
//   'latest'    the newest snapshot
//   'previous'  the snapshot before the newest
//   'first'     v1
//   <n>         that version number
export async function resolveSide(stateDir, docPath, versions, selector) {
  const pick = (entry) => entry || null;
  let entry = null;
  if (selector === 'current' || selector == null) {
    const doc = await readDocument(docPath);
    return { kind: 'current', label: 'working file', n: null, text: doc.text, mtimeMs: doc.mtimeMs, exists: doc.exists };
  }
  if (selector === 'latest') entry = pick(versions[versions.length - 1]);
  else if (selector === 'previous') entry = pick(versions[versions.length - 2]);
  else if (selector === 'first') entry = pick(versions[0]);
  else entry = pick(versions.find((v) => v.n === Number(selector)));
  if (!entry) return { kind: 'missing', label: `version ${selector}`, n: null, text: '', mtimeMs: 0, exists: false };
  return {
    kind: 'version', n: entry.n, label: `v${entry.n} (${entry.label})`,
    text: await readVersion(stateDir, entry),
    mtimeMs: Date.parse(entry.createdAt) || 0, exists: true,
  };
}

// What the viewer shows when nobody has picked anything: the last published
// snapshot against the file as it stands. During `reviewing` those differ only
// if something edited the file outside a round, which is worth seeing.
export function defaultSelection(versions) {
  if (versions.length >= 2) return { left: 'previous', right: 'current' };
  if (versions.length === 1) return { left: 'first', right: 'current' };
  return { left: 'current', right: 'current' };
}
