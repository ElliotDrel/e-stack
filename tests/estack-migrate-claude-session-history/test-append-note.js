'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const mod = require('../../skills/estack-migrate-claude-session-history/scripts/migrate-claude-history.js');

// Set up a tiny synthetic .jsonl in a temp dir
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-test-'));
const testFile = path.join(tmp, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl');
const sampleEntries = [
  { type: 'permission-mode', permissionMode: 'default', sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
  { type: 'user', message: { role: 'user', content: 'Hello' }, uuid: '11111111-1111-1111-1111-111111111111', parentUuid: null, sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', timestamp: '2026-05-24T18:00:00.000Z', cwd: 'C:\\fake\\old', version: '2.1.0' },
];
fs.writeFileSync(testFile, sampleEntries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');

const oldRepo = mod.parseWindowsRepoPath('C:\\fake\\old', 'old');
const newRepo = mod.parseWindowsRepoPath('C:\\fake\\new', 'new');

const summary = { migrationNotesAppended: 0, migrationNotesSkipped: 0 };

// First call — should append
mod.appendMigrationNote({ filePath: testFile, oldRepo, newRepo, dryRun: false, summary });
console.log('After first call:', summary);

// Second call — should detect duplicate and skip
mod.appendMigrationNote({ filePath: testFile, oldRepo, newRepo, dryRun: false, summary });
console.log('After second call:', summary);

// Inspect the appended entry
const lines = fs.readFileSync(testFile, 'utf8').split('\n').filter((l) => l.trim());
const appended = JSON.parse(lines[lines.length - 1]);

console.log('');
console.log('=== Appended entry shape ===');
console.log('type:    ', appended.type);
console.log('isMeta:  ', 'isMeta' in appended ? appended.isMeta : '<not set>');
console.log('parent:  ', appended.parentUuid);
console.log('uuid:    ', appended.uuid);
console.log('cwd:     ', appended.cwd);
console.log('');
console.log('=== content (first 200 chars) ===');
console.log(appended.message.content.slice(0, 200) + '...');

// Cleanup
fs.rmSync(tmp, { recursive: true, force: true });
console.log('');
console.log('Test passed:', summary.migrationNotesAppended === 1 && summary.migrationNotesSkipped === 1 && !('isMeta' in appended) ? 'YES' : 'NO');
