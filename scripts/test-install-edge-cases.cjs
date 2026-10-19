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
    env: Object.assign(Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^ESTACK_/.test(key))), { USERPROFILE: SANDBOX, HOME: SANDBOX }),
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
check('shared startup adapters installed in ~/.agents/hooks/',
  ['estack-startup-update-core.js', 'estack-claude-startup.js', 'estack-codex-startup.js']
    .every((name) => fs.existsSync(path.join(SANDBOX, '.agents', 'hooks', name))));
check('startup adapters are not duplicated in ~/.claude/hooks/',
  !fs.existsSync(path.join(SANDBOX, '.claude', 'hooks', 'estack-claude-startup.js')));
const claudeSettings = JSON.parse(fs.readFileSync(path.join(SANDBOX, '.claude', 'settings.json'), 'utf8'));
const claudeStartupHooks = claudeSettings.hooks.SessionStart.find((group) => group.matcher === 'startup').hooks;
check('Claude startup hook uses the shared adapter', claudeStartupHooks.some((hook) => hook.command.includes('.agents/hooks/estack-claude-startup.js')));
const codexHooks = JSON.parse(fs.readFileSync(path.join(SANDBOX, '.codex', 'hooks.json'), 'utf8'));
const codexStartupHooks = codexHooks.hooks.SessionStart.find((group) => group.matcher === 'startup').hooks;
check('Codex startup hook uses the shared adapter', codexStartupHooks.some((hook) => hook.command.includes('.agents/hooks/estack-codex-startup.js')));

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
const codexHooksAfterSecondInstall = JSON.parse(fs.readFileSync(path.join(SANDBOX, '.codex', 'hooks.json'), 'utf8'));
const codexStartupHooksAfterSecondInstall = codexHooksAfterSecondInstall.hooks.SessionStart.find((group) => group.matcher === 'startup').hooks;
check('Codex startup-hook registration is idempotent', codexStartupHooksAfterSecondInstall.filter((hook) => hook.command.includes('estack-codex-startup.js')).length === 1);

// ── Scenario H: deprecated skill at v1.0.23 location gets removed ────────────
console.log('\nScenario H: deprecated skill at old ~/.agents root is removed');
freshSandbox();
const depOld = path.join(SANDBOX, '.agents', 'estack-prompt-builder');
fs.cpSync(path.join(REPO, 'skills', SAMPLE), depOld, { recursive: true });
runInstaller(['--install']);
check('deprecated skill gone from ~/.agents/skills/', !fs.existsSync(path.join(SANDBOX, '.agents', 'skills', 'estack-prompt-builder')));
check('deprecated skill gone from ~/.claude/skills/', !fs.existsSync(path.join(SANDBOX, '.claude', 'skills', 'estack-prompt-builder')) && !isLink(path.join(SANDBOX, '.claude', 'skills', 'estack-prompt-builder')));

// ── Cleanup ───────────────────────────────────────────────────────────────────
// ── Scenario I: migrate the legacy direct Claude updater to the shared adapter ──
console.log('\nScenario I: migrate legacy direct Claude startup updater');
freshSandbox();
fs.mkdirSync(path.join(SANDBOX, '.claude'), { recursive: true });
fs.writeFileSync(path.join(SANDBOX, '.claude', 'settings.json'), JSON.stringify({
  hooks: {
    SessionStart: [{
      matcher: 'startup',
      hooks: [{ type: 'command', command: 'npx --yes elliot-stack@latest --startup' }],
    }],
  },
}));
runInstaller(['--install']);
const migratedSettings = JSON.parse(fs.readFileSync(path.join(SANDBOX, '.claude', 'settings.json'), 'utf8'));
const migratedStartupHooks = migratedSettings.hooks.SessionStart.find((group) => group.matcher === 'startup').hooks;
check('legacy direct updater removed', !migratedStartupHooks.some((hook) => hook.command.includes('elliot-stack@latest --startup')));
check('shared Claude adapter added', migratedStartupHooks.filter((hook) => hook.command.includes('estack-claude-startup.js')).length === 1);

