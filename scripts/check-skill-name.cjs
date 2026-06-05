#!/usr/bin/env node
'use strict';
// Verifies a skill's name was converted correctly for e-stack — catches the
// migration drift where a skill is copied in from ~/.claude/skills but keeps
// its old un-prefixed name somewhere: in frontmatter, in the description
// prefix, or in self-references inside its own files (e.g. a SKILL.md that
// tells the agent to "invoke the `my-skill` skill" when the installed name is
// `estack-my-skill`).
//
// Checked, per skill:
//   1. skills/estack-<short>/ folder exists
//   2. SKILL.md frontmatter `name:` matches the folder name exactly
//   3. frontmatter `version:` exists and is semver (x.y.z)
//   4. frontmatter `description:` starts with `(<short>)`
//   5. every mention of the bare short name inside the skill's files is either
//      prefixed with `estack-` or wrapped as `(<short>)` (the description
//      convention) — anything else is a stale, unconverted self-reference
//
// Usage:
//   node scripts/check-skill-name.cjs <skill-name>   # with or without estack- prefix
//   node scripts/check-skill-name.cjs --all          # every skill in skills/
//
// Exit codes: 0 = all checks pass, 1 = any failure.
// The publish workflow runs --all as a hard gate alongside check-docs.cjs.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

let failures = 0;

function fail(msg) {
  console.log('  FAIL  ' + msg);
  failures++;
}

function ok(msg) {
  console.log('  ok    ' + msg);
}

// ── Frontmatter parsing (YAML-lite: top-level keys + >- block scalars) ───────
function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const lines = m[1].split(/\r?\n/);
  const fm = {};
  let currentKey = null;
  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      // Block scalar (>-, >, |-, |) — value accumulates from indented lines
      fm[currentKey] = /^[>|][-+]?$/.test(value) ? '' : value;
    } else if (currentKey && /^\s+\S/.test(line)) {
      fm[currentKey] = (fm[currentKey] ? fm[currentKey] + ' ' : '') + line.trim();
    }
  }
  return fm;
}

// ── Recursive text-file walk of a skill folder ───────────────────────────────
function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── The check ────────────────────────────────────────────────────────────────
function checkSkill(inputName) {
  const short = inputName.replace(/^estack-/, '');
  const full = 'estack-' + short;
  console.log(full + ':');

  // 1. Folder exists
  const skillDir = path.join(SKILLS_DIR, full);
  if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
    fail('skills/' + full + '/ does not exist');
    return;
  }
  ok('folder skills/' + full + '/ exists');

  // 2-4. Frontmatter
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    fail('SKILL.md missing');
    return;
  }
  const fm = parseFrontmatter(fs.readFileSync(skillMdPath, 'utf8'));
  if (!fm) {
    fail('SKILL.md has no frontmatter block');
    return;
  }

  if (fm.name === full) ok('frontmatter name matches folder: ' + fm.name);
  else fail('frontmatter name is "' + (fm.name || '(missing)') + '", expected "' + full + '"');

  if (fm.version && /^\d+\.\d+\.\d+$/.test(fm.version)) ok('version present: ' + fm.version);
  else fail('version is "' + (fm.version || '(missing)') + '", expected semver x.y.z');

  if (fm.description && fm.description.startsWith('(' + short + ')')) {
    ok('description starts with (' + short + ')');
  } else {
    const head = fm.description ? fm.description.slice(0, 40) + '…' : '(missing)';
    fail('description must start with "(' + short + ')" — found: ' + head);
  }

  // 5. Stale bare-name mentions in the skill's own files
  const nameRe = new RegExp(escapeRegExp(short), 'g');
  let staleMentions = 0;
  for (const file of walkFiles(skillDir)) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // unreadable/binary — skip
    }
    if (content.includes(String.fromCharCode(0))) continue; // binary guard - skip non-text files
    const lines = content.split(/\r?\n/);
    lines.forEach((line, i) => {
      let m;
      while ((m = nameRe.exec(line)) !== null) {
        const charBefore = m.index > 0 ? line[m.index - 1] : '';
        const charAfter = line[m.index + short.length] || '';
        // Part of a longer identifier (repo-search-storage), a deliberate
        // dotfile dir (~/.flight-planner/), or already estack- prefixed
        // (the trailing '-' of the prefix lands in this set) — not a skill
        // name reference, skip.
        if (/[A-Za-z0-9.-]/.test(charBefore)) continue;
        if (/[A-Za-z0-9-]/.test(charAfter)) continue;
        // The `(<short>)` description convention is the one sanctioned bare use.
        if (charBefore === '(' && charAfter === ')') continue;
        fail('stale bare name "' + short + '" at ' + rel + ':' + (i + 1) + ' — use "' + full + '"');
        staleMentions++;
      }
    });
  }
  if (staleMentions === 0) ok('no stale bare-name mentions in skill files');
}

// ── Main ─────────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.log('Usage: node scripts/check-skill-name.cjs <skill-name> | --all');
  process.exit(1);
}

const targets =
  arg === '--all'
    ? fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [arg];

for (const t of targets) checkSkill(t);

console.log('');
if (failures > 0) {
  console.log('check-skill-name: ' + failures + ' failure(s).');
  process.exit(1);
}
console.log('check-skill-name: all checks passed.');
