#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline');
const { isUtf8 } = require('buffer');

const IS_LOCAL = !__dirname.includes('node_modules');
const DRY_RUN = process.argv.includes('--dry-run') ||
  (IS_LOCAL && !process.argv.includes('--install'));
const SILENT = process.argv.includes('--silent') && !DRY_RUN;
const STARTUP = process.argv.includes('--startup') && !DRY_RUN;
for (const [positive, negative] of [['--prefix', '--no-prefix'], ['--statusline', '--no-statusline']]) {
  if (process.argv.includes(positive) && process.argv.includes(negative)) {
    console.error('Conflicting flags: ' + positive + ' and ' + negative);
    process.exit(1);
  }
}


// ── Settings ───────────────────────────────────────────────────────────────
// The pack already has exactly one place a user configures things:
// ~/.e-stack/.env, KEY=value, shared by every skill. Installer settings live
// there too, under the same names as their environment variables, and follow
// the same resolution order every skill uses: the live process environment
// first, then the file.
//
// ESTACK_HOME is the one exception, env-only by necessity — it decides where
// the .env file itself lives, so it cannot be read from that file.
const HOME = os.homedir();
const ESTACK_DIR = process.env.ESTACK_HOME || path.join(HOME, '.e-stack');
const ENV_FILE = path.join(ESTACK_DIR, '.env');

// Same parse rules the skills document: blank lines and # comments ignored,
// surrounding quotes stripped, first = splits key from value.
function readEnvFile() {
  const values = {};
  let raw;
  try {
    raw = fs.readFileSync(ENV_FILE, 'utf8');
  } catch (_) {
    return values;                       // absent or unreadable — no settings
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.length > 1 && /^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

const ENV_FILE_VALUES = readEnvFile();

// Live environment wins, so a one-off override works without editing the file.
function setting(name) {
  return process.env[name] || ENV_FILE_VALUES[name] || null;
}

// Path settings are absolute-only; anything else falls back to the default
// rather than resolving somewhere surprising relative to the cwd.
function settingPath(name, fallback) {
  const value = setting(name);
  return value && path.isAbsolute(value) ? value : fallback;
}

// Writes one KEY=value into ~/.e-stack/.env, replacing that key's line if it is
// already there and appending otherwise. Never rewrites the rest of the file —
// it is shared, and other skills keep their credentials in it.
// The file holds API keys, so it is owner-only and its directory is
// owner-traversable. chmod is a near-no-op on Windows and can throw on exotic
// filesystems; failing to tighten must never fail an install.
function secureEnvFile() {
  try { fs.chmodSync(ENV_FILE, 0o600); } catch (_) {}
  try { fs.chmodSync(ESTACK_DIR, 0o700); } catch (_) {}
}

function writeSetting(name, value) {
  if (DRY_RUN) {
    if (value === null) delete ENV_FILE_VALUES[name];
    else ENV_FILE_VALUES[name] = value;
    return;
  }
  fs.mkdirSync(ESTACK_DIR, { recursive: true, mode: 0o700 });
  let lines = [];
  try {
    lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  } catch (_) { /* new file */ }
  const pattern = new RegExp('^\\s*' + name + '\\s*=');
  const index = lines.findIndex((l) => pattern.test(l));
  if (value === null) {
    if (index === -1) return;
    lines.splice(index, 1);
  } else if (index === -1) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(name + '=' + value);
    lines.push('');
  } else {
    lines[index] = name + '=' + value;
  }
  fs.writeFileSync(ENV_FILE, lines.join('\n').replace(/\n{3,}$/, '\n\n'), { mode: 0o600 });
  secureEnvFile();
  if (value === null) delete ENV_FILE_VALUES[name];
  else ENV_FILE_VALUES[name] = value;
}

// Existing installs created this file before it was owner-only, and most runs
// never write a setting, so tighten it on every run rather than only on write.
if (!DRY_RUN && fs.existsSync(ENV_FILE)) secureEnvFile();

// Fold the two short-lived predecessors of this file into it.
(function migrateLegacySettings() {
  const marker = path.join(ESTACK_DIR, 'no-statusline');
  const configFile = path.join(ESTACK_DIR, 'config.json');
  try {
    if (fs.existsSync(marker)) {
      writeSetting('ESTACK_NO_STATUSLINE', '1');
      if (!DRY_RUN) fs.rmSync(marker, { force: true });
    }
    if (fs.existsSync(configFile)) {
      const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (cfg.statusline && cfg.statusline.enabled === false) {
        writeSetting('ESTACK_NO_STATUSLINE', '1');
      }
      for (const [key, name] of [['skills', 'ESTACK_SKILLS_DIR'],
                                 ['hooks', 'ESTACK_HOOKS_DIR'],
                                 ['backup', 'ESTACK_BACKUP_DIR']]) {
        const value = cfg.paths && cfg.paths[key];
        if (value) writeSetting(name, value);
      }
      if (!DRY_RUN) fs.rmSync(configFile, { force: true });
    }
  } catch (_) { /* not worth failing an install over */ }
})();

// ── Paths ──────────────────────────────────────────────────────────────────
const CLAUDE_DIR = path.join(HOME, '.claude');
const CODEX_DIR = path.join(HOME, '.codex');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const AGENTS_ROOT = path.join(HOME, '.agents');
const AGENTS_DIR = settingPath('ESTACK_SKILLS_DIR', path.join(AGENTS_ROOT, 'skills'));
const AGENTS_HOOKS_DIR = path.join(AGENTS_ROOT, 'hooks');
const BACKUP_DIR = settingPath('ESTACK_BACKUP_DIR', path.join(HOME, '.estack-backup'));
const CHECKSUMS_FILE = path.join(CLAUDE_DIR, '.estack-checksums.json');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const CODEX_HOOKS_FILE = path.join(CODEX_DIR, 'hooks.json');
const PACKAGE_SKILLS_DIR = path.join(__dirname, '..', 'skills');
const HOOKS_DIR = settingPath('ESTACK_HOOKS_DIR', path.join(CLAUDE_DIR, 'hooks'));
const PACKAGE_HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const STARTUP_HOOK_FILENAMES = [
  'estack-startup-update-core.js',
  'estack-claude-startup.js',
  'estack-codex-startup.js',
];

const STATUSLINE_FILENAME = 'estack-statusline.js';

// ── Non-interactive install ────────────────────────────────────────────────
// The modified-items prompt reads EOF on a piped or redirected stdin and
// aborts the whole install, so scripted and CI runs answer it up front.
//   --yes             back up local changes, install the latest (same as --startup)
//   --skip-modified   leave locally modified items alone, install everything else
const NON_INTERACTIVE = process.argv.includes('--yes') ||
  process.argv.includes('--skip-modified');
const NON_INTERACTIVE_ACTION = process.argv.includes('--skip-modified')
  ? 'skip'
  : 'merge';

//   --statusline           install it and claim the slot again
//   --no-statusline        remove it, and write ESTACK_NO_STATUSLINE=1
//   ESTACK_NO_STATUSLINE=1 skip it for this run without editing the file
function statuslineOptedOut() {
  if (process.argv.includes('--statusline')) return false;
  if (process.argv.includes('--no-statusline')) return true;
  return setting('ESTACK_NO_STATUSLINE') === '1';
}

// Whether the installer has ever taken the statusLine slot. Derived, not
// stored: the checksum manifest already records every artifact this installer
// has put on disk, and "have we installed the statusline before" is exactly
// that question. Captured from the manifest as read at startup, before this
// run writes to it. --statusline forces a fresh claim on request.
let STATUSLINE_CLAIMED = false;

// Persists an explicit --no-statusline / --statusline choice so every later
// auto-update honors it. A bare env var is deliberately not persisted.
function persistStatuslineChoice(dryRun) {
  const optOut = process.argv.includes('--no-statusline');
  const optIn = process.argv.includes('--statusline');
  if (!optOut && !optIn) return;
  if (dryRun) return;
  writeSetting('ESTACK_NO_STATUSLINE', optOut ? '1' : null);
  if (optIn) STATUSLINE_CLAIMED = false;
}

// ── Migrate backup dir from old location (inside .claude) to user root ──────
(function migrateBackupDir() {
  const OLD_BACKUP_DIR = path.join(CLAUDE_DIR, '.estack-backup');
  if (!fs.existsSync(OLD_BACKUP_DIR)) return;
  if (fs.existsSync(BACKUP_DIR)) return; // new location already exists, leave both alone
  const silent = process.argv.includes('--silent');
  const isDryRun = process.argv.includes('--dry-run') ||
    (!__dirname.includes('node_modules') && !process.argv.includes('--install'));
  if (isDryRun) {
    if (!silent) {
      process.stderr.write(
        'estack: [dry run] Would move backup dir from ~/.claude/.estack-backup/ to ~/.estack-backup/\n'
      );
    }
    return;
  }
  try {
    fs.renameSync(OLD_BACKUP_DIR, BACKUP_DIR);
    if (!silent) {
      process.stderr.write(
        'estack: moved backup dir from ~/.claude/.estack-backup/ to ~/.estack-backup/\n'
      );
    }
  } catch (e) {
    // rename across drives/filesystems — fall back to copy+delete
    try {
      copyDirRaw(OLD_BACKUP_DIR, BACKUP_DIR);
      removeDirRaw(OLD_BACKUP_DIR);
      if (!silent) {
        process.stderr.write(
          'estack: migrated backup dir from ~/.claude/.estack-backup/ to ~/.estack-backup/\n'
        );
      }
    } catch (e2) {
      process.stderr.write(
        'estack: WARNING — could not migrate backup dir from ' + OLD_BACKUP_DIR +
        ' to ' + BACKUP_DIR + ': ' + e2.message + '\n'
      );
    }
  }
})();

// ── Migrate skills from ~/.agents/<name> (v1.0.23 layout) to ~/.agents/skills/ ──
(function migrateAgentsLayout() {
  let strays;
  try {
    // statSync guards against ~/.agents existing as a plain file
    if (!fs.existsSync(AGENTS_ROOT) || !fs.statSync(AGENTS_ROOT).isDirectory()) return;
    strays = fs.readdirSync(AGENTS_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('estack-'));
  } catch (_) {
    return; // unreadable — let main() surface a real error if it matters
  }
  if (strays.length === 0) return;
  const silent = process.argv.includes('--silent');
  const isDryRun = process.argv.includes('--dry-run') ||
    (!__dirname.includes('node_modules') && !process.argv.includes('--install'));
  if (isDryRun) {
    if (!silent) {
      process.stderr.write(
        'estack: [dry run] Would move ' + strays.length + ' skill(s) from ~/.agents/ to ~/.agents/skills/\n'
      );
    }
    return;
  }
  try {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
  } catch (err) {
    process.stderr.write(
      'estack: WARNING — could not create ~/.agents/skills/: ' + err.message + '\n'
    );
    return;
  }
  for (const e of strays) {
    const oldPath = path.join(AGENTS_ROOT, e.name);
    const newPath = path.join(AGENTS_DIR, e.name);
    try {
      if (fs.existsSync(newPath)) {
        // already migrated — drop the stale copy at the old location
        fs.rmSync(oldPath, { recursive: true, force: true });
      } else {
        try {
          fs.renameSync(oldPath, newPath);
        } catch (_) {
          copyDirRaw(oldPath, newPath);
          removeDirRaw(oldPath);
        }
      }
      // re-point the live symlink — the old junction now dangles
      ensureSymlink(newPath, path.join(SKILLS_DIR, e.name));
    } catch (err) {
      process.stderr.write(
        'estack: WARNING — could not migrate ' + e.name + ' to ~/.agents/skills/: ' + err.message + '\n'
      );
    }
  }
  if (!silent) {
    process.stderr.write(
      'estack: moved ' + strays.length + ' skill(s) from ~/.agents/ to ~/.agents/skills/\n'
    );
  }
})();

function copyDirRaw(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRaw(s, d);
    else fs.copyFileSync(s, d);
  }
}