// ── Scenario J: remove a leftover direct updater even if the adapter exists ──
console.log('\nScenario J: clean a mixed Claude startup configuration');
migratedStartupHooks.push({ type: 'command', command: 'npx --yes elliot-stack@latest --startup' });
fs.writeFileSync(path.join(SANDBOX, '.claude', 'settings.json'), JSON.stringify(migratedSettings));
runInstaller(['--install']);
const cleanedSettings = JSON.parse(fs.readFileSync(path.join(SANDBOX, '.claude', 'settings.json'), 'utf8'));
const cleanedStartupHooks = cleanedSettings.hooks.SessionStart.find((group) => group.matcher === 'startup').hooks;
check('mixed configuration retains only the shared adapter',
  cleanedStartupHooks.filter((hook) => hook.command.includes('estack-claude-startup.js')).length === 1 &&
  !cleanedStartupHooks.some((hook) => hook.command.includes('elliot-stack@latest --startup')));

// ── Scenario K: a local shared-adapter edit is backed up before replacement ──
console.log('\nScenario K: preserve local shared-adapter edits');
const sharedCore = path.join(SANDBOX, '.agents', 'hooks', 'estack-startup-update-core.js');
fs.appendFileSync(sharedCore, '\n// local change\n');
runInstaller(['--install']);
const backupCore = path.join(SANDBOX, '.estack-backup', 'hooks', 'estack-startup-update-core.js');
check('local shared-adapter edit backed up', fs.existsSync(backupCore) && fs.readFileSync(backupCore, 'utf8').includes('// local change'));
check('shared adapter restored from the package', !fs.readFileSync(sharedCore, 'utf8').includes('// local change'));

// ── Scenario L: ESTACK_SKILL_PREFIX=none installs short names ────────────────
console.log('\nScenario L: unprefixed install');
freshSandbox();
runInstaller(['--install', '--yes', '--no-prefix']);
const SHORT = SAMPLE.replace(/^estack-/, '');
check('short name is the real dir', isRealDir(agentsSkill(SHORT)));
check('prefixed name is absent', !fs.existsSync(agentsSkill(SAMPLE)));
check('symlink uses the short name', isLink(claudeSkill(SHORT)));
check('choice persisted to ~/.e-stack/.env',
  /^ESTACK_SKILL_PREFIX=none$/m.test(fs.readFileSync(path.join(SANDBOX, '.e-stack', '.env'), 'utf8')));

const notifyMd = fs.readFileSync(path.join(SANDBOX, '.agents', 'skills', 'notify', 'SKILL.md'), 'utf8');
check('frontmatter name rewritten', /^name: notify$/m.test(notifyMd));
// Scoped to the description line: elsewhere in the file `/estack-notify`
// legitimately appears as part of the scripts/estack-notify.ps1 filename.
const notifyDesc = (notifyMd.match(/^description:.*$/m) || [''])[0];
check('slash commands in the description rewritten',
  notifyDesc.includes('/notify ') && !notifyDesc.includes('/estack-notify'));
check('skill folder in a self-referencing path rewritten', notifyMd.includes('.agents/skills/notify/scripts/'));
// estack-notify.ps1 is a real filename inside the skill, not a skill reference.
check('script filenames left alone', notifyMd.includes('scripts/estack-notify.ps1') &&
  fs.existsSync(path.join(SANDBOX, '.agents', 'skills', 'notify', 'scripts', 'estack-notify-lib.ps1')));

const bookMd = fs.readFileSync(path.join(SANDBOX, '.agents', 'skills', 'pdf-to-md', 'SKILL.md'), 'utf8');
check('cross-skill install paths rewritten', !/skills\/estack-pdf-to-md/.test(bookMd));

// State under ~/.e-stack/ is storage, not a skill reference. Renaming it would
// orphan every saved config the moment the setting is flipped, and would split
// the statusline from the notify flag file it reads.
const plannerMd = fs.readFileSync(path.join(SANDBOX, '.agents', 'skills', 'flight-planner', 'SKILL.md'), 'utf8');
check('state dir under ~/.e-stack keeps its prefixed name',
  plannerMd.includes('.e-stack/estack-flight-planner') && !/\.e-stack\/flight-planner/.test(plannerMd));
