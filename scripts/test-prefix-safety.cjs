// Real installer regressions: every subprocess uses a disposable home.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { Script } = require('vm');
const installer = process.env.PREFIX_TEST_INSTALLER || path.resolve(__dirname, '../bin/install.cjs');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'estack-prefix-safety-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^ESTACK_/.test(key)));
Object.assign(env, { HOME: home, USERPROFILE: home });
const at = (...parts) => path.join(home, ...parts);
const skill = name => at('.agents', 'skills', name);
const sample = 'estack-better-title';
const short = 'better-title';
let failures = 0;
function check(label, value) { console.log((value ? 'OK   ' : 'FAIL ') + label); if (!value) failures++; }
function run(args, extra = {}) { return execFileSync(process.execPath, [installer, ...args], { env: { ...env, ...extra }, encoding: 'utf8' }); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function fresh() { fs.rmSync(home, { recursive: true, force: true }); fs.mkdirSync(home); }
function snapshot(dir = home) {
  const entries = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name), stat = fs.lstatSync(file);
    const value = stat.isSymbolicLink() ? fs.readlinkSync(file) : stat.isDirectory() ? snapshot(file) : crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    entries.push([name, stat.mode, value]);
  }
  return JSON.stringify(entries);
}
try {
  run(['--install', '--yes', '--no-prefix']);
  const nudge = JSON.parse(execFileSync(process.execPath, [at('.claude', 'hooks', 'repo-search-nudge.js')], {
    env, encoding: 'utf8', input: JSON.stringify({ tool_name: 'WebFetch', tool_input: { url: 'https://github.com/example/repo' } }),
  }));
  check('executed nudge recommends the installed short name',
    nudge.hookSpecificOutput.additionalContext.includes('the repo-search skill') &&
    !nudge.hookSpecificOutput.additionalContext.includes('estack-repo-search'));
  const registry = skill('doc-review-viewer') + '/registry.mjs';
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(pathToFileURL(registry).href)}); console.log(m.ROOT);`], { env, encoding: 'utf8' }).trim();
  check('executed registry keeps the canonical state directory', output === at('.e-stack', 'estack-doc-review-viewer'));
  check('Python legacy credential path keeps canonical state name', read(skill('pdf-to-md') + '/scripts/pdf_to_md.py').includes('".e-stack" / "estack-pdf-to-md"'));
  check('Python legacy installed-skill path follows prefix choice', read(skill('pdf-to-md') + '/scripts/pdf_to_md.py').includes('"skills" / "pdf-to-md"'));
  // Verify all quoted identifiers used in state-owning source files remain canonical.
  for (const [name, relative] of [['doc-review-viewer', 'registry.mjs'], ['pdf-to-md', 'scripts/pdf_to_md.py']]) {
    check('state identifier preserved in ' + relative, read(skill(name) + '/' + relative).includes('estack-' + name));
  }
  // Flip twice with modified content, nested credentials, and an existing backup.
  fs.appendFileSync(skill(short) + '/SKILL.md', '\nLOCAL EDIT ONE\n');
  fs.mkdirSync(skill(short) + '/nested', { recursive: true });
  fs.writeFileSync(skill(short) + '/nested/.env', 'TEST_KEY=fixture\n');
  fs.mkdirSync(at('.estack-backup', short), { recursive: true });
  fs.writeFileSync(at('.estack-backup', short, 'keep.txt'), 'older backup');
  const beforePreview = snapshot();
  const preview = run(['--dry-run', '--prefix', '--yes']);
  check('prefix preview is write-free', snapshot() === beforePreview);
  check('preview describes backup and rename', preview.includes('Would back up ' + short) && preview.includes('reinstalling as ' + sample));
  run(['--install', '--yes', '--prefix']);
  check('flip carries nested credentials', read(skill(sample) + '/nested/.env') === 'TEST_KEY=fixture\n');
  check('existing backup survives', read(at('.estack-backup', short, 'keep.txt')) === 'older backup');
  const backups = fs.readdirSync(at('.estack-backup')).filter(n => n.startsWith(short + '-'));
  check('local edits backed up separately', backups.some(n => read(at('.estack-backup', n, 'SKILL.md')).includes('LOCAL EDIT ONE')));
  run(['--install', '--yes', '--no-prefix']);
  check('reverse flip carries credentials', read(skill(short) + '/nested/.env').includes('TEST_KEY=fixture'));
  check('credentials do not cause perpetual modified installs', run(['--install', '--yes']).includes('0 skills installed'));
  check('old name retired only after replacement', !fs.existsSync(skill(sample)) && fs.existsSync(skill(short)));
  // Silent conflict keeps both the original install and foreign destination.
  fresh(); run(['--install', '--yes']);
  fs.mkdirSync(skill(short), { recursive: true }); fs.writeFileSync(skill(short) + '/SKILL.md', 'FOREIGN SKILL');
  run(['--install', '--silent', '--no-prefix']);
  check('silent collision preserves old install', fs.existsSync(skill(sample)));
  check('silent collision preserves foreign skill', read(skill(short) + '/SKILL.md') === 'FOREIGN SKILL');
  check('silent deferral keeps notify hook on original skill', JSON.parse(read(at('.claude', 'settings.json'))).hooks.Stop[0].hooks[0].args[2].includes('/estack-notify/scripts/'));
  const startup = JSON.parse(run(['--install', '--startup']));
  check('startup identifies foreign takeover', startup.systemMessage.includes('foreign skills backed up and replaced: ' + short));
  check('startup does not call foreign skill a local modification', !(startup.additionalContext || '').includes(short));
  check('foreign skill backed up', read(at('.estack-backup', short, 'SKILL.md')) === 'FOREIGN SKILL');
  check('startup completes pending flip', !fs.existsSync(skill(sample)) && read(skill(short) + '/SKILL.md').includes('name: ' + short));
  const manifest = JSON.parse(read(at('.claude', '.estack-checksums.json')));
  check('manifest records completed names only', manifest[short] && !manifest[sample]);
  // Failed replacement must leave the old skill and ownership record usable.
  fresh(); run(['--install', '--yes']);
  const injector = at('fail-write.cjs');
  const originalSkill = read(skill(sample) + '/SKILL.md');
  const injectorSource = String.raw`const fs = require('fs'); const write = fs.writeFileSync; fs.writeFileSync = function(file, ...args) { if (String(file).replace(/\\/g, '/').endsWith('/skills/better-title/SKILL.md')) throw new Error('injected destination failure'); return write.call(this, file, ...args); };`;
  new Script(injectorSource, { filename: injector });
  fs.writeFileSync(injector, injectorSource);
  let rejected = false;
  try { execFileSync(process.execPath, ['--require', injector, installer, '--install', '--yes', '--no-prefix'], { env, encoding: 'utf8', stdio: 'pipe' }); } catch (error) {
    rejected = error.status !== 0 && /^Error during installation: injected destination failure\r?$/m.test(String(error.stderr));
  }
  check('installer reaches the intended destination write failure', rejected);
  check('failed replacement preserves original skill unchanged', rejected && read(skill(sample) + '/SKILL.md') === originalSkill);
  check('failed replacement preserves original manifest entry', rejected && JSON.parse(read(at('.claude', '.estack-checksums.json')))[sample]);
  // Skip means a modified source stays available until the user reviews it.
  fresh(); run(['--install', '--yes']); fs.appendFileSync(skill(sample) + '/SKILL.md', '\nLOCAL KEEP\n');
  fs.appendFileSync(skill('estack-notify') + '/SKILL.md', '\nLOCAL NOTIFY KEEP\n');
  run(['--install', '--skip-modified', '--no-prefix']);
  check('skip-modified retains edited source across a flip', read(skill(sample) + '/SKILL.md').includes('LOCAL KEEP') && !fs.existsSync(skill(short)));
  check('skipped notify keeps a valid Stop hook', JSON.parse(read(at('.claude', 'settings.json'))).hooks.Stop[0].hooks[0].args[2].includes('/estack-notify/scripts/'));
  // Credentials in old real Claude directories must be collected before unlink.
  fresh(); const legacy = at('.claude', 'skills', sample);
  fs.cpSync(path.resolve(path.dirname(installer), '../skills', sample), legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, '.env'), 'LEGACY_KEY=fixture\n');
  run(['--install', '--yes']);
  check('legacy real directory credentials survive migration', read(skill(sample) + '/.env') === 'LEGACY_KEY=fixture\n');
  fresh();
  const earlyNode = at('without-buffer-isutf8.cjs');
  fs.writeFileSync(earlyNode, "require('buffer').isUtf8 = undefined;\n");
  execFileSync(process.execPath, ['--require', earlyNode, installer, '--install', '--yes', '--no-prefix'], { env, encoding: 'utf8' });
  check('unprefixed install works without buffer.isUtf8', fs.existsSync(skill(short) + '/SKILL.md'));
  // Deprecated short name is not evidence of ownership.
  fresh(); fs.mkdirSync(skill('prompt-builder'), { recursive: true }); fs.writeFileSync(skill('prompt-builder') + '/SKILL.md', 'USER OWNED');
  run(['--install', '--yes', '--no-prefix']);
  check('foreign deprecated short name survives', read(skill('prompt-builder') + '/SKILL.md') === 'USER OWNED');
  // Dry-run must not migrate settings, create directories, or chmod existing files.
  fresh(); fs.mkdirSync(at('.e-stack')); fs.writeFileSync(at('.e-stack', 'config.json'), JSON.stringify({ statusline: { enabled: false } }));
  fs.writeFileSync(at('.e-stack', 'no-statusline'), ''); fs.writeFileSync(at('.e-stack', '.env'), 'TEST_API_KEY=unchanged\n');
  for (const flags of [[], ['--silent'], ['--startup']]) {
    const before = snapshot(); run(['--dry-run', '--no-prefix', ...flags]);
    check('dry-run leaves legacy configuration intact ' + flags.join(' '), snapshot() === before);
  }
  for (const flags of [['--prefix', '--no-prefix'], ['--statusline', '--no-statusline']]) {
    const before = snapshot(); let failed = false;
    try { run(['--install', '--yes', ...flags]); } catch (e) { failed = e.status !== 0 && String(e.stderr).includes('Conflicting flags'); }
    check('conflicting flags rejected before writes ' + flags.join(' '), failed && snapshot() === before);
  }
  console.log(failures ? `${failures} PREFIX SAFETY FAILURES` : 'ALL PREFIX SAFETY CHECKS PASSED');
} finally { fs.rmSync(home, { recursive: true, force: true }); }
process.exitCode = failures ? 1 : 0;
