#!/usr/bin/env node
'use strict';
// Verifies every skill follows the file-location and credential conventions in
// docs/skill-authoring.md. These were arrived at the hard way: skills had drifted
// into a dotfile each (~/.flight-planner), a bare home folder
// (~/repo-search-storage), a synced Documents folder, and — worst — an API key
// stored inside the installed skill folder, which the installer overwrites on
// every sync. Nothing catches that drift by reading a diff, so it is a gate.
//
// Checked, per skill:
//   1. State stays under ~/.e-stack/       — no new top-level dotfile, no bare
//                                            home folder, nothing under ~/.claude
//   2. Credentials live in ~/.e-stack/.env — one shared file, never a per-skill
//                                            .env and never inside the skill folder
//   3. No skill tells a user to STORE a key — an OS or shell environment variable
//      in an OS environment variable      is invisible to every other skill and
//                                            does not survive a move to a new
//                                            machine. This is how SERPAPI_KEY ended
//                                            up living in two places at once.
//
// Reading somebody else's directory is fine and common: estack-read-agent-history
// reads ~/.claude, estack-vscode-file-recovery reads ~/.config/Code. The rule is
// about where a skill WRITES its own state, so those paths are allowlisted below.
//
// A deliberate exception (a legacy-location check, a documented migration note)
// is marked by putting `estack-path-ok` in a comment on the same line.
//
// Usage:
//   node scripts/check-paths.cjs            # every skill
//   node scripts/check-paths.cjs <skill>    # one skill
//
// Exit codes: 0 = clean, 1 = violations found.
// The publish workflow runs this as a hard gate alongside the other checks.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const ESCAPE_HATCH = 'estack-path-ok';

// Paths a skill may legitimately reference because it READS another tool's data
// (or its own install location), rather than storing state there.
const ALLOWED_PREFIXES = [
  '~/.e-stack',            // the convention itself
  '~/.agents/skills',      // where skills install
  '~/.claude/skills',      // the Claude-side symlink to the same
  '~/.claude/projects',    // Claude's session transcripts (read)
  '~/.claude/settings',    // Claude's own config (read)
  '~/.claude/hooks',       // hook install location
  '~/.claude-backups',     // Claude's backups (read)
  '~/.codex',              // Codex's data, read-only for us — no skill writes here,
                           // so the whole subtree is allowed. ~/.claude is not:
                           // it gets named subpaths only, because state has been
                           // parked there before.
  '~/.config/Code',        // VS Code history (read)
  '~/.config/Cursor',      // Cursor history (read)
  '~/Library/Application', // macOS app support (read)
  '~/AppData',             // Windows app data (read)
];

// Bare roots another agent owns. Allowed on their own, because a skill that
// reads that agent's data has to name its root. A deeper path under one of
// these is still flagged unless ALLOWED_PREFIXES covers it, which is what keeps
// "~/.claude/doc-review" (state parked in someone else's directory) a failure.
const ALLOWED_EXACT = new Set(['~/.claude', '~/.codex', '~/.config', '~/Library']);

// Ways a skill can tell a user to persist a value in the OS/shell environment.
// Group 1 is the variable name, so the credential test below only fires on a
// name that looks like a secret. A $null/empty/omitted value is the fix (it
// CLEARS the variable), so the negative lookaheads let those through.
const ENV_SETTERS = [
  // setx and export needed the same value exemption as the other two: clearing a
  // variable is the fix, and flagging `export KEY=""` made the gate contradict
  // its own documented behavior. PowerShell's env: provider is case-insensitive,
  // so `$Env:` -- the casing Microsoft's own docs use -- has to match too.
  /\bsetx\s+["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s+(?!(?:""|'')\s*$)\S/,
  /\$[Ee][Nn][Vv]:([A-Za-z_][A-Za-z0-9_]*)\s*=(?!\s*(?:\\?\$null\b|''|""|$))/,
  /\bexport\s+([A-Za-z_][A-Za-z0-9_]*)=(?!\s*(?:''|""|$))\S/,
  /SetEnvironmentVariable\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*,(?!\s*(?:\\?\$null\b|''|""|null\b|\)))/,
];

// ── CLI ─────────────────────────────────────────────────────────────────────
const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL  ' + msg); };
const ok = (msg) => console.log('  ok    ' + msg);

function walkFiles(dir) {
  const out = [];
  const skipDirs = new Set(['__pycache__', 'node_modules', '.git']);
  const skipExts = new Set(['.pyc', '.pyo', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.zip', '.pdf']);
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (!skipDirs.has(e.name)) walk(full); continue; }
      if (skipExts.has(path.extname(e.name).toLowerCase())) continue;
      out.push(full);
    }
  })(dir);
  return out;
}

