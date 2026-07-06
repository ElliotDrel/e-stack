#!/usr/bin/env node
'use strict';
// Verifies the human-facing docs list every skill and hook in the repo — and
// nothing that no longer exists. Catches the drift where a skill gets added to
// skills/ but never shows up in README.md or CLAUDE.md (or a renamed/removed
// one leaves a stale row behind).
//
// Checked:
//   README.md   — Skills table must have a `/estack-<name>` row per skill;
//                 Hooks table must have a row per hooks/*.js file
//   AGENTS.md   — "Skills in the pack" line must list every skill;
//                 "Hooks in the pack" line must list every hook
//                 (the project instructions live in AGENTS.md; CLAUDE.md just
//                 imports it via `@AGENTS.md`)
//
// Usage:
//   node scripts/check-docs.cjs
//
// Exit codes: 0 = docs in sync, 1 = missing or stale entries found.
// The publish workflow runs this as a hard gate alongside check-versions.cjs.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

// ── Ground truth: what actually exists in the repo ─────────────────────────
const skillNames = fs.readdirSync(path.join(REPO_ROOT, 'skills'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const hooksDir = path.join(REPO_ROOT, 'hooks');
const hookFiles = fs.existsSync(hooksDir)
  ? fs.readdirSync(hooksDir).filter((f) => f.endsWith('.js')).sort()
  : [];

const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
const agentsMd = fs.readFileSync(path.join(REPO_ROOT, 'AGENTS.md'), 'utf8');

let failures = 0;

function fail(msg) {
  console.log('  FAIL  ' + msg);
  failures++;
}

function ok(msg) {
  console.log('  ok    ' + msg);
}

// Extracts a "## <title>" section's body from markdown (up to the next "## ").
function section(content, title) {
  const m = content.match(new RegExp('^## ' + title + '\\s*$([\\s\\S]*?)(?=^## |\\Z)', 'm'));
  return m ? m[1] : null;
}

// ── README.md — Skills table ────────────────────────────────────────────────
console.log('README.md:');
{
  // Every skill needs a `/estack-<name>` row.
  for (const name of skillNames) {
    if (readme.includes('`/' + name + '`')) ok('skill listed: ' + name);
    else fail('README Skills table is missing a row for ' + name + ' (no `/' + name + '` found)');
  }
  // Every `/estack-...` mentioned must still exist (stale rename/remove).
  const mentioned = new Set();
  for (const m of readme.matchAll(/`\/(estack-[a-z0-9-]+)`/g)) mentioned.add(m[1]);
  for (const name of mentioned) {
    if (!skillNames.includes(name)) {
      fail('README mentions `/' + name + '` but skills/' + name + '/ does not exist (stale entry?)');
    }
  }
}

// ── README.md — Hooks table ─────────────────────────────────────────────────
{
  const hooksSection = section(readme, 'Hooks');
  if (hookFiles.length > 0 && hooksSection === null) {
    fail('README has no "## Hooks" section but hooks/ contains ' + hookFiles.length + ' hook(s)');
  } else if (hooksSection !== null) {
    const rowNames = new Set();
    for (const m of hooksSection.matchAll(/^\|\s*\*\*([a-z0-9-]+)\*\*\s*\|/gm)) rowNames.add(m[1]);
    for (const filename of hookFiles) {
      const base = filename.replace(/\.js$/, '');
      if (rowNames.has(base)) ok('hook listed: ' + base);
      else fail('README Hooks table is missing a row for ' + filename);
    }
    for (const base of rowNames) {
      if (!hookFiles.includes(base + '.js')) {
        fail('README Hooks table lists "' + base + '" but hooks/' + base + '.js does not exist (stale entry?)');
      }
    }
  }
}

// ── AGENTS.md — "Skills in the pack" / "Hooks in the pack" lines ───────────
console.log('\nAGENTS.md:');
{
  const skillsLine = agentsMd.match(/^- \*\*Skills in the pack:\*\*(.*)$/m);
  if (!skillsLine) {
    fail('AGENTS.md has no "Skills in the pack" line');
  } else {
    const listed = new Set();
    for (const m of skillsLine[1].matchAll(/`(estack-[a-z0-9-]+)`/g)) listed.add(m[1]);
    for (const name of skillNames) {
      if (listed.has(name)) ok('skill listed: ' + name);
      else fail('AGENTS.md "Skills in the pack" is missing ' + name);
    }
    for (const name of listed) {
      if (!skillNames.includes(name)) {
        fail('AGENTS.md "Skills in the pack" lists ' + name + ' but skills/' + name + '/ does not exist (stale entry?)');
      }
    }
  }

  const hooksLine = agentsMd.match(/^- \*\*Hooks in the pack:\*\*(.*)$/m);
  if (hookFiles.length > 0 && !hooksLine) {
    fail('AGENTS.md has no "Hooks in the pack" line but hooks/ contains ' + hookFiles.length + ' hook(s)');
  } else if (hooksLine) {
    const listed = new Set();
    for (const m of hooksLine[1].matchAll(/`([a-z0-9-]+\.js)`/g)) listed.add(m[1]);
    for (const filename of hookFiles) {
      if (listed.has(filename)) ok('hook listed: ' + filename);
      else fail('AGENTS.md "Hooks in the pack" is missing ' + filename);
    }
    for (const filename of listed) {
      if (!hookFiles.includes(filename)) {
        fail('AGENTS.md "Hooks in the pack" lists ' + filename + ' but hooks/' + filename + ' does not exist (stale entry?)');
      }
    }
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.log('check-docs: ' + failures + ' doc entry/entries out of sync.');
  console.log('Update the README.md Skills/Hooks tables and the AGENTS.md "Skills in the pack" / "Hooks in the pack" lines to match skills/ and hooks/.');
  process.exit(1);
}
console.log('check-docs: README.md and AGENTS.md list every skill and hook.');
process.exit(0);