function removeDirRaw(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDirRaw(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

function isSymlink(p) {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch (_) { return false; }
}

// True only for a real directory at p — not a symlink to one, not a file.
function isRealDir(p) {
  try {
    const stat = fs.lstatSync(p);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch (_) {
    return false;
  }
}

// Creates (or updates) a directory symlink at linkPath pointing to target.
// On Windows uses 'junction' (no elevation required); on Unix uses 'dir'.
function ensureSymlink(target, linkPath) {
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      if (path.resolve(fs.readlinkSync(linkPath)) === path.resolve(target)) return;
      fs.unlinkSync(linkPath);
    } else {
      // real dir, plain file, or anything else occupying the link path
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  } catch (_) {}
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(target, linkPath, type);
}

// ── Skill name prefix ──────────────────────────────────────────────────────
// The package always ships skills prefixed (skills/estack-<short>/), and that
// is what installs by default. ESTACK_SKILL_PREFIX=none installs them under
// their short names instead: ~/.agents/skills/notify/, /notify, and every
// cross-reference inside the skills rewritten to match.
//
//   --no-prefix              install short names, and write ESTACK_SKILL_PREFIX=none
//   --prefix                 install prefixed, and clear the setting
//   ESTACK_SKILL_PREFIX=none the same, for one run or permanently via the file
//
// Read fresh on every run — including the --silent and --startup auto-update
// paths — so editing ~/.e-stack/.env and starting a new session reconciles an
// existing install to whichever naming the file now asks for. The rename is
// not a one-way door: the checksum manifest is keyed by installed name, so the
// names from the previous mode are migration sources. They are backed up and
// retired only after the replacement installs successfully.
const SKILL_PREFIX = 'estack-';

function prefixEnabled() {
  if (process.argv.includes('--prefix')) return true;
  if (process.argv.includes('--no-prefix')) return false;
  return String(setting('ESTACK_SKILL_PREFIX') || '').trim().toLowerCase() !== 'none';
}

const PREFIXED = prefixEnabled();

// The name a package skill installs under.
function installedName(packageName) {
  if (PREFIXED || !packageName.startsWith(SKILL_PREFIX)) return packageName;
  return packageName.slice(SKILL_PREFIX.length);
}

// Persists an explicit --no-prefix / --prefix choice so later auto-updates keep
// it. A bare ESTACK_SKILL_PREFIX in the environment is honored for the run but
// deliberately not written to the file, matching --no-statusline.
function persistPrefixChoice(dryRun) {
  const optOut = process.argv.includes('--no-prefix');
  const optIn = process.argv.includes('--prefix');
  if (!optOut && !optIn) return;
  if (dryRun) return;
  writeSetting('ESTACK_SKILL_PREFIX', optOut ? 'none' : null);
}

// Matches a reference to one of this package's skills by its full prefixed
// name, so unprefixed mode can rewrite `estack-notify` to `notify` everywhere
// it appears: the `name:` line in frontmatter, cross-skill mentions in prose,
// slash commands in descriptions, and the self-referencing install paths
// several skills use to run their own scripts (estack-book-extractor's
// SKILL.md shells out to ~/.claude/skills/estack-book-extractor/scripts/).
//
// Three exclusions keep it off things that are not skill references:
//   (?<!\.e-stack…)    a state directory under ~/.e-stack/. That folder is
//                      storage, not a skill reference, and it must not move
//                      when the install name does — otherwise flipping the
//                      setting orphans every saved config
//                      (~/.e-stack/estack-flight-planner/config.json), and the
//                      statusline stops finding the notify flag the notify
//                      skill writes. Covers both the path form
//                      (`~/.e-stack/estack-notify`) and the path.join argument
//                      form (`'.e-stack', 'estack-notify'`).
//   (?![-\w])          `estack-notify` inside `estack-notify-lib.ps1`, and any
//                      longer skill name a shorter one is a prefix of
//   (?!\.[A-Za-z0-9]+) `estack-notify.ps1`, a real file that keeps its name —
//                      while still rewriting a sentence that ends
//                      "...estack-prompt-builder-coach." where the dot is
//                      punctuation rather than an extension
//
// It only has one pattern to find because scripts/check-skill-name.cjs already
// gates that every mention of a skill inside the pack is written with the
// prefix. Loosening that check would silently leave stale names behind here.
let RENAME_PATTERN;

function renamePattern() {
  if (RENAME_PATTERN !== undefined) return RENAME_PATTERN;
  let shortNames = [];
  try {
    shortNames = fs.readdirSync(PACKAGE_SKILLS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith(SKILL_PREFIX))
      .map((e) => e.name.slice(SKILL_PREFIX.length))
      // Longest first so estack-prompt-builder-coach never matches as
      // estack-prompt-builder with a stray "-coach" left behind.
      .sort((a, b) => b.length - a.length);
  } catch (_) { /* handled by the caller's own missing-skills-dir check */ }
  RENAME_PATTERN = shortNames.length === 0 ? null : new RegExp(
    '(?<!\\.e-stack[\'"]?[,/\\\\]\\s*[\'"]?)' +
    SKILL_PREFIX + '(' + shortNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')' +
    '(?![-\\w])(?!\\.[A-Za-z0-9]+)',
    'g'
  );
  return RENAME_PATTERN;
}

// Rewrites skill references in one packaged file. A no-op in prefixed mode, so
// a default install runs byte-for-byte the code path it always has. Binary
// files are passed through untouched.
function renameReferences(buffer) {
  if (PREFIXED) return buffer;
  const pattern = renamePattern();
  if (pattern === null) return buffer;
  if (buffer.includes(0) || !isUtf8(buffer)) return buffer;
  const text = buffer.toString('utf8');
  const renamed = text.replace(pattern, (match, short, offset) => {
    const before = text.slice(0, offset);
    const after = text.slice(offset + match.length);
    // Quoted bare names in executable code are storage keys or identifiers.
    // Rewrite only when the preceding path segment explicitly names skills.
    if (/['"]$/.test(before) && /^['"]/.test(after) &&
        !/skills['"]?\s*(?:,|\/)\s*['"]$/.test(before)) return match;
    // Variable-based state paths ($ESTACK_ROOT/estack-...) also stay stable.
    if (/[A-Za-z0-9_$}.][\\/]$/.test(before) && !/skills[\\/]$/.test(before)) return match;
    return short;
  });
  return renamed === text ? buffer : Buffer.from(renamed, 'utf8');
}

// ── Deprecated skills ──────────────────────────────────────────────────────
// Skills that were renamed or removed. The installer removes these on every
// run so users don't end up with both the old and new name installed.
// LEGACY ONLY — do not add to this list. Removing a skill from the package is
// enough: step 3b retires anything the checksum manifest records installing
// that the package no longer ships, on disk and in the manifest. These two
// names stay because they were removed before that existed, so an install old
// enough to still have them may have no manifest entry to prune.
const DEPRECATED_SKILLS = [
  'estack-prompt-builder', // renamed to estack-prompt-builder-coach
  'estack-read-claude-session-history', // renamed to estack-read-agent-history
];

// ── Helpers ────────────────────────────────────────────────────────────────

const HASH_IGNORE_DIRS = new Set(['__pycache__', '.git', 'node_modules']);
const HASH_IGNORE_EXTS = new Set(['.pyc', '.pyo']);

// Files placed by the user inside a skill folder that must never be overwritten
// by an update. The installer saves their contents before wiping and restores
// them after the copy.
const USER_DATA_FILENAMES = new Set(['.env']);

function walkDir(dir, base) {
  base = base || dir;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!HASH_IGNORE_DIRS.has(entry.name)) files.push(...walkDir(full, base));
    } else if (!USER_DATA_FILENAMES.has(entry.name) && !HASH_IGNORE_EXTS.has(path.extname(entry.name))) {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

// `fromPackage` hashes what the file will look like once installed rather than
// as it sits in the package, so an unprefixed install's on-disk content still
// matches its stored checksum and does not read as locally modified forever.
// Installed files are hashed as-is: a user who hand-wrote a prefixed name back
// into an unprefixed skill has modified it, and should be told so.
function computeFileHash(filePath, fromPackage) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  let raw = fs.readFileSync(filePath);
  if (fromPackage) raw = renameReferences(raw);
  hash.update(Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n')));
  return hash.digest('hex');
}

// Startup adapters are shared across agents, so their canonical installed
// location is ~/.agents/hooks. Claude and Codex each reference the appropriate
// adapter from their own hook configuration.
function syncStartupHookSources(dryRun) {
  const updated = [];
  for (const filename of STARTUP_HOOK_FILENAMES) {
    const source = path.join(PACKAGE_HOOKS_DIR, filename);
    const destination = path.join(AGENTS_HOOKS_DIR, filename);
    if (!fs.existsSync(source)) continue;
    const sourceHash = computeFileHash(source, true);
    const destinationHash = computeFileHash(destination);
    if (sourceHash === destinationHash) continue;
    if (!dryRun) {
      fs.mkdirSync(AGENTS_HOOKS_DIR, { recursive: true });
      if (destinationHash !== null) {
        const backupDestination = path.join(BACKUP_DIR, 'hooks', filename);
        fs.mkdirSync(path.dirname(backupDestination), { recursive: true });
        fs.copyFileSync(destination, backupDestination);
      }
      copyPackageFile(source, destination);
    }
    updated.push(filename);
  }
  return updated;
}

function computeSkillHash(skillDir, fromPackage) {
  // statSync (not lstat) so symlinked dirs hash their contents; plain files → null
  try {
    if (!fs.statSync(skillDir).isDirectory()) return null;
  } catch (_) {
    return null;
  }
  const hash = crypto.createHash('sha256');
  const files = walkDir(skillDir, skillDir);
  for (const relPath of files) {
    const fullPath = path.join(skillDir, relPath);
    let raw = fs.readFileSync(fullPath);
    if (fromPackage) raw = renameReferences(raw);
    hash.update(relPath.replace(/\\/g, '/'));
    hash.update(Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n')));
  }
  return hash.digest('hex');
}

function copyDir(src, dest) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(src, dest, { recursive: true });
}

// Copies one packaged file, rewriting skill references on the way through.
// The mode is carried over by hand because the content is rewritten rather
// than copied, and several skills ship executable .sh scripts.
function copyPackageFile(src, dest) {
  if (PREFIXED) {
    fs.copyFileSync(src, dest);
    return;
  }
  fs.writeFileSync(dest, renameReferences(fs.readFileSync(src)));
  try { fs.chmodSync(dest, fs.statSync(src).mode); } catch (_) {}
}

// copyDir for a packaged skill. In prefixed mode this is copyDir exactly.
function copyPackageDir(src, dest) {
  if (PREFIXED) {
    copyDir(src, dest);
    return;
  }
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyPackageDir(from, to);
    else copyPackageFile(from, to);
  }
}

// Takes an installed name — the backup mirrors what is actually on disk.
function backupSkill(name) {
  const seen = new Set();
  for (const root of [AGENTS_DIR, SKILLS_DIR]) {
    const installedDir = path.join(root, name);
    if (!fs.existsSync(installedDir)) continue;
    const real = fs.realpathSync(installedDir);
    if (seen.has(real)) continue;
    seen.add(real);
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const base = path.join(BACKUP_DIR, name);
    const destination = fs.existsSync(base) ? base + '-' + crypto.randomUUID() : base;
    fs.cpSync(installedDir, destination, { recursive: true, dereference: true });
  }
}

function backupHook(filename) {
  const installedFile = path.join(HOOKS_DIR, filename);
  if (!fs.existsSync(installedFile)) return;
  const dest = path.join(BACKUP_DIR, 'hooks', filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(installedFile, dest);
}

function promptChar(question) {
  if (!process.stdin.isTTY) {
    // Non-interactive environment — read a line from piped stdin
    return new Promise((resolve) => {
      let resolved = false;
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (answer) => {
        if (!resolved) {
          resolved = true;
          rl.close();
          resolve((answer || '').toLowerCase().trim()[0] || '');
        }
      });
      // If stdin is already closed, default to abort
      rl.once('close', () => {
        if (!resolved) {
          resolved = true;
          resolve('a');
        }
      });
    });
  }
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', (chunk) => {
      const char = chunk.toString().toLowerCase().trim()[0] || '';
      try { process.stdin.setRawMode(false); } catch (_) {}
      process.stdin.pause();
      process.stdout.write('\n');
      resolve(char);
    });
  });
}

