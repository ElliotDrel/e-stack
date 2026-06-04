#!/usr/bin/env node
'use strict';
// Verifies per-item versioning: every skill (skills/*/SKILL.md `version:` field)
// and hook (hooks/*.js `// @version` comment) whose CONTENT changed since the
// last release also bumped its version.
//
// Usage:
//   node scripts/check-versions.cjs            # check against last v* release tag
//   node scripts/check-versions.cjs --fix      # auto patch-bump anything stale
//   node scripts/check-versions.cjs --base v1.0.20   # check against a specific ref
//
// Exit codes: 0 = all good (or fixed), 1 = stale versions found (without --fix)
// or a version field is missing entirely.
//
// Note: content-change detection is the SOURCE OF TRUTH for the installer
// (sha-256 hashes in bin/install.cjs). Versions are the human-readable label —
// this script keeps the two in sync so version numbers can be trusted.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const FIX = process.argv.includes('--fix');
const baseIdx = process.argv.indexOf('--base');
let BASE = baseIdx !== -1 ? process.argv[baseIdx + 1] : null;

// execFileSync with an argument array — no shell, so tag/path names are never
// shell-interpolated.
function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function gitOk(args) {
  try {
    execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch (_) {
    return false;
  }
}

function gitShow(ref, file) {
  try {
    return execFileSync('git', ['show', ref + ':' + file], {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe',
    });
  } catch (_) {
    return null; // file did not exist at ref
  }
}

function parseSkillVersion(content) {
  if (!content) return null;
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const m = fm[1].match(/^version:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}

function parseHookVersion(content) {
  if (!content) return null;
  const m = content.match(/^\/\/ @version\s+(\S+)\s*$/m);
  return m ? m[1] : null;
}

function isValidSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(String(version));
}

// Returns -1 / 0 / 1 comparing a to b numerically per semver part.
function compareSemver(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

function bumpPatch(version) {
  if (!isValidSemver(version)) return null;
  const parts = String(version).split('.').map((n) => parseInt(n, 10));
  parts[2] += 1;
  return parts.join('.');
}

// True if the path (file or dir) has untracked files — `git diff <ref>` can't
// see those, so without this a brand-new script inside a skill folder would
// slip past the changed-content check on local runs.
function hasUntracked(relPath) {
  return git(['ls-files', '--others', '--exclude-standard', '--', relPath]).length > 0;
}

function writeSkillVersion(file, newVersion) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/^(version:\s*)\S+(\s*)$/m, '$1' + newVersion + '$2');
  fs.writeFileSync(file, c);
}

function writeHookVersion(file, newVersion) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/^(\/\/ @version\s+)\S+(\s*)$/m, '$1' + newVersion + '$2');
  fs.writeFileSync(file, c);
}

// ── Resolve base ref: latest v* tag NOT pointing at HEAD ───────────────────
// (On a tag-push in CI, the just-pushed tag points at HEAD — we want the
// PREVIOUS release as the comparison base.)
if (!BASE) {
  const tags = git(['tag', '--sort=-v:refname', '--list', 'v*']).split(/\r?\n/).filter(Boolean);
  if (tags.length === 0) {
    console.log('check-versions: no v* tags found — nothing to compare against, skipping.');
    process.exit(0);
  }
  const head = git(['rev-parse', 'HEAD']);
  for (const t of tags) {
    if (git(['rev-list', '-n', '1', t]) !== head) { BASE = t; break; }
  }
  if (!BASE) {
    console.log('check-versions: only tag found points at HEAD — skipping.');
    process.exit(0);
  }
}

// Validate the base ref exists before diffing against it (clear error instead
// of a git stack trace on e.g. a typo'd --base value).
if (!gitOk(['rev-parse', '--verify', '--quiet', BASE + '^{commit}'])) {
  console.error('check-versions: base ref "' + BASE + '" does not resolve to a commit.');
  process.exit(1);
}

console.log('check-versions: comparing against ' + BASE + '\n');

let failures = 0;
let fixed = 0;

