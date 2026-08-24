#!/usr/bin/env node
// @version 1.1.0
// Claude Code Statusline - estack Edition
// model (window) | context used | dirname | rate limits

const path = require('path');
const fs = require('fs');
const os = require('os');

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

// Mirrors Get-NotifyModeFlagPath in the estack-notify skill's estack-notify-lib.ps1
// so the statusline reads the exact flag that skill and its Stop hook already use.
function notifyBadge(sessionId) {
  if (!sessionId) return '';
  const key = String(sessionId).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!key) return '';
  try {
    const flag = path.join(os.homedir(), '.e-stack', 'estack-notify', `${key}.flag`);
    return fs.existsSync(flag) ? '🔔' : '';
  } catch (e) { return ''; }
}

// green -> yellow -> orange -> blinking red
function color(pct) {
  if (pct < 50) return '\x1b[32m';
  if (pct < 65) return '\x1b[33m';
  if (pct < 80) return '\x1b[38;5;208m';
  return '\x1b[5;31m';
}

// 1000000 -> "1M", 1500000 -> "1.5M", 200000 -> "200k"
function compact(n) {
  if (n < 1e6) return Math.round(n / 1000) + 'k';
  const m = n / 1e6;
  return (Number.isInteger(m) ? m : m.toFixed(1)) + 'M';
}

function render(data) {
  const cw = data.context_window || {};
  const total = cw.context_window_size || 0;
  const used = cw.total_input_tokens;

  // The [1m] model-id suffix is unreliable (anthropics/claude-code#80272), so the
  // window comes from context_window_size, the same number the bar divides by.
  // Strip whatever window the name claims, append the real one.
  const name = (data.model?.display_name || 'Claude').replace(/\s*\([\d.]+[kmb][^)]*\)$/i, '');
  const model = total ? `${name} (${compact(total)})` : name;

  let ctx = '';
  if (total && used != null) {
    const pct = Math.max(0, Math.round((used / total) * 100));
    ctx = ` │ ${color(pct)}${pct >= 80 ? '💀 ' : ''}${compact(used)}${RESET}`;
  }

  const rate = [
    ['5h', data.rate_limits?.five_hour?.used_percentage],
    ['W', data.rate_limits?.seven_day?.used_percentage],
  ]
    .filter(([, v]) => v != null)
    .map(([l, v]) => `${color(Math.round(v))}${l}: ${Math.round(v)}%${RESET}`);

  const dir = path.basename(data.workspace?.current_dir || process.cwd());
  const badge = notifyBadge(data.session_id);
  return `${DIM}${model}${RESET}${ctx} │ ${DIM}${dir}${RESET}`
    + (rate.length ? ` │ ${rate.join(' ')}` : '')
    + (badge ? ` │ ${badge}` : '');
}

let input = '';
// stdin can stay open on Windows/Git Bash pipe glitches; don't leave a hung node
// process behind on every render.
const timer = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  clearTimeout(timer);
  try {
    process.stdout.write(render(JSON.parse(input)));
  } catch (e) { /* never break the statusline */ }
});