function getSkillDescription(skillDir) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return '';
  const content = fs.readFileSync(skillMd, 'utf8');
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return '';
  const fm = frontmatterMatch[1];
  const singleLine = fm.match(/^description:\s*(\S.*)$/m);
  if (singleLine && !/^[>|]/.test(singleLine[1])) return singleLine[1].trim();
  const multiLine = fm.match(/^description:\s*[>|][->+]?\r?\n((?:[ \t]+.*\r?\n?)+)/m);
  if (multiLine) {
    return multiLine[1].replace(/\s+/g, ' ').trim();
  }
  return '';
}

// Per-skill version from SKILL.md frontmatter (`version: x.y.z`).
// Versions are the human-readable label; content hashes remain the
// update-detection source of truth (scripts/check-versions.cjs keeps them in sync).
function getSkillVersion(skillDir) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return null;
  const content = fs.readFileSync(skillMd, 'utf8');
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return null;
  const m = frontmatterMatch[1].match(/^version:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}

// Version of the currently installed copy of a skill (agents dir, falling
// back to the legacy skills dir for pre-migration installs).
// Takes an installed name.
function getInstalledSkillVersion(name) {
  const agentsDir = path.join(AGENTS_DIR, name);
  if (fs.existsSync(agentsDir)) return getSkillVersion(agentsDir);
  return getSkillVersion(path.join(SKILLS_DIR, name));
}

// Per-hook version from a `// @version x.y.z` comment near the top.
function getHookVersion(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const m = fs.readFileSync(filePath, 'utf8').match(/^\/\/ @version\s+(\S+)\s*$/m);
  return m ? m[1] : null;
}

