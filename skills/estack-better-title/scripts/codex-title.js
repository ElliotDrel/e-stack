#!/usr/bin/env node
// Reads and sets the name of a Codex thread through the Codex app-server.
//
// Usage: codex-title.js get <thread-id>
//        codex-title.js set <thread-id>     (the name is read from stdin)
//
// Codex stores a thread's user-facing name in its own state database. We never
// touch that file: writing it directly would race the running Codex process and
// break the first time Codex bumps its schema. Instead we speak the documented
// app-server JSON-RPC protocol (`thread/read`, `thread/name/set`), which is the
// same path the Codex UI uses.
//
// Two transports:
//   1. `codex app-server proxy` — forwards to the app-server daemon that is
//      already serving the live session, so a running UI sees the new name.
//      Only tried when the daemon's control socket is on disk: without it the
//      proxy is a full codex process start (~3.5 s) that is known in advance
//      to fail.
//   2. `codex app-server` — a private stdio server. It writes the same state,
//      but a session that is already open won't repaint until it is reloaded.
// A transport failure (spawn error, exit before the handshake, timeout) falls
// through to the next transport. A JSON-RPC error from a method that was
// actually answered is surfaced as-is; retrying it elsewhere gets the same
// answer, slower.

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TIMEOUT_MS = 25000;

function fail(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

// Thrown for failures of the connection itself, as opposed to a method the
// server answered with an error. connect() only falls through on these.
class TransportError extends Error {}

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function daemonSocketPresent() {
  return fs.existsSync(path.join(codexHome(), 'app-server-control', 'app-server-control.sock'));
}

// One request/response conversation with an app-server over stdio. The data
// handler only routes replies to their waiters; `run` drives the sequence with
// `call(method, params)` and `notify(method)`, and the server is torn down
// once it resolves or rejects.
function withAppServer(command, run) {
  return new Promise((resolve, reject) => {
    const options = { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] };
    // Windows npm installs expose codex.cmd. Keep the shell command constant;
    // thread ids and titles travel only through JSON on stdin.
    const child = process.platform === 'win32'
      ? spawn(command, { ...options, shell: true })
      : spawn('codex', command.split(' ').slice(1), options);

    let nextId = 0;
    const pending = new Map();
    let buffer = '';
    let stderr = '';
    let settled = false;
    let handshakeDone = false;

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.stdin.end(); } catch { /* already gone */ }
      child.kill();
      if (err) reject(err); else resolve(value);
    };

    const timer = setTimeout(
      () => finish(new TransportError(`${command} timed out after ${TIMEOUT_MS / 1000}s`)),
      TIMEOUT_MS,
    );

    const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
    const notify = (method, params) => send({ method, params });
    const call = (method, params) => new Promise((res, rej) => {
      const id = ++nextId;
      pending.set(id, { res, rej });
      send({ id, method, params });
    });

    // Preserve multi-byte titles even when a UTF-8 character spans chunks.
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdin.on('error', (err) => finish(new TransportError(err.message)));
    child.stdout.on('error', (err) => finish(new TransportError(err.message)));
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const waiter = msg.id != null && pending.get(msg.id);
        if (!waiter) continue;  // a server-initiated notification
        pending.delete(msg.id);
        if (msg.error) waiter.rej(new Error(msg.error.message || JSON.stringify(msg.error)));
        else waiter.res(msg.result);
      }
    });

    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => finish(new TransportError(err.message)));
    child.on('exit', (code) => {
      if (settled) return;
      finish(new TransportError(`${command} exited with code ${code}: ${stderr.trim() || 'no output'}`));
    });

    (async () => {
      try {
        await call('initialize', {
          clientInfo: { name: 'estack-better-title', version: '1.0.0' },
        });
      } catch (err) {
        // A JSON-RPC rejection answered the handshake: changing transports
        // cannot fix it. Stream/exit/timeout handlers tag transport failures.
        handshakeDone = true;
        throw err;
      }
      handshakeDone = true;
      // The protocol wants this notification before any other request is served.
      notify('initialized');
      return run(call);
    })().then((value) => finish(null, value), (err) => {
      // An exit or stream error after the handshake but before the method
      // reply is still a transport failure; the exit handler tags it.
      finish(err instanceof TransportError || !handshakeDone ? new TransportError(err.message) : err);
    });
  });
}

async function connect(run) {
  const transports = daemonSocketPresent()
    ? ['codex app-server proxy', 'codex app-server']
    : ['codex app-server'];
  const errors = [];
  for (const command of transports) {
    try {
      return await withAppServer(command, run);
    } catch (err) {
      if (/readonly database|read-only|permission denied|operation not permitted|access is denied|EACCES|EPERM/i.test(err.message)) {
        fail(
          'APPROVAL_REQUIRED: Codex app-server startup needs access to CODEX_HOME, even for a title read.\n' +
          'Agent: rerun this same operation through the host tool approval/escalation mechanism.\n' +
          'Keep the current CODEX_HOME and session id; do not disable sandbox protections or edit the database.\n' +
          'If approval is unavailable or denied, explain the limitation and stop.\n' + err.message,
        );
      }
      if (!(err instanceof TransportError)) fail(err.message);
      errors.push(`${command}: ${err.message}`);
    }
  }
  return fail(
    'could not reach the Codex app-server.\n' +
    errors.map((e) => '  ' + e).join('\n') + '\n' +
    'Check that the `codex` CLI is on PATH (`codex --version`).',
  );
}

async function getName(call, threadId) {
  const { thread } = await call('thread/read', { threadId, includeTurns: false });
  if (!thread || thread.id !== threadId || (thread.name != null && typeof thread.name !== 'string')) {
    throw new Error('invalid thread/read response for the current session');
  }
  return thread.name || '';
}

async function main() {
  const [mode, threadId] = process.argv.slice(2);
  if (!mode || !threadId) {
    fail('Usage: codex-title.js get|set <thread-id>   (set reads the name from stdin)');
  }

  if (mode === 'get') {
    const name = await connect((call) => getName(call, threadId));
    process.stdout.write(name ? `Current title: ${name}\n` : 'No current title is set for this session.\n');
    return;
  }

  if (mode === 'set') {
    const name = (await readStdin()).replace(/\r?\n$/, '');
    if (!name) fail('no title on stdin');
    if (/[\r\n]/.test(name)) fail('title must be a single line');
    await connect((call) => call('thread/name/set', { threadId, name }));
    process.stdout.write(`Renamed session to: ${name}\n`);
    return;
  }

  fail(`unknown mode "${mode}" — expected get or set`);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

main().catch((err) => fail(err.message));