function check(label, existedAtBase, changed, baseVersion, currVersion, fixFn) {
  if (!currVersion) {
    console.log('  FAIL  ' + label + ' — missing version field entirely');
    failures++;
    return;
  }
  if (!isValidSemver(currVersion)) {
    console.log('  FAIL  ' + label + ' — version "' + currVersion + '" is not x.y.z semver');
    failures++;
    return;
  }
  if (!existedAtBase) {
    console.log('  ok    ' + label + ' — new since ' + BASE + ' (v' + currVersion + ')');
    return;
  }
  if (baseVersion === null) {
    // Existed at base but had no version field — adding the field counts as the bump.
    console.log('  ok    ' + label + ' — version field added since ' + BASE + ' (v' + currVersion + ')');
    return;
  }
  if (!changed) {
    if (baseVersion !== currVersion) {
      console.log('  warn  ' + label + ' — version changed (' + baseVersion + ' -> ' + currVersion + ') but content is identical to ' + BASE);
    } else {
      console.log('  ok    ' + label + ' — unchanged (v' + currVersion + ')');
    }
    return;
  }
  if (isValidSemver(baseVersion) && compareSemver(currVersion, baseVersion) < 0) {
    console.log('  FAIL  ' + label + ' — version went BACKWARD (' + baseVersion + ' -> ' + currVersion + ')');
    failures++;
    return;
  }
  if (baseVersion !== currVersion) {
    console.log('  ok    ' + label + ' — changed, version bumped (' + baseVersion + ' -> ' + currVersion + ')');
    return;
  }
  // Content changed but version did not
  if (FIX) {
    const next = bumpPatch(currVersion);
    if (next) {
      fixFn(next);
      fixed++;
      console.log('  FIXED ' + label + ' — content changed, auto-bumped ' + currVersion + ' -> ' + next);
      return;
    }
  }
  console.log('  FAIL  ' + label + ' — content changed since ' + BASE + ' but version still ' + currVersion);
  failures++;
}

// ── Skills ──────────────────────────────────────────────────────────────────
console.log('Skills:');
const skillsDir = path.join(REPO_ROOT, 'skills');
const skillNames = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

for (const name of skillNames) {
  const relDir = 'skills/' + name;
  const skillMd = path.join(skillsDir, name, 'SKILL.md');
  const changed = !gitOk(['diff', '--quiet', BASE, '--', relDir]) || hasUntracked(relDir);
  const baseContent = gitShow(BASE, relDir + '/SKILL.md');
  const existedAtBase = baseContent !== null;
  const baseVersion = parseSkillVersion(baseContent);
  const currVersion = fs.existsSync(skillMd) ? parseSkillVersion(fs.readFileSync(skillMd, 'utf8')) : null;
  check(name, existedAtBase, changed, baseVersion, currVersion, (v) => writeSkillVersion(skillMd, v));
}

// ── Hooks ───────────────────────────────────────────────────────────────────
const hooksDir = path.join(REPO_ROOT, 'hooks');
const hookFiles = fs.existsSync(hooksDir)
  ? fs.readdirSync(hooksDir).filter((f) => f.endsWith('.js')).sort()
  : [];

if (hookFiles.length > 0) {
  console.log('\nHooks:');
  for (const filename of hookFiles) {
    const relFile = 'hooks/' + filename;
    const full = path.join(hooksDir, filename);
    const changed = !gitOk(['diff', '--quiet', BASE, '--', relFile]) || hasUntracked(relFile);
    const baseContent = gitShow(BASE, relFile);
    const existedAtBase = baseContent !== null;
    const baseVersion = parseHookVersion(baseContent);
    const currVersion = parseHookVersion(fs.readFileSync(full, 'utf8'));
    check(filename, existedAtBase, changed, baseVersion, currVersion, (v) => writeHookVersion(full, v));
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.log('check-versions: ' + failures + ' item(s) need a version bump.');
  console.log('Bump the version in each file, or run: node scripts/check-versions.cjs --fix');
  process.exit(1);
}
if (fixed > 0) {
  console.log('check-versions: auto-bumped ' + fixed + ' version(s). Review and commit.');
} else {
  console.log('check-versions: all versions in sync.');
}
process.exit(0);
