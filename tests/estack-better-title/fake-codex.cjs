#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const readline = require('node:readline');
const mode = process.env.TITLE_TEST_MODE;
const proxy = process.argv.includes('proxy');
fs.appendFileSync(process.env.TITLE_TEST_LOG, JSON.stringify({ start: true, proxy }) + '\n');
if (mode === 'fallback' && proxy) process.exit(2);
if (mode === 'permission-denied') { process.stderr.write('startup maintenance: attempt to write a readonly database\n'); process.exit(1); }
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  fs.appendFileSync(process.env.TITLE_TEST_LOG, line + '\n');
  if (!msg.id) return;
  if (msg.method === 'initialize') {
    if (mode === 'handshake-error') return send({ id: msg.id, error: { message: 'unsupported client' } });
    return send({ id: msg.id, result: {} });
  }
  if (mode === 'method-error') return send({ id: msg.id, error: { message: 'thread not loaded: test' } });
  if (mode === 'bad-response') return send({ id: msg.id, result: { thread: { id: 'wrong', name: null } } });
  if (msg.method === 'thread/read') {
    const name = mode === 'unicode' ? 'Café 🚀 東京' : null;
    return send({ id: msg.id, result: { thread: { id: msg.params.threadId, name } } }, mode === 'unicode');
  }
  if (msg.method === 'thread/name/set') return send({ id: msg.id, result: {} });
});
function send(value, split = false) {
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  if (!split) return process.stdout.write(bytes);
  const pos = bytes.indexOf(Buffer.from('🚀')) + 1;
  process.stdout.write(bytes.subarray(0, pos));
  setTimeout(() => process.stdout.write(bytes.subarray(pos)), 40);
}