// Normalize $HOME/x, ${HOME}/x, %USERPROFILE%\x and Path.home()/"x" to ~/x so one
// set of rules covers bash, python, node, and prose.
function normalizeHomeRefs(line) {
  const head = line
    .replace(/\$\{?HOME\}?[\\/]/g, '~/')
    .replace(/%USERPROFILE%[\\/]/g, '~/')
    .replace(/\$env:USERPROFILE[\\/]/g, '~/')
    .replace(/homedir\(\)\s*,\s*['"]/g, '~/')
    .replace(/Path\.home\(\)\s*\/\s*["']/g, '~/');

  // Only a line that already resolved to a home root gets its remaining quoted
  // segments joined -- pathlib's `Path.home() / ".e-stack" / "skill" / ".env"`
  // and path.join's `homedir(), 'a', 'b'`. Normalizing only the head left the
  // rest behind a closing quote, so the rules below saw `~/.e-stack` and
  // stopped: a per-skill .env in the idiom this repo uses sailed straight past.
  // Collapsing unconditionally is wrong -- it also eats the argument separator
  // in SetEnvironmentVariable('KEY','value','User') and disarms rule 3.
  if (!head.includes('~/')) return head;
  return head
    .replace(/["']\s*\/\s*["']/g, '/')
    .replace(/["']\s*,\s*["']/g, '/');
}

function isAllowed(ref) {
  if (ALLOWED_EXACT.has(ref)) return true;
  return ALLOWED_PREFIXES.some((p) => ref === p || ref.startsWith(p + '/'));
}

function checkSkill(skillName) {
  console.log(skillName + ':');
  const skillDir = path.join(SKILLS_DIR, skillName);
  let violations = 0;

  for (const file of walkFiles(skillDir)) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (content.includes(String.fromCharCode(0))) continue; // binary guard

    content.split(/\r?\n/).forEach((rawLine, i) => {
      if (rawLine.includes(ESCAPE_HATCH)) return;
      const line = normalizeHomeRefs(rawLine);
      const at = rel + ':' + (i + 1);

      // ── 1. Home-directory references outside ~/.e-stack ──────────────────
      // The first segment needs 2+ chars: a single letter after ~/ is almost
      // always a JS regex literal's flags (`.replace(/~/g, ...)`), not a path.
      const homeRefs = (line.match(/~\/[A-Za-z0-9._-]{2,}(?:\/[A-Za-z0-9._*<>-]+)*/g) || [])
        .map((r) => r.replace(/[.,;:)\]}'"]+$/, '')); // trim sentence punctuation
      for (const ref of homeRefs) {
        if (isAllowed(ref)) continue;
        violations++;
        fail('writes outside ~/.e-stack: "' + ref + '" at ' + at +
             '\n        State belongs in ~/.e-stack/' + skillName + '/. If this path is only READ' +
             '\n        (another tool\'s data), add its prefix to ALLOWED_PREFIXES in this script,' +
             '\n        or mark the line with a ' + ESCAPE_HATCH + ' comment.');
      }

      // ── 2. Credentials outside the one shared .env ───────────────────────
      // A per-skill .env under ~/.e-stack/<skill>/ passes rule 1 but still
      // splits credentials across files, which is the thing being prevented.
      const perSkillEnv = line.match(/~\/\.e-stack\/[A-Za-z0-9._-]+\/\.env/g) || [];
      for (const ref of perSkillEnv) {
        violations++;
        fail('per-skill credential file: "' + ref + '" at ' + at +
             '\n        Every key in the pack lives in ~/.e-stack/.env. Read that instead,' +
             '\n        or mark a legacy-compatibility read with a ' + ESCAPE_HATCH + ' comment.');
      }

      // ── 3. Credentials told to live in an OS environment variable ───────
      // The path rules above cannot see this one: a skill that instructs the
      // user to run `setx SERPAPI_KEY ...` never names a path at all, yet the
      // key ends up outside ~/.e-stack, invisible to every other skill, and
      // gone the moment they switch machines. Clearing a variable is the fix,
      // not the violation, so a $null/empty assignment is exempt.
      const credName = /(^|_)(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)(_|$)/i;
      for (const re of ENV_SETTERS) {
        const m = line.match(re);
        if (!m || !credName.test(m[1])) continue;
        violations++;
        fail('tells the user to store ' + m[1] + ' in an OS environment variable at ' + at +
             '\n        No other skill can read it and it is lost on a new machine. Every key' +
             '\n        in the pack lives in ~/.e-stack/.env. A one-off override for a single' +
             '\n        run is fine - say so; do not instruct the user to persist it there.' +
             '\n        Mark a deliberate exception with a ' + ESCAPE_HATCH + ' comment.');
        break;
      }

      // ~/.claude/skills has to stay allowlisted above (skills are invoked from
      // there), which left a credential file parked under it passing every rule.
      // The only credential file in the pack is ~/.e-stack/.env.
      const foreignEnv = line.match(/~\/\.claude\/[A-Za-z0-9._\/-]*\.env\b/g) || [];
      for (const ref of foreignEnv) {
        violations++;
        fail('credential file outside the shared .env: "' + ref + '" at ' + at +
             '\n        ~/.claude belongs to Claude Code, not to this pack, and a key there is' +
             '\n        invisible to every other skill. Use ~/.e-stack/.env, or mark a legacy' +
             '\n        read with an ' + ESCAPE_HATCH + ' comment.');
      }

      // A .env resolved relative to the script's own location lands inside the
      // installed skill folder, which the installer overwrites on every sync.
      if (/(__file__|import\.meta\.url|__dirname|SKILL_DIR|\$\(dirname)/.test(line) && /\.env\b/.test(line)) {
        violations++;
        fail('credential file inside the installed skill folder at ' + at +
             '\n        The installer overwrites that folder on every sync, so the key is lost' +
             '\n        on update. Use ~/.e-stack/.env, or mark a legacy read with ' + ESCAPE_HATCH + '.');
      }
    });
  }

  if (violations === 0) ok('state and credentials follow the convention');
  return violations;
}

// ── Main ────────────────────────────────────────────────────────────────────
const skills = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((n) => (only ? n === only || n === 'estack-' + only : true))
  .sort();

if (only && skills.length === 0) {
  console.error('check-paths: no skill named "' + only + '" in skills/');
  process.exit(1);
}

for (const s of skills) checkSkill(s);

console.log('');
if (failures > 0) {
  console.log('check-paths: ' + failures + ' violation(s).');
  console.log('See docs/skill-authoring.md -> "Where a Skill Puts the Files It Creates"');
  console.log('and "Credentials and Environment Variables".');
  process.exit(1);
}
console.log('check-paths: every skill stores state and credentials where it should.');
process.exit(0);