// "name (1.0.0 → 1.1.0)" for updates, "name (v1.1.0)" for fresh installs.
function withVersion(name, oldV, newV) {
  if (oldV && newV && oldV !== newV) return name + ' (' + oldV + ' → ' + newV + ')';
  if (newV) return name + ' (v' + newV + ')';
  return name;
}

// Collect user-owned files (e.g. .env) from an installed skill dir so they can
// be restored after a fresh copy wipes the directory.
function collectUserDataFiles(dir) {
  const saved = new Map();
  if (!fs.existsSync(dir)) return saved;
  function walk(cur) {
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (USER_DATA_FILENAMES.has(entry.name)) {
        saved.set(path.relative(dir, full), fs.readFileSync(full));
      }
    }
  }
  walk(dir);
  return saved;
}

// Copies a skill to ~/.agents/skills/<name> and creates/updates the symlink at ~/.claude/skills/<name>.
// If a real (non-symlink) directory already exists at the skills path, it is removed first.
// User-owned files (e.g. .env) present in the installed copy are preserved across the update.
const prefixMigrations = new Map();
const installedThisRun = new Set();
let manifestBeforeInstall = {};

function installSkillFiles(name) {
  const installed = installedName(name);
  const agentsSkillDir = path.join(AGENTS_DIR, installed);
  const skillsLinkDir = path.join(SKILLS_DIR, installed);
  const migration = prefixMigrations.get(installed);
  const sourceDir = migration && migration.directory;
  const legacyDir = isRealDir(skillsLinkDir) ? skillsLinkDir : null;
  const userDataFiles = collectUserDataFiles(sourceDir || agentsSkillDir);
  const oldLegacyDir = migration && path.join(SKILLS_DIR, migration.oldName);
  for (const dir of [oldLegacyDir, legacyDir, agentsSkillDir]) {
    if (!dir || !isRealDir(dir)) continue;
    for (const [rel, content] of collectUserDataFiles(dir)) {
      if (userDataFiles.has(rel) && !userDataFiles.get(rel).equals(content)) {
        throw new Error('Conflicting user data at ' + rel + '; both skill copies were preserved');
      }
      userDataFiles.set(rel, content);
    }
  }
  if (migration) backupSkill(migration.oldName);
  if (claimsForeignName(name, manifestBeforeInstall)) backupSkill(installed);
  if (!isSymlink(skillsLinkDir) && fs.existsSync(skillsLinkDir)) {
    fs.rmSync(skillsLinkDir, { recursive: true, force: true });
  }
  copyPackageDir(path.join(PACKAGE_SKILLS_DIR, name), agentsSkillDir);
  for (const [rel, content] of userDataFiles) {
    const dest = path.join(agentsSkillDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  ensureSymlink(agentsSkillDir, skillsLinkDir);
  installedThisRun.add(installed);
}

// Unprefixed mode claims short names — `notify`, `repo-search`, `better-title`
// — that a user may already be using for a skill of their own. The manifest
// records only what this installer put on disk, so an existing directory with
// no entry in it belongs to somebody else. It is copied into the backup dir
// before being replaced, and the name is returned so the caller can say out
// loud whose skill just got taken over.
function claimsForeignName(name, storedChecksums) {
  const installed = installedName(name);
  if (storedChecksums[installed]) return null;    // ours already
  const target = path.join(AGENTS_DIR, installed);
  if (!isRealDir(target) && !isRealDir(path.join(SKILLS_DIR, installed))) return null;
  return installed;
}

// ── Hook setup ─────────────────────────────────────────────────────────────

// Returns true if the hook was added (or would be added in dryRun), false if
// it was already configured. In dryRun mode nothing is written to disk.
function setupStartupHook(dryRun) {
  let settings = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (_) {
      settings = {};
    }
  }

  let adapterAlreadyConfigured = false;
  let legacyDirectUpdater = false;
  if (settings.hooks && settings.hooks.SessionStart) {
    for (const group of settings.hooks.SessionStart) {
      if (group.matcher !== 'startup' || !group.hooks) continue;
      for (const hook of group.hooks) {
        if (hook.command && hook.command.includes('estack-claude-startup.js')) {
          adapterAlreadyConfigured = true;
        }
        if (hook.command && hook.command.includes('elliot-stack@latest --startup')) {
          legacyDirectUpdater = true;
        }
      }
    }
  }

  if (dryRun) return !adapterAlreadyConfigured || legacyDirectUpdater;

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  if (legacyDirectUpdater) {
    for (const group of settings.hooks.SessionStart) {
      if (!group.hooks) continue;
      group.hooks = group.hooks.filter(
        (hook) => !(hook.command && hook.command.includes('elliot-stack@latest --startup'))
      );
    }
  }

  if (adapterAlreadyConfigured) {
    if (legacyDirectUpdater) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    }
    return legacyDirectUpdater;
  }

  let startupGroup = settings.hooks.SessionStart.find(
    (g) => g.matcher === 'startup'
  );
  if (!startupGroup) {
    startupGroup = { matcher: 'startup', hooks: [] };
    settings.hooks.SessionStart.push(startupGroup);
  }

  startupGroup.hooks.push({
    type: 'command',
    command: `node "${path.join(AGENTS_HOOKS_DIR, 'estack-claude-startup.js').replace(/\\/g, '/')}"`,
  });

  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return true;
}

// Returns true if the Codex hook was added (or would be added in dryRun),
// false if it was already configured. In dryRun mode nothing is written.
function setupCodexStartupHook(dryRun) {
  let config = {};
  if (fs.existsSync(CODEX_HOOKS_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CODEX_HOOKS_FILE, 'utf8'));
    } catch (_) {
      config = {};
    }
  }

  let adapterAlreadyConfigured = false;
  let legacyDirectUpdater = false;
  if (config.hooks && config.hooks.SessionStart) {
    for (const group of config.hooks.SessionStart) {
      if (group.matcher !== 'startup' || !group.hooks) continue;
      for (const hook of group.hooks) {
        if (hook.command && hook.command.includes('estack-codex-startup.js')) {
          adapterAlreadyConfigured = true;
        }
        if (hook.command && hook.command.includes('elliot-stack@latest --startup')) {
          legacyDirectUpdater = true;
        }
      }
    }
  }

  if (dryRun) return !adapterAlreadyConfigured || legacyDirectUpdater;

  if (!config.hooks) config.hooks = {};
  if (!config.hooks.SessionStart) config.hooks.SessionStart = [];

  if (legacyDirectUpdater) {
    for (const group of config.hooks.SessionStart) {
      if (!group.hooks) continue;
      group.hooks = group.hooks.filter(
        (hook) => !(hook.command && hook.command.includes('elliot-stack@latest --startup'))
      );
    }
  }

  if (adapterAlreadyConfigured) {
    if (legacyDirectUpdater) {
      fs.mkdirSync(CODEX_DIR, { recursive: true });
      fs.writeFileSync(CODEX_HOOKS_FILE, JSON.stringify(config, null, 2));
    }
    return legacyDirectUpdater;
  }

  let startupGroup = config.hooks.SessionStart.find(
    (group) => group.matcher === 'startup'
  );
  if (!startupGroup) {
    startupGroup = { matcher: 'startup', hooks: [] };
    config.hooks.SessionStart.push(startupGroup);
  }

  startupGroup.hooks.push({
    type: 'command',
    command: `node "${path.join(AGENTS_HOOKS_DIR, 'estack-codex-startup.js').replace(/\\/g, '/')}"`,
    commandWindows: `node "${path.join(AGENTS_HOOKS_DIR, 'estack-codex-startup.js').replace(/\\/g, '/')}"`,
    timeout: 120,
    statusMessage: 'Updating E-Stack skills',
  });

  fs.mkdirSync(CODEX_DIR, { recursive: true });
  fs.writeFileSync(CODEX_HOOKS_FILE, JSON.stringify(config, null, 2));
  return true;
}

// Returns true if the hook was added (or would be added in dryRun), false if
// it was already configured. In dryRun mode nothing is written to disk.
function setupRepoSearchNudgeHook(dryRun) {
  let settings = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (_) {
      settings = {};
    }
  }

  if (settings.hooks && settings.hooks.PostToolUse) {
    for (const group of settings.hooks.PostToolUse) {
      if (group.matcher === 'WebFetch|WebSearch' && group.hooks) {
        for (const hook of group.hooks) {
          if (hook.command && hook.command.includes('repo-search-nudge.js')) {
            return false;
          }
        }
      }
    }
  }

  if (dryRun) return true;

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

  settings.hooks.PostToolUse.push({
    matcher: 'WebFetch|WebSearch',
    hooks: [{
      type: 'command',
      command: `node "${path.join(HOOKS_DIR, 'repo-search-nudge.js').replace(/\\/g, '/')}"`,
      timeout: 5,
    }],
  });

  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return true;
}