const statusline = fs.readFileSync(path.join(SANDBOX, '.claude', 'hooks', 'estack-statusline.js'), 'utf8');
check('statusline still reads the prefixed notify flag dir',
  statusline.includes("'.e-stack', 'estack-notify'"));
const notifyLib = fs.readFileSync(path.join(SANDBOX, '.agents', 'skills', 'notify', 'scripts', 'estack-notify-lib.ps1'), 'utf8');
check('notify writes the flag where the statusline reads it',
  notifyLib.includes('estack-notify') && !/\.e-stack[\\/]notify\b/.test(notifyLib));

const notifyStop = JSON.parse(fs.readFileSync(path.join(SANDBOX, '.claude', 'settings.json'), 'utf8'))
  .hooks.Stop[0].hooks[0].args[2];
check('notify Stop hook points at the short folder',
  notifyStop.includes('/notify/scripts/estack-notify-stop.ps1'));

// ── Scenario M: an unprefixed install is stable across runs ──────────────────
// The package hash has to be computed on the rewritten content, or every skill
// reads as locally modified on the very next session start.
console.log('\nScenario M: unprefixed install is idempotent');
const secondRun = runInstaller(['--install', '--yes']);
check('nothing reinstalls', /0 skills installed/.test(secondRun));
check('nothing reads as locally modified', !/modified locally/.test(secondRun));

// ── Scenario N: editing the .env flips an existing install on next update ────
console.log('\nScenario N: flip back to prefixed by editing ~/.e-stack/.env');
const envFile = path.join(SANDBOX, '.e-stack', '.env');
fs.writeFileSync(envFile, fs.readFileSync(envFile, 'utf8').replace(/^ESTACK_SKILL_PREFIX=none$/m, 'ESTACK_SKILL_PREFIX=estack-'));
runInstaller(['--install', '--startup']);           // the auto-update path
check('prefixed name installed', isRealDir(agentsSkill(SAMPLE)));
check('short name retired from ~/.agents/skills/', !fs.existsSync(agentsSkill(SHORT)));
check('short symlink retired from ~/.claude/skills/', !fs.existsSync(claudeSkill(SHORT)) && !isLink(claudeSkill(SHORT)));
const manifest = JSON.parse(fs.readFileSync(path.join(SANDBOX, '.claude', '.estack-checksums.json'), 'utf8'));
check('manifest carries no stale short-name entries', manifest[SAMPLE] && !manifest[SHORT]);
check('notify Stop hook repointed at the prefixed folder',
  JSON.parse(fs.readFileSync(path.join(SANDBOX, '.claude', 'settings.json'), 'utf8'))
    .hooks.Stop[0].hooks[0].args[2].includes('/estack-notify/scripts/'));
check('flip settles', /0 skills installed/.test(runInstaller(['--install', '--yes'])));

// ── Scenario O: claiming a short name someone else is using ──────────────────
// Overwriting is the chosen behavior, but never without a copy and a warning.
console.log('\nScenario O: unprefixed install over a foreign skill of the same name');
const foreign = path.join(SANDBOX, '.agents', 'skills', 'notify');
fs.rmSync(foreign, { recursive: true, force: true });
fs.mkdirSync(foreign, { recursive: true });
fs.writeFileSync(path.join(foreign, 'SKILL.md'), '---\nname: notify\n---\nnot ours\n');
const claimed = runInstaller(['--install', '--yes', '--no-prefix']);
check('collision is called out by name', /WARNING/.test(claimed) && /\n    - notify\n/.test(claimed));
const foreignBackups = fs.readdirSync(path.join(SANDBOX, '.estack-backup')).filter(n => n === 'notify' || n.startsWith('notify-')).map(n => path.join(SANDBOX, '.estack-backup', n, 'SKILL.md'));
check('foreign skill backed up before replacement',
  foreignBackups.some(file => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('not ours')));
check('estack skill now occupies the name',
  fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8').includes('desktop notifications'));

// ── Cleanup ──────────────────────────────────────────────────────────────────
fs.rmSync(SANDBOX, { recursive: true, force: true });
console.log('\n' + (failures === 0 ? 'ALL EDGE CASES PASSED.' : failures + ' EDGE-CASE FAILURE(S).'));
process.exit(failures > 0 ? 1 : 0);
