#!/usr/bin/env node
// @version 1.0.0
// Shared startup-update utility for the Claude Code and Codex adapters.

'use strict';

const { spawnSync } = require('child_process');

const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const UPDATE_TIMEOUT_MS = 120000;

function parseLastJsonObject(output) {
  let result = null;
  for (const line of output.split(/\r?\n/)) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) result = parsed;
    } catch (_) {
      // npx may print informational output before the installer's JSON result.
    }
  }
  return result;
}

function runUpdate() {
  const result = spawnSync(
    NPX_COMMAND,
    ['--yes', 'elliot-stack@latest', '--startup'],
    {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: UPDATE_TIMEOUT_MS,
      windowsHide: true,
    }
  );
  if (result.error || result.status !== 0) return null;
  return parseLastJsonObject(result.stdout || '');
}

module.exports = { runUpdate };
