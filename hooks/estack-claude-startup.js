#!/usr/bin/env node
// @version 1.0.0
// Claude Code SessionStart adapter for the shared E-Stack startup updater.

'use strict';

const { runUpdate } = require('./estack-startup-update-core');

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    JSON.parse(input);
    const output = runUpdate();
    if (output) process.stdout.write(JSON.stringify(output) + '\n');
  } catch (_) {
    // A startup hook must never block the host agent.
  }
  process.exit(0);
});