// Registers the estack-notify Stop hook. The script ships inside the skill
// (it is PowerShell, and hooks/ is flat .js only), so it is wired from the
// skill's installed location rather than from HOOKS_DIR.
function setupNotifyStopHook(dryRun) {
  // The script's own filename never changes; only the skill folder around it
  // does, when ESTACK_SKILL_PREFIX=none. Flipping the setting repoints this
  // entry in place via the mentionsScript match below.
  const script = path.join(AGENTS_DIR, installedName('estack-notify'), 'scripts', 'estack-notify-stop.ps1')
    .replace(/\\/g, '/');
  // The args form avoids quoting a Windows path inside a command string, and it
  // is the shape Claude Code writes itself.
  const args = ['-NoProfile', '-File', script];

  let settings = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (_) {
      settings = {};
    }
  }

  // A hook can carry its script either inside `command` or split across
  // `args`, so match on both. Checking only `command` appends a duplicate
  // entry next to an args-style hook and leaves the stale one firing.
  const NAMES = ['estack-notify-stop.ps1', 'stop-notify.ps1'];
  const mentionsScript = (hook) => {
    const parts = [hook.command].concat(Array.isArray(hook.args) ? hook.args : []);
    return parts.some((p) => typeof p === 'string' && NAMES.some((n) => p.includes(n)));
  };

  if (settings.hooks && settings.hooks.Stop) {
    for (const group of settings.hooks.Stop) {
      if (!group.hooks) continue;
      for (const hook of group.hooks) {
        if (!mentionsScript(hook)) continue;
        const current = Array.isArray(hook.args) ? hook.args : [];
        if (hook.command === 'powershell.exe' &&
            current.length === args.length &&
            current.every((v, i) => v === args[i])) {
          return false;                       // already correct
        }
        if (dryRun) return true;
        // Repoint in place — a pre-rename or pre-skill install keeps its
        // group and timeout, and never gains a second entry.
        hook.type = 'command';
        hook.command = 'powershell.exe';
        hook.args = args.slice();
        fs.mkdirSync(CLAUDE_DIR, { recursive: true });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
      }
    }
  }

  if (dryRun) return true;

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  settings.hooks.Stop.push({
    hooks: [{ type: 'command', command: 'powershell.exe', args: args.slice(), timeout: 30 }],
  });

  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return true;
}

