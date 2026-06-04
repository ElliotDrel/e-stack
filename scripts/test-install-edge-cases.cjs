'use strict';
// Edge-case harness for bin/install.cjs. Runs the real installer inside a
// sandboxed HOME (via USERPROFILE) so the live ~/.claude is never touched.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const INSTALLER = path.join(REPO, 'bin', 'install.cjs');
const SANDBOX = path.join(os.tmpdir(), 'estack-edge-' + process.pid);

let failures = 0;
function check(label, cond) {
  console.log('  ' + (cond ? 'OK   ' : 'FAIL ') + label);
  if (!cond) failures++;
}

function freshSandbox() {
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  fs.mkdirSync(SANDBOX, { recursive: true });
}

function runInstaller(args) {
  return execFileSync('node', [INSTALLER, ...args], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { USERPROFILE: SANDBOX, HOME: SANDBOX }),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function agentsSkill(name) { return path.join(SANDBOX, '.agents', 'skills', name); }
function claudeSkill(name) { return path.join(SANDBOX, '.claude', 'skills', name); }
function isLink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch (_) { return false; } }
function isRealDir(p) { try { const s = fs.lstatSync(p); return s.isDirectory() && !s.isSymbolicLink(); } catch (_) { return false; } }

const SAMPLE = 'estack-better-title'; // small skill, fast to copy around

// ── Scenario A: fresh install ────────────────────────────────────────────────
console.log('\nScenario A: fresh install into empty HOME');
freshSandbox();
runInstaller(['--install']);
check('skill real dir in ~/.agents/skills/', isRealDir(agentsSkill(SAMPLE)));
check('symlink in ~/.claude/skills/', isLink(claudeSkill(SAMPLE)));
check('SKILL.md readable through link', fs.existsSync(path.join(claudeSkill(SAMPLE), 'SKILL.md')));
check('no estack-* strays at ~/.agents root', fs.readdirSync(path.join(SANDBOX, '.agents')).filter(n => n.startsWith('estack-')).length === 0);

// ── Scenario B: v1.0.23 layout migration (skills at ~/.agents root) ──────────
console.log('\nScenario B: migrate v1.0.23 layout (~/.agents/<name> + junction)');
freshSandbox();
const oldLoc = path.join(SANDBOX, '.agents', SAMPLE);
fs.cpSync(path.join(REPO, 'skills', SAMPLE), oldLoc, { recursive: true });
fs.mkdirSync(path.join(SANDBOX, '.claude', 'skills'), { recursive: true });
fs.symlinkSync(oldLoc, claudeSkill(SAMPLE), process.platform === 'win32' ? 'junction' : 'dir');
runInstaller(['--install']);
check('moved to ~/.agents/skills/', isRealDir(agentsSkill(SAMPLE)));
check('old root location gone', !fs.existsSync(oldLoc));
check('symlink re-pointed and resolves', isLink(claudeSkill(SAMPLE)) && fs.existsSync(path.join(claudeSkill(SAMPLE), 'SKILL.md')));

// ── Scenario C: locally modified skill at v1.0.23 location survives the move ─
console.log('\nScenario C: local modifications survive migration');
freshSandbox();
const oldLoc2 = path.join(SANDBOX, '.agents', SAMPLE);
fs.cpSync(path.join(REPO, 'skills', SAMPLE), oldLoc2, { recursive: true });
fs.appendFileSync(path.join(oldLoc2, 'SKILL.md'), '\n<!-- my local tweak -->\n');
runInstaller(['--install', '--silent']); // silent mode never overwrites modified skills
const migrated = path.join(agentsSkill(SAMPLE), 'SKILL.md');
check('modified file moved intact', fs.existsSync(migrated) && fs.readFileSync(migrated, 'utf8').includes('my local tweak'));

// ── Scenario D: legacy pre-symlink layout (real dir in ~/.claude/skills/) ────
console.log('\nScenario D: migrate legacy layout (real dir in ~/.claude/skills/)');
freshSandbox();
fs.mkdirSync(path.join(SANDBOX, '.claude', 'skills'), { recursive: true });
fs.cpSync(path.join(REPO, 'skills', SAMPLE), claudeSkill(SAMPLE), { recursive: true });
runInstaller(['--install']);
check('real dir replaced by symlink', isLink(claudeSkill(SAMPLE)));
check('content now lives in ~/.agents/skills/', isRealDir(agentsSkill(SAMPLE)));

// ── Scenario E: plain FILE occupying the symlink path ────────────────────────
console.log('\nScenario E: plain file squatting at ~/.claude/skills/<name>');
freshSandbox();
fs.mkdirSync(path.join(SANDBOX, '.claude', 'skills'), { recursive: true });
fs.writeFileSync(claudeSkill(SAMPLE), 'not a directory');
runInstaller(['--install']);
check('file replaced by working symlink', isLink(claudeSkill(SAMPLE)) && fs.existsSync(path.join(claudeSkill(SAMPLE), 'SKILL.md')));

// ── Scenario F: ~/.agents exists as a FILE ───────────────────────────────────
console.log('\nScenario F: ~/.agents is a plain file (no crash, clear failure)');
freshSandbox();
fs.writeFileSync(path.join(SANDBOX, '.agents'), 'squatter');
let crashed = false, out = '';
try { out = runInstaller(['--install']); } catch (e) { crashed = true; out = (e.stdout || '') + (e.stderr || ''); }
check('exits with error (not a hang/stack-dump success)', crashed);
check('no unhandled stack trace', !out.includes('    at '));

// ── Scenario G: idempotency — second run is a no-op ──────────────────────────
console.log('\nScenario G: second run is a no-op');
freshSandbox();
runInstaller(['--install']);
const out2 = runInstaller(['--install']);
check('reports 0 skills installed', out2.includes('0 skills installed'));

// ── Scenario H: deprecated skill at v1.0.23 location gets removed ────────────
console.log('\nScenario H: deprecated skill at old ~/.agents root is removed');
freshSandbox();
const depOld = path.join(SANDBOX, '.agents', 'estack-prompt-builder');
fs.cpSync(path.join(REPO, 'skills', SAMPLE), depOld, { recursive: true });
runInstaller(['--install']);
check('deprecated skill gone from ~/.agents/skills/', !fs.existsSync(path.join(SANDBOX, '.agents', 'skills', 'estack-prompt-builder')));
check('deprecated skill gone from ~/.claude/skills/', !fs.existsSync(path.join(SANDBOX, '.claude', 'skills', 'estack-prompt-builder')) && !isLink(path.join(SANDBOX, '.claude', 'skills', 'estack-prompt-builder')));

// ── Cleanup ───────────────────────────────────────────────────────────────────
fs.rmSync(SANDBOX, { recursive: true, force: true });
console.log('\n' + (failures === 0 ? 'ALL EDGE CASES PASSED.' : failures + ' EDGE-CASE FAILURE(S).'));
process.exit(failures > 0 ? 1 : 0);
