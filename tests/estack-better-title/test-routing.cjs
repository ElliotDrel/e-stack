'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const scripts = path.resolve(__dirname, '../../skills/estack-better-title/scripts');
const id = '01234567-1234-4234-8234-0123456789ab';
const other = '01234567-1234-4234-8234-0123456789ac';
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
function sandbox(t, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estack-title-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, CODEX_HOME: path.join(dir, '.codex') };
  for (const key of ['CLAUDE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'CLAUDECODE', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'ESTACK_BETTER_TITLE_HOST']) delete env[key];
  Object.assign(env, extra);
  return { dir, env };
}
function shell(env, script, args = [], input) {
  return spawnSync(bash, [path.join(scripts, script), ...args], { env, input, encoding: 'utf8', timeout: 15000 });
}
function success(result) { assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr + result.stdout); }
function transcript(dir, session = id) {
  const project = path.join(dir, '.claude/projects/test');
  fs.mkdirSync(project, { recursive: true });
  const file = path.join(project, session + '.jsonl');
  fs.writeFileSync(file, '{"type":"user","message":"fixture"}\n');
  return file;
}
for (const [label, vars, code, message] of [
  ['unknown host', {}, 3, /could not tell which agent/],
  ['Claude marker without id', { CLAUDECODE: '1' }, 4, /no session id/],
  ['nested hosts', { CLAUDE_CODE_SESSION_ID: id, CODEX_THREAD_ID: id }, 2, /both a Claude/],
  ['nested marker', { CLAUDECODE: '1', CODEX_THREAD_ID: id }, 2, /both a Claude/],
  ['invalid override', { ESTACK_BETTER_TITLE_HOST: 'other' }, 1, /must be 'claude' or 'codex'/],
  ['override without id', { ESTACK_BETTER_TITLE_HOST: 'codex' }, 4, /no session id/],
  ['conflicting Codex aliases', { CODEX_THREAD_ID: id, CODEX_SESSION_ID: other }, 2, /conflicting session ids/],
  ['conflicting Claude aliases', { CLAUDE_SESSION_ID: id, CLAUDE_CODE_SESSION_ID: other }, 2, /conflicting session ids/],
  ['invalid session id', { CLAUDE_SESSION_ID: '../*' }, 1, /invalid session id/],
]) test(label, (t) => {
  const { env } = sandbox(t, vars);
  const r = shell(env, 'session.sh');
  assert.equal(r.status, code, r.stderr); assert.match(r.stderr, message); assert.doesNotMatch(r.stdout, /Rename with/);
});
for (const alias of ['CLAUDE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID']) test('Claude routing via ' + alias, (t) => {
  const { dir, env } = sandbox(t, { [alias]: id });
  const file = transcript(dir);
  success(shell(env, 'session.sh'));
  const title = 'Café 🚀 - quotes " and $HOME `literal`';
  success(shell(env, 'rename.sh', [id], title + '\n'));
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows.at(-2).customTitle, title); assert.equal(rows.at(-1).agentName, title);
  const before = fs.readFileSync(file, 'utf8');
  success(shell(env, 'rename.sh', [id], title + '\n'));
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'rename is idempotent');
  const read = shell(env, 'session.sh'); success(read); assert.ok(read.stdout.includes(title));
});
for (const override of [false, true]) test('stale id rejected with override=' + override, (t) => {
  const { dir, env } = sandbox(t, { CLAUDE_CODE_SESSION_ID: id, ...(override ? { CODEX_THREAD_ID: other, ESTACK_BETTER_TITLE_HOST: 'claude' } : {}) });
  const file = transcript(dir, other); const before = fs.readFileSync(file, 'utf8');
  const r = shell(env, 'rename.sh', [other], 'stale');
  assert.equal(r.status, 1); assert.match(r.stderr, /refusing to rename/); assert.equal(fs.readFileSync(file, 'utf8'), before);
});
test('nested host override selects current Claude session', (t) => {
  const { dir, env } = sandbox(t, { CLAUDE_CODE_SESSION_ID: id, CODEX_THREAD_ID: other, ESTACK_BETTER_TITLE_HOST: 'claude' });
  transcript(dir); const r = shell(env, 'session.sh'); success(r); assert.match(r.stdout, /HOST: Claude Code/);
  success(shell(env, 'rename.sh', [id], 'selected'));
});
for (const title of ['', 'line1\nline2', 'line1\rline2']) test('invalid title ' + JSON.stringify(title), (t) => {
  const { dir, env } = sandbox(t, { CLAUDE_CODE_SESSION_ID: id });
  const file = transcript(dir); const before = fs.readFileSync(file, 'utf8');
  const r = shell(env, 'rename.sh', [id], title);
  assert.equal(r.status, 1); assert.equal(fs.readFileSync(file, 'utf8'), before);
});
function mock(t, mode, proxy = false) {
  const box = sandbox(t, { TITLE_TEST_MODE: mode, CODEX_THREAD_ID: id });
  const bin = path.join(box.dir, 'bin'); fs.mkdirSync(bin);
  box.env.TITLE_TEST_LOG = path.join(box.dir, 'requests.jsonl');
  const fixture = path.join(__dirname, 'fake-codex.cjs');
  if (process.platform === 'win32') fs.writeFileSync(path.join(bin, 'codex.cmd'), `@"${process.execPath}" "${fixture}" %*\r\n`);
  else { fs.copyFileSync(fixture, path.join(bin, 'codex')); fs.chmodSync(path.join(bin, 'codex'), 0o755); }
  for (const key of Object.keys(box.env)) if (key.toLowerCase() === 'path') delete box.env[key];
  box.env.PATH = bin + path.delimiter + process.env.PATH;
  if (proxy) {
    const socket = path.join(box.env.CODEX_HOME, 'app-server-control/app-server-control.sock');
    fs.mkdirSync(path.dirname(socket), { recursive: true }); fs.writeFileSync(socket, '');
  }
  box.run = (mode = 'get', title) => spawnSync(process.execPath, [path.join(scripts, 'codex-title.js'), mode, id], { env: box.env, input: title, encoding: 'utf8', timeout: 15000 });
  box.log = () => fs.readFileSync(box.env.TITLE_TEST_LOG, 'utf8').trim().split('\n').map(JSON.parse);
  return box;
}
test('Codex read preserves fragmented Unicode and handshake order', (t) => {
  const box = mock(t, 'unicode'); const r = box.run(); success(r); assert.match(r.stdout, /Café 🚀 東京/);
  assert.deepEqual(box.log().filter(x => x.method).map(x => x.method), ['initialize', 'initialized', 'thread/read']);
  assert.equal(box.log().filter(x => x.start).length, 1);
});
test('Codex set preserves literal whitespace and shell characters', (t) => {
  const box = mock(t, 'normal'); const title = '  Café 🚀 $HOME `echo no` "quoted"  ';
  success(box.run('set', title + '\n'));
  assert.equal(box.log().find(x => x.method === 'thread/name/set').params.name, title);
});
test('Codex null title is a valid empty title', (t) => { const box = mock(t, 'normal'); const r = box.run(); success(r); assert.match(r.stdout, /No current title/); });
test('transport failure falls back from proxy', (t) => {
  const box = mock(t, 'fallback', true); success(box.run()); assert.equal(box.log().filter(x => x.start).length, 2);
});
for (const mode of ['method-error', 'handshake-error', 'bad-response']) test(mode + ' fails without retry', (t) => {
  const box = mock(t, mode, true); const r = box.run(); assert.equal(r.status, 1, r.stderr); assert.equal(box.log().filter(x => x.start).length, 1);
});
test('Codex read failure stops entry without printing a rename command', (t) => {
  const box = mock(t, 'method-error'); const r = shell(box.env, 'session.sh'); assert.equal(r.status, 1); assert.doesNotMatch(r.stdout, /Rename with/); assert.match(r.stderr, /thread not loaded/);
});
for (const alias of ['CODEX_THREAD_ID', 'CODEX_SESSION_ID']) test('Codex entry routing via ' + alias, (t) => {
  const box = mock(t, 'normal'); delete box.env.CODEX_THREAD_ID; box.env[alias] = id;
  const r = shell(box.env, 'session.sh'); success(r); assert.match(r.stdout, /HOST: Codex/); assert.match(r.stdout, /Rename with/);
});

test('startup block preserves detection errors for the agent', (t) => {
  const { env } = sandbox(t, { CLAUDE_SKILL_DIR: path.dirname(scripts) });
  const skill = fs.readFileSync(path.join(scripts, '../SKILL.md'), 'utf8');
  const block = skill.match(/```!\n([\s\S]*?)\n```/)[1];
  const r = spawnSync(bash, ['-c', block], { env, encoding: 'utf8', timeout: 15000 });
  success(r); assert.match(r.stdout, /SESSION_CHECK_FAILED/); assert.match(r.stderr, /could not tell which agent/); assert.doesNotMatch(r.stdout, /Rename with/);
});

test('sandbox denial requests host approval without retrying another transport', (t) => {
  const box = mock(t, 'permission-denied', true);
  const r = shell(box.env, 'session.sh');
  assert.equal(r.status, 1); assert.match(r.stderr, /APPROVAL_REQUIRED/);
  assert.match(r.stderr, /approval\/escalation/); assert.match(r.stderr, /Keep the current CODEX_HOME and session id/);
  assert.doesNotMatch(r.stdout, /Rename with/); assert.equal(box.log().filter(x => x.start).length, 1);
});