// Registers (or removes) the estack statusline. Opt-out is honored here so a
// user who declined it never gets it re-registered by an auto-update.
function setupStatuslineHook(dryRun) {
  const script = path.join(HOOKS_DIR, STATUSLINE_FILENAME).replace(/\\/g, '/');
  const command = `node "${script}"`;

  let settings = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (_) {
      settings = {};
    }
  }

  const current = settings.statusLine;
  const isOurs = !!(current && typeof current.command === 'string' &&
    current.command.includes(STATUSLINE_FILENAME));

  if (statuslineOptedOut()) {
    if (!isOurs) return false;            // nothing of ours to remove
    if (dryRun) return true;
    delete settings.statusLine;
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  }

  // Claim the slot exactly once. A first install takes it even if another
  // statusline is configured, so the user actually sees what it does, and
  // their old one is saved next to the other backups. After that the slot is
  // only touched while it is still ours: a user who switches back, or clears
  // it entirely, has said what they want and an update must not re-argue.
  if (!isOurs && STATUSLINE_CLAIMED) return false;

  if (isOurs && current.command === command && current.type === 'command') return false;

  if (dryRun) return true;

  if (!isOurs && current) {
    // Save whatever we are displacing, so it can be restored by hand.
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.writeFileSync(path.join(BACKUP_DIR, 'statusLine.json'),
        JSON.stringify(current, null, 2) + '\n');
    } catch (_) { /* backup is best-effort; never block the install */ }
  }

  settings.statusLine = { type: 'command', command };
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  STATUSLINE_CLAIMED = true;
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 0. Remove deprecated skills (renamed/deleted from the package)
  if (fs.existsSync(SKILLS_DIR) || fs.existsSync(AGENTS_DIR)) {
    const newChecksums0 = fs.existsSync(CHECKSUMS_FILE)
      ? (() => { try { return JSON.parse(fs.readFileSync(CHECKSUMS_FILE, 'utf8')); } catch (_) { return {}; } })()
      : {};
    let changed = false;
    // Both spellings: an install that has been flipped to unprefixed carries
    // these under their short names.
    const deprecated = [];
    for (const name of DEPRECATED_SKILLS) {
      deprecated.push(name);
      const short = installedName(name);
      if (short !== name && newChecksums0[short]) deprecated.push(short);
    }
    for (const name of deprecated) {
      const agentsDir = path.join(AGENTS_DIR, name);
      const skillsDir = path.join(SKILLS_DIR, name);
      let found = false;
      if (!DRY_RUN && (fs.existsSync(agentsDir) || isRealDir(skillsDir))) backupSkill(name);
      if (fs.existsSync(agentsDir)) {
        if (!DRY_RUN) fs.rmSync(agentsDir, { recursive: true, force: true });
        found = true;
      }
      if (fs.existsSync(skillsDir) || isSymlink(skillsDir)) {
        if (!DRY_RUN) {
          try { fs.unlinkSync(skillsDir); } catch (_) { fs.rmSync(skillsDir, { recursive: true, force: true }); }
        }
        found = true;
      }
      if (found) {
        delete newChecksums0[name];
        changed = true;
        if (!SILENT && !STARTUP) {
          console.log((DRY_RUN ? '  [dry run] Would remove deprecated skill: ' : '  Removed deprecated skill: ') + name);
        }
      } else if (newChecksums0[name]) {
        delete newChecksums0[name];
        changed = true;
      }
    }
    if (changed && !DRY_RUN) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
      fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums0, null, 2));
    }
  }

  // 1. Scan package skills
  if (!fs.existsSync(PACKAGE_SKILLS_DIR)) {
    if (!SILENT && !STARTUP) {
      console.error('Error: skills/ directory not found in package. Package may be corrupted.');
    }
    process.exit(1);
  }

  const skillNames = fs.readdirSync(PACKAGE_SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (skillNames.length === 0) {
    if (!SILENT && !STARTUP) console.log('No skills found in package.');
    process.exit(0);
  }

  // The name each skill installs under. Everything past this point that
  // touches disk or the checksum manifest goes through installedName(); only
  // reads from PACKAGE_SKILLS_DIR use the package name.
  const installNames = skillNames.map(installedName);

  // 2. Compute hashes for package skills — of the installed form, so an
  // unprefixed install's on-disk content matches its stored checksum.
  const packageHashes = {};
  for (const name of skillNames) {
    packageHashes[name] = computeSkillHash(path.join(PACKAGE_SKILLS_DIR, name), true);
  }

  // 2b. Scan package hooks
  persistStatuslineChoice(DRY_RUN);
  persistPrefixChoice(DRY_RUN);
  const skipStatusline = statuslineOptedOut();
  const hookFilenames = (fs.existsSync(PACKAGE_HOOKS_DIR)
    ? fs.readdirSync(PACKAGE_HOOKS_DIR).filter((f) => f.endsWith('.js')).sort()
    : []).filter((filename) => !STARTUP_HOOK_FILENAMES.includes(filename))
      .filter((filename) => !(skipStatusline && filename === STATUSLINE_FILENAME));

  // Opting out uninstalls: drop the script and let setupStatuslineHook strip
  // the settings entry, so "off" means gone rather than dormant.
  if (skipStatusline && !DRY_RUN) {
    try { fs.rmSync(path.join(HOOKS_DIR, STATUSLINE_FILENAME), { force: true }); } catch (_) {}
  }

  const packageHookHashes = {};
  for (const filename of hookFilenames) {
    packageHookHashes[filename] = computeFileHash(path.join(PACKAGE_HOOKS_DIR, filename), true);
  }

  const startupSourcesUpdated = syncStartupHookSources(DRY_RUN);

  // 3. Load existing checksums
  let storedChecksums = {};
  if (fs.existsSync(CHECKSUMS_FILE)) {
    try {
      storedChecksums = JSON.parse(fs.readFileSync(CHECKSUMS_FILE, 'utf8'));
    } catch (_) {
      storedChecksums = {};
    }
  }

  // The manifest as it stood before this run. A statusline entry means a
  // previous install already took the slot. --statusline is an explicit
  // request for it back, so it overrides the record and re-claims.
  STATUSLINE_CLAIMED = !process.argv.includes('--statusline') &&
    !!storedChecksums['hook:' + STATUSLINE_FILENAME];

  // 3b. Prune anything the manifest records installing that the package no
  // longer ships. The manifest lists only what this installer put on disk, so
  // removing by it can never touch a skill the user added themselves. This is
  // what actually retires a removed skill — DEPRECATED_SKILLS below only still
  // exists for old installs that predate the manifest recording their names.
  //
  // Hooks are checked against every hook in the package, not the filtered
  // worklist, so opting out of the statusline does not read as a removal and
  // discard the entry the claim check depends on.
  const packagedHooks = fs.existsSync(PACKAGE_HOOKS_DIR)
    ? fs.readdirSync(PACKAGE_HOOKS_DIR)
        .filter((f) => f.endsWith('.js') && !STARTUP_HOOK_FILENAMES.includes(f))
    : [];
  //
  // This is also what reconciles a change to ESTACK_SKILL_PREFIX. The manifest
  // is keyed by installed name, so after a flip the 24 entries from the old
  // naming become migration sources. Installation carries their user data and
  // backs them up; finishPrefixMigrations retires them only after a successful
  // replacement. Silent updates defer migrations that require user review.
  const orphans = Object.keys(storedChecksums).filter((key) => (
    key.startsWith('hook:')
      ? !packagedHooks.includes(key.slice(5))
      : !installNames.includes(key)
  ));

  // A skill leaves the manifest for two very different reasons, and saying
  // "no longer in the package" for both is a lie the user acts on. If the same
  // skill is being reinstalled under the other naming, name where it went —
  // 24 lines of "no longer in the package" reads like the pack was gutted.
  const renamedTo = (key) => {
    const counterpart = key.startsWith(SKILL_PREFIX)
      ? key.slice(SKILL_PREFIX.length)
      : SKILL_PREFIX + key;
    return installNames.includes(counterpart) ? counterpart : null;
  };

  manifestBeforeInstall = Object.assign({}, storedChecksums);
  const foreignNames = skillNames.map((name) => claimsForeignName(name, storedChecksums)).filter(Boolean);
  for (const key of orphans) {
    const next = key.startsWith('hook:') ? null : renamedTo(key);
    if (!next) continue;
    const directory = fs.existsSync(path.join(AGENTS_DIR, key))
      ? path.join(AGENTS_DIR, key) : path.join(SKILLS_DIR, key);
    prefixMigrations.set(next, { oldName: key, directory });
  }

  // Commit the rename only after the destination has been installed successfully.
  function finishPrefixMigrations(checksums) {
    for (const [next, migration] of prefixMigrations) {
      if (!installedThisRun.has(next)) continue;
      for (const root of [SKILLS_DIR, AGENTS_DIR]) {
        const target = path.join(root, migration.oldName);
        if (isSymlink(target)) fs.unlinkSync(target);
        else if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      }
      delete checksums[migration.oldName];
    }
  }

  let renamedCount = 0;
  for (const key of orphans) {
    const isHook = key.startsWith('hook:');
    const targets = isHook
      ? [path.join(HOOKS_DIR, key.slice(5))]
      : [path.join(AGENTS_DIR, key), path.join(SKILLS_DIR, key)];
    const moving = !isHook && renamedTo(key);
    if (!DRY_RUN && !moving) {
      if (!isHook) backupSkill(key);
      for (const target of targets) {
        if (!fs.existsSync(target) && !isSymlink(target)) continue;
        try { fs.rmSync(target, { recursive: true, force: true }); } catch (_) {}
      }
      delete storedChecksums[key];
    }
    const newName = isHook ? null : renamedTo(key);
    if (newName) renamedCount++;
    if (!SILENT && !STARTUP) {
      console.log((newName ? (DRY_RUN ? '  [dry run] Would retire after replacement: ' : '  Pending retirement after replacement: ')
        : (DRY_RUN ? '  [dry run] Would retire: ' : '  Retired: ')) +
        (isHook ? 'hook ' + key.slice(5) : key) +
        (newName ? ' (reinstalling as ' + newName + ')' : ' (no longer in the package)'));
    }
  }
  if (renamedCount > 0 && !SILENT && !STARTUP) {
    console.log('\n  ESTACK_SKILL_PREFIX is ' + (PREFIXED ? "'" + SKILL_PREFIX + "'" : 'none') +
      ', so ' + renamedCount + ' skill' + (renamedCount !== 1 ? 's are' : ' is') +
      ' moving to ' + (PREFIXED ? 'prefixed' : 'short') + ' names. Nothing was removed from the pack.\n');
  }
  if (orphans.length > 0 && !DRY_RUN) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(storedChecksums, null, 2));
  }

  // 4. Detect local modifications and needed updates
  // Real files live in AGENTS_DIR; fall back to SKILLS_DIR for pre-migration installs.
  const modifiedSkills = [];
  const needsUpdate = [];
  for (const name of skillNames) {
    const installed = installedName(name);
    const agentsSkillDir = path.join(AGENTS_DIR, installed);
    let installedDir = null;
    if (fs.existsSync(agentsSkillDir)) {
      installedDir = agentsSkillDir;
    } else {
      const legacyDir = path.join(SKILLS_DIR, installed);
      if (isRealDir(legacyDir)) {
        installedDir = legacyDir; // old-style install, will be migrated on next write
      }
    }
    if (!installedDir) {
      needsUpdate.push(name);
      continue;
    }
    if (foreignNames.includes(installed)) {
      needsUpdate.push(name);
      continue;
    }
    const currentHash = computeSkillHash(installedDir);
    if (!storedChecksums[installed]) {
      // No stored checksum — skill exists but wasn't installed by us.
      // Treat as locally modified if it differs from the package version.
      if (currentHash !== packageHashes[name]) {
        modifiedSkills.push(name);
        needsUpdate.push(name);
      }
    } else if (currentHash !== storedChecksums[installed]) {
      // Stored checksum exists but current doesn't match — user modified it
      modifiedSkills.push(name);
      if (currentHash !== packageHashes[name]) {
        needsUpdate.push(name);
      }
    } else if (currentHash !== packageHashes[name]) {
      // Current matches stored but differs from package — upstream update
      needsUpdate.push(name);
    }
  }

  // 4b. Detect local modifications and needed updates for hooks
  const modifiedHooks = [];
  const hooksNeedingUpdate = [];
  for (const filename of hookFilenames) {
    const installedFile = path.join(HOOKS_DIR, filename);
    const key = 'hook:' + filename;
    if (!fs.existsSync(installedFile)) {
      hooksNeedingUpdate.push(filename);
      continue;
    }
    const currentHash = computeFileHash(installedFile);
    if (!storedChecksums[key]) {
      if (currentHash !== packageHookHashes[filename]) {
        modifiedHooks.push(filename);
        hooksNeedingUpdate.push(filename);
      }
    } else if (currentHash !== storedChecksums[key]) {
      modifiedHooks.push(filename);
      if (storedChecksums[key] !== packageHookHashes[filename]) {
        hooksNeedingUpdate.push(filename);
      }
    } else if (currentHash !== packageHookHashes[filename]) {
      hooksNeedingUpdate.push(filename);
    }
  }

  // 5. Silent mode — no output at all
  if (SILENT) {
    if (needsUpdate.length === 0 && modifiedSkills.length === 0 &&
        hooksNeedingUpdate.length === 0 && modifiedHooks.length === 0 &&
        startupSourcesUpdated.length === 0) {
      process.exit(0);
    }
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    const newChecksums = Object.assign({}, storedChecksums);
    for (const name of skillNames) {
      const installed = installedName(name);
      const migration = prefixMigrations.get(installed);
      if (foreignNames.includes(installed) || (migration &&
          computeSkillHash(migration.directory) !== storedChecksums[migration.oldName])) {
        console.error('estack: kept ' + (migration ? migration.oldName : installed) +
          '; run the installer without --silent to review local changes or a name collision at ' + installed);
        continue;
      }
      if (modifiedSkills.includes(name)) continue;
      if (!needsUpdate.includes(name) && fs.existsSync(path.join(AGENTS_DIR, installedName(name)))) continue;
      installSkillFiles(name);
      newChecksums[installedName(name)] = packageHashes[name];
    }
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    for (const filename of hookFilenames) {
      if (modifiedHooks.includes(filename)) continue;
      if (!hooksNeedingUpdate.includes(filename) && fs.existsSync(path.join(HOOKS_DIR, filename))) continue;
      copyPackageFile(path.join(PACKAGE_HOOKS_DIR, filename), path.join(HOOKS_DIR, filename));
      newChecksums['hook:' + filename] = packageHookHashes[filename];
    }
    finishPrefixMigrations(newChecksums);
    setupRepoSearchNudgeHook();
    setupNotifyStopHook();
    setupStatuslineHook();
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));
    process.exit(0);
  }

  // 6. Startup mode — non-interactive, backup + merge context for Claude Code
  if (STARTUP) {
    if (needsUpdate.length === 0 && modifiedSkills.length === 0 &&
        hooksNeedingUpdate.length === 0 && modifiedHooks.length === 0 &&
        startupSourcesUpdated.length === 0) {
      process.exit(0);
    }

    fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    const newChecksums = Object.assign({}, storedChecksums);
    const updated = [];            // display labels with version transitions
    const mergeNeeded = [];        // plain names (used in merge instructions)
    const mergeNeededLabels = [];  // display labels with version transitions

    for (const name of skillNames) {
      const installed = installedName(name);
      const newV = getSkillVersion(path.join(PACKAGE_SKILLS_DIR, name));
      const migration = prefixMigrations.get(installed);
      if (migration && computeSkillHash(migration.directory) !== storedChecksums[migration.oldName]) {
        mergeNeeded.push(installed);
        mergeNeededLabels.push(migration.oldName + ' → ' + installed);
      }

      if (modifiedSkills.includes(name)) {
        // Backup local version, install new version
        const oldV = getInstalledSkillVersion(installed);
        backupSkill(installed);
        installSkillFiles(name);
        newChecksums[installed] = packageHashes[name];
        mergeNeeded.push(installed);
        mergeNeededLabels.push(withVersion(installed, oldV, newV));
        continue;
      }
      if (!needsUpdate.includes(name) && fs.existsSync(path.join(AGENTS_DIR, installed))) continue;
      const oldV = getInstalledSkillVersion(installed);
      installSkillFiles(name);
      newChecksums[installed] = packageHashes[name];
      updated.push(withVersion(installed, oldV, newV));
    }

    // Install hooks
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    const updatedHooks = [];
    const mergeNeededHooks = [];
    const mergeNeededHookLabels = [];

    for (const filename of hookFilenames) {
      const newV = getHookVersion(path.join(PACKAGE_HOOKS_DIR, filename));
      if (modifiedHooks.includes(filename)) {
        const oldV = getHookVersion(path.join(HOOKS_DIR, filename));
        backupHook(filename);
        copyPackageFile(path.join(PACKAGE_HOOKS_DIR, filename), path.join(HOOKS_DIR, filename));
        newChecksums['hook:' + filename] = packageHookHashes[filename];
        mergeNeededHooks.push(filename);
        mergeNeededHookLabels.push(withVersion(filename, oldV, newV));
        continue;
      }
      if (!hooksNeedingUpdate.includes(filename) && fs.existsSync(path.join(HOOKS_DIR, filename))) continue;
      const oldV = getHookVersion(path.join(HOOKS_DIR, filename));
      copyPackageFile(path.join(PACKAGE_HOOKS_DIR, filename), path.join(HOOKS_DIR, filename));
      newChecksums['hook:' + filename] = packageHookHashes[filename];
      updatedHooks.push(withVersion(filename, oldV, newV));
    }

    setupRepoSearchNudgeHook();
    setupNotifyStopHook();
    setupStatuslineHook();

    finishPrefixMigrations(newChecksums);
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));

    // Build output for Claude Code
    const output = {};
    const msgParts = [];
    if (foreignNames.length) msgParts.push('estack: foreign skills backed up and replaced: ' + foreignNames.join(', '));
    for (const [next, migration] of prefixMigrations) {
      if (installedThisRun.has(next)) msgParts.push('estack: renamed ' + migration.oldName + ' to ' + next +
        '; previous files backed up under ' + BACKUP_DIR);
    }

    if (updated.length > 0) {
      msgParts.push('estack: updated ' + updated.join(', '));
    }

    if (updatedHooks.length > 0) {
      msgParts.push('estack: updated hooks ' + updatedHooks.join(', '));
    }

    if (mergeNeeded.length > 0) {
      const backupPath = BACKUP_DIR.replace(HOME, '~');
      msgParts.push(
        'estack: updated ' + mergeNeededLabels.join(', ') +
        ' (local changes backed up to ' + backupPath + ')'
      );
      output.additionalContext =
        'estack skills were updated but the user had local modifications to: ' +
        mergeNeeded.join(', ') + '. ' +
        'Their previous versions are saved at ' + BACKUP_DIR + '. ' +
        'The new upstream versions are now installed at ' + AGENTS_DIR + ' ' +
        '(symlinked from ' + SKILLS_DIR + '). ' +
        'Offer to merge their customizations from the backup into the updated versions. ' +
        'To merge: read both the backup version and the new version of each skill, ' +
        'identify the user\'s changes, and apply them to the new version where compatible.';
    }

    if (mergeNeededHooks.length > 0) {
      const backupPath = BACKUP_DIR.replace(HOME, '~');
      msgParts.push(
        'estack: updated hooks ' + mergeNeededHookLabels.join(', ') +
        ' (local changes backed up to ' + backupPath + '/hooks/)'
      );
      const existingContext = output.additionalContext ? output.additionalContext + ' ' : '';
      output.additionalContext =
        existingContext +
        'estack hooks were updated but the user had local modifications to: ' +
        mergeNeededHooks.join(', ') + '. ' +
        'Their previous versions are saved at ' + path.join(BACKUP_DIR, 'hooks') + '. ' +
        'The new upstream versions are now installed at ' + HOOKS_DIR + '.';
    }

    if (msgParts.length > 0) {
      output.systemMessage = msgParts.join('\n');
    }

    if (Object.keys(output).length > 0) {
      console.log(JSON.stringify(output));
    }
    process.exit(0);
  }

  // 7. Interactive mode — prompt if modifications detected
  let modifiedAction = null; // 'overwrite', 'skip', or 'merge'

  // Unprefixed mode installs over short names. Anything already sitting on one
  // of them that this installer did not put there is somebody else's skill, so
  // say whose name is being taken rather than folding it silently into the
  // "modified locally" list. It is still backed up and replaced from here.
  if (foreignNames.length > 0) {
    console.log('\nWARNING — ESTACK_SKILL_PREFIX=none installs these skills under names');
    console.log('that already exist and were not installed by estack:');
    for (const name of foreignNames) console.log('    - ' + name);
    console.log('They will be backed up to ' + BACKUP_DIR.replace(HOME, '~') +
      ' and replaced. Re-run with --prefix to keep the estack- names instead.');
  }

  if (modifiedSkills.length > 0 || modifiedHooks.length > 0) {
    console.log('\nThe following items have been modified locally:');
    if (modifiedSkills.length > 0) {
      console.log('  Skills:');
      for (const name of modifiedSkills) {
        console.log('    - ' + installedName(name));
      }
    }
    if (modifiedHooks.length > 0) {
      console.log('  Hooks:');
      for (const filename of modifiedHooks) {
        console.log('    - ' + filename);
      }
    }

    if (DRY_RUN) {
      console.log('\n[dry run] Would prompt: overwrite / skip / merge / abort');
      console.log('[dry run] Showing what would happen with default overwrite...');
      modifiedAction = 'overwrite';
    } else if (NON_INTERACTIVE) {
      // Same treatment --startup gives a modified item: keep a copy, take the
      // shipped version. Without this the prompt reads EOF from a piped or
      // redirected stdin and aborts the whole install.
      modifiedAction = NON_INTERACTIVE_ACTION;
      console.log('\n' + (modifiedAction === 'skip'
        ? 'Keeping local versions (--skip-modified).'
        : 'Backing up local changes, then installing the latest (--yes).'));
    } else {
      console.log('\nChoose an action:');
      console.log('  [o] Overwrite all (replace with latest)');
      console.log('  [s] Skip all (keep local versions)');
      console.log('  [m] Merge (backup local, install new, merge in Claude Code)');
      console.log('  [a] Abort (cancel installation)');
      console.log('');

      const answer = await promptChar('Your choice (o/s/m/a): ');

      if (answer === 'a') {
        console.log('Installation aborted.');
        process.exit(0);
      } else if (answer === 's') {
        modifiedAction = 'skip';
      } else if (answer === 'm') {
        modifiedAction = 'merge';
      } else if (answer === 'o') {
        modifiedAction = 'overwrite';
      } else {
        console.log('Invalid choice. Installation aborted.');
        process.exit(1);
      }
    }
  }

  // 8. Install skills
  if (!DRY_RUN) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
  const newChecksums = Object.assign({}, storedChecksums);
  let installedCount = 0;
  const mergedSkills = [];

  for (const name of skillNames) {
    const installed = installedName(name);
    const isForeign = foreignNames.includes(installed);
    const pending = prefixMigrations.get(installed);
    if (pending && NON_INTERACTIVE_ACTION === 'skip' && process.argv.includes('--skip-modified') &&
        computeSkillHash(pending.directory) !== storedChecksums[pending.oldName]) {
      console.log('  Skipped ' + pending.oldName + ' (local modifications preserved; prefix switch pending)');
      continue;
    }

    if (modifiedSkills.includes(name)) {
      if (modifiedAction === 'skip') {
        console.log('  Skipped ' + installed + ' (local modifications preserved)');
        const currentHash = computeSkillHash(path.join(AGENTS_DIR, installed)) ||
                            computeSkillHash(path.join(SKILLS_DIR, installed));
        if (currentHash && !isForeign) newChecksums[installed] = currentHash;
        continue;
      }
      // A name claimed from someone else is backed up whichever action was
      // chosen — "overwrite" is a choice about estack's own skills, and it
      // should not be what silently destroys a skill estack never installed.
      if (modifiedAction === 'merge' || isForeign) {
        if (!DRY_RUN) backupSkill(installed);
        mergedSkills.push(installed);
        console.log((DRY_RUN ? '  [dry run] Would back up ' : '  Backed up ') + installed + ' → ~/.estack-backup/' + installed);
      }
      // overwrite or merge — fall through to install
    } else if (!needsUpdate.includes(name) && fs.existsSync(path.join(AGENTS_DIR, installed))) {
      // Already installed and up-to-date
      if (DRY_RUN) console.log('  [dry run] Up to date (no change): ' + installed);
      continue;
    }
    const migration = prefixMigrations.get(installed);
    if (migration) console.log((DRY_RUN ? '  [dry run] Would back up ' : '  Backed up ') + migration.oldName +
      ' before switching to ' + installed);
    const isUpdate = fs.existsSync(path.join(AGENTS_DIR, installed)) ||
                     isRealDir(path.join(SKILLS_DIR, installed));
    const label = withVersion(installed,
      isUpdate ? getInstalledSkillVersion(installed) : null,
      getSkillVersion(path.join(PACKAGE_SKILLS_DIR, name)));
    if (!DRY_RUN) installSkillFiles(name);
    newChecksums[installed] = packageHashes[name];
    installedCount++;
    if (DRY_RUN) {
      console.log('  [dry run] Would ' + (isUpdate ? 'update ' : 'install ') + label);
    } else {
      console.log('  Installed ' + label);
    }
  }

  // 8b. Install hooks
  if (!DRY_RUN) fs.mkdirSync(HOOKS_DIR, { recursive: true });
  let installedHookCount = 0;
  const mergedHooks = [];

  for (const filename of hookFilenames) {
    if (modifiedHooks.includes(filename)) {
      if (modifiedAction === 'skip') {
        console.log('  Skipped hook ' + filename + ' (local modifications preserved)');
        const currentHash = computeFileHash(path.join(HOOKS_DIR, filename));
        if (currentHash) newChecksums['hook:' + filename] = currentHash;
        continue;
      }
      if (modifiedAction === 'merge') {
        if (!DRY_RUN) backupHook(filename);
        mergedHooks.push(filename);
        console.log((DRY_RUN ? '  [dry run] Would back up hook ' : '  Backed up hook ') + filename + ' → ~/.estack-backup/hooks/' + filename);
      }
      // overwrite or merge — fall through to install
    } else if (!hooksNeedingUpdate.includes(filename) && fs.existsSync(path.join(HOOKS_DIR, filename))) {
      // Already installed and up-to-date
      if (DRY_RUN) console.log('  [dry run] Up to date (no change): hook ' + filename);
      continue;
    }
    const isHookUpdate = fs.existsSync(path.join(HOOKS_DIR, filename));
    const hookLabel = withVersion(filename,
      isHookUpdate ? getHookVersion(path.join(HOOKS_DIR, filename)) : null,
      getHookVersion(path.join(PACKAGE_HOOKS_DIR, filename)));
    if (!DRY_RUN) copyPackageFile(path.join(PACKAGE_HOOKS_DIR, filename), path.join(HOOKS_DIR, filename));
    newChecksums['hook:' + filename] = packageHookHashes[filename];
    installedHookCount++;
    if (DRY_RUN) {
      console.log('  [dry run] Would ' + (isHookUpdate ? 'update hook ' : 'install hook ') + hookLabel);
    } else {
      console.log('  Installed hook ' + hookLabel);
    }
  }

  // 9. Write checksums
  if (!DRY_RUN) {
    finishPrefixMigrations(newChecksums);
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));
  }

  // 10. Setup Claude and Codex startup hooks plus the Claude repo-search nudge.
  // In dry-run these inspect settings.json read-only and report would-be action.
  const hookInstalled = setupStartupHook(DRY_RUN);
  const codexHookInstalled = setupCodexStartupHook(DRY_RUN);
  const nudgeHookInstalled = setupRepoSearchNudgeHook(DRY_RUN);
  const notifyHookInstalled = setupNotifyStopHook(DRY_RUN);
  const statuslineInstalled = setupStatuslineHook(DRY_RUN);

  // 11. Summary output
  if (DRY_RUN) {
    console.log('\n[dry run] No files were changed. Run with --install to apply.\n');
    console.log('  ' + installedCount + ' skill' + (installedCount !== 1 ? 's' : '') + ' would be installed/updated in ~/.agents/skills/ (linked from ~/.claude/skills/; auto-detected by any agent that reads ~/.agents/skills/)');
    if (installedHookCount > 0) {
      console.log('  ' + installedHookCount + ' hook' + (installedHookCount !== 1 ? 's' : '') + ' would be installed/updated in ~/.claude/hooks/');
    }
    if (startupSourcesUpdated.length > 0) {
      console.log('  ' + startupSourcesUpdated.length + ' shared startup hook file' + (startupSourcesUpdated.length !== 1 ? 's' : '') + ' would be installed/updated in ~/.agents/hooks/');
    }
  } else {
    console.log('\nestack installed successfully!\n');
    console.log('  ' + installedCount + ' skill' + (installedCount !== 1 ? 's' : '') + ' installed to ~/.agents/skills/ (symlinked from ~/.claude/skills/; auto-detected by any agent that reads ~/.agents/skills/)');
    if (installedHookCount > 0) {
      console.log('  ' + installedHookCount + ' hook' + (installedHookCount !== 1 ? 's' : '') + ' installed to ~/.claude/hooks/');
    }
    if (startupSourcesUpdated.length > 0) {
      console.log('  ' + startupSourcesUpdated.length + ' shared startup hook file' + (startupSourcesUpdated.length !== 1 ? 's' : '') + ' installed to ~/.agents/hooks/');
    }
  }
  console.log('');
  console.log('Skills available:');

  for (const name of skillNames) {
    const desc = getSkillDescription(path.join(PACKAGE_SKILLS_DIR, name));
    const ver = getSkillVersion(path.join(PACKAGE_SKILLS_DIR, name));
    // The description names neighbouring skills, so it gets the same rewrite
    // the installed copy did — otherwise the listing advertises /estack-notify
    // on an install where the command is /notify.
    const shown = PREFIXED ? desc : renameReferences(Buffer.from(desc, 'utf8')).toString('utf8');
    console.log('  /' + installedName(name) + (ver ? ' v' + ver : '') + (shown ? ' — ' + shown : ''));
  }

  if (mergedSkills.length > 0) {
    console.log('\nLocal changes backed up for: ' + mergedSkills.join(', '));
    console.log('Ask Claude to merge your changes:');
    console.log('  "Merge my estack changes from ~/.estack-backup/"');
  }

  if (mergedHooks.length > 0) {
    console.log('\nLocal hook changes backed up for: ' + mergedHooks.join(', '));
    console.log('Backed up to ~/.estack-backup/hooks/');
  }

  if (DRY_RUN) {
    if (hookInstalled) {
      console.log('\n[dry run] Would add auto-update hook to ~/.claude/settings.json');
    } else {
      console.log('\nAuto-update hook already configured (no change).');
    }
    if (codexHookInstalled) {
      console.log('[dry run] Would add auto-update hook to ~/.codex/hooks.json');
    } else {
      console.log('Codex auto-update hook already configured (no change).');
    }
    if (nudgeHookInstalled) {
      console.log('[dry run] Would register repo-search nudge hook in settings.json.');
    } else {
      console.log('Repo-search nudge hook already configured (no change).');
    }
  } else {
    if (hookInstalled) {
      console.log('\nAuto-update hook added to ~/.claude/settings.json');
    } else {
      console.log('\nAuto-update hook already configured.');
    }
    if (codexHookInstalled) {
      console.log('Auto-update hook added to ~/.codex/hooks.json');
    } else {
      console.log('Codex auto-update hook already configured.');
    }
    console.log('Skills will update automatically when you start Claude Code or Codex.');
    if (nudgeHookInstalled) {
      console.log('Repo-search nudge hook registered in settings.json.');
    }
  }

  console.log('');
}

main().catch((err) => {
  if (!SILENT && !STARTUP) {
    console.error('Error during installation:', err.message || err);
  }
  process.exit(1);
});
