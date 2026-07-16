#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline');

// ── Paths ──────────────────────────────────────────────────────────────────
const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const AGENTS_ROOT = path.join(HOME, '.agents');
const AGENTS_DIR = path.join(AGENTS_ROOT, 'skills');
const BACKUP_DIR = path.join(HOME, '.estack-backup');
const CHECKSUMS_FILE = path.join(CLAUDE_DIR, '.estack-checksums.json');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const PACKAGE_SKILLS_DIR = path.join(__dirname, '..', 'skills');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const PACKAGE_HOOKS_DIR = path.join(__dirname, '..', 'hooks');

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

// ── Flags ──────────────────────────────────────────────────────────────────
const SILENT = process.argv.includes('--silent');
const STARTUP = process.argv.includes('--startup');
// When run directly from the repo (not via npx/node_modules), default to dry-run
// so local testing never silently clobbers the live ~/.claude/skills install.
// Pass --install to actually write files, or --dry-run to force preview mode.
const IS_LOCAL = !__dirname.includes('node_modules');
const DRY_RUN = process.argv.includes('--dry-run') ||
  (IS_LOCAL && !process.argv.includes('--install'));

// ── Deprecated skills ──────────────────────────────────────────────────────
// Skills that were renamed or removed. The installer removes these on every
// run so users don't end up with both the old and new name installed.
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
    } else if (!HASH_IGNORE_EXTS.has(path.extname(entry.name))) {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

function computeFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  const raw = fs.readFileSync(filePath);
  hash.update(Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n')));
  return hash.digest('hex');
}

function computeSkillHash(skillDir) {
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
    const raw = fs.readFileSync(fullPath);
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

function backupSkill(name) {
  const agentsDir = path.join(AGENTS_DIR, name);
  const installedDir = fs.existsSync(agentsDir) ? agentsDir : path.join(SKILLS_DIR, name);
  if (!fs.existsSync(installedDir)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  copyDir(installedDir, path.join(BACKUP_DIR, name));
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
function installSkillFiles(name) {
  const agentsSkillDir = path.join(AGENTS_DIR, name);
  const skillsLinkDir = path.join(SKILLS_DIR, name);
  if (!isSymlink(skillsLinkDir) && fs.existsSync(skillsLinkDir)) {
    fs.rmSync(skillsLinkDir, { recursive: true, force: true });
  }
  const userDataFiles = collectUserDataFiles(agentsSkillDir);
  copyDir(path.join(PACKAGE_SKILLS_DIR, name), agentsSkillDir);
  for (const [rel, content] of userDataFiles) {
    const dest = path.join(agentsSkillDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  ensureSymlink(agentsSkillDir, skillsLinkDir);
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

  if (settings.hooks && settings.hooks.SessionStart) {
    const existing = settings.hooks.SessionStart;
    for (const group of existing) {
      if (group.matcher === 'startup' && group.hooks) {
        for (const hook of group.hooks) {
          if (hook.command && hook.command.includes('elliot-stack@latest --startup')) {
            return false;
          }
        }
      }
    }
  }

  if (dryRun) return true;

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  let startupGroup = settings.hooks.SessionStart.find(
    (g) => g.matcher === 'startup'
  );
  if (!startupGroup) {
    startupGroup = { matcher: 'startup', hooks: [] };
    settings.hooks.SessionStart.push(startupGroup);
  }

  startupGroup.hooks.push({
    type: 'command',
    command: 'npx --yes elliot-stack@latest --startup',
  });

  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 0. Remove deprecated skills (renamed/deleted from the package)
  if (fs.existsSync(SKILLS_DIR) || fs.existsSync(AGENTS_DIR)) {
    const newChecksums0 = fs.existsSync(CHECKSUMS_FILE)
      ? (() => { try { return JSON.parse(fs.readFileSync(CHECKSUMS_FILE, 'utf8')); } catch (_) { return {}; } })()
      : {};
    let changed = false;
    for (const name of DEPRECATED_SKILLS) {
      const agentsDir = path.join(AGENTS_DIR, name);
      const skillsDir = path.join(SKILLS_DIR, name);
      let found = false;
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

  // 2. Compute hashes for package skills
  const packageHashes = {};
  for (const name of skillNames) {
    packageHashes[name] = computeSkillHash(path.join(PACKAGE_SKILLS_DIR, name));
  }

  // 2b. Scan package hooks
  const hookFilenames = fs.existsSync(PACKAGE_HOOKS_DIR)
    ? fs.readdirSync(PACKAGE_HOOKS_DIR).filter((f) => f.endsWith('.js')).sort()
    : [];

  const packageHookHashes = {};
  for (const filename of hookFilenames) {
    packageHookHashes[filename] = computeFileHash(path.join(PACKAGE_HOOKS_DIR, filename));
  }

  // 3. Load existing checksums
  let storedChecksums = {};
  if (fs.existsSync(CHECKSUMS_FILE)) {
    try {
      storedChecksums = JSON.parse(fs.readFileSync(CHECKSUMS_FILE, 'utf8'));
    } catch (_) {
      storedChecksums = {};
    }
  }

  // 4. Detect local modifications and needed updates
  // Real files live in AGENTS_DIR; fall back to SKILLS_DIR for pre-migration installs.
  const modifiedSkills = [];
  const needsUpdate = [];
  for (const name of skillNames) {
    const agentsSkillDir = path.join(AGENTS_DIR, name);
    let installedDir = null;
    if (fs.existsSync(agentsSkillDir)) {
      installedDir = agentsSkillDir;
    } else {
      const legacyDir = path.join(SKILLS_DIR, name);
      if (isRealDir(legacyDir)) {
        installedDir = legacyDir; // old-style install, will be migrated on next write
      }
    }
    if (!installedDir) {
      needsUpdate.push(name);
      continue;
    }
    const currentHash = computeSkillHash(installedDir);
    if (!storedChecksums[name]) {
      // No stored checksum — skill exists but wasn't installed by us.
      // Treat as locally modified if it differs from the package version.
      if (currentHash !== packageHashes[name]) {
        modifiedSkills.push(name);
        needsUpdate.push(name);
      }
    } else if (currentHash !== storedChecksums[name]) {
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
        hooksNeedingUpdate.length === 0 && modifiedHooks.length === 0) {
      process.exit(0);
    }
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    const newChecksums = Object.assign({}, storedChecksums);
    for (const name of skillNames) {
      if (modifiedSkills.includes(name)) continue;
      if (!needsUpdate.includes(name) && fs.existsSync(path.join(AGENTS_DIR, name))) continue;
      installSkillFiles(name);
      newChecksums[name] = packageHashes[name];
    }
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    for (const filename of hookFilenames) {
      if (modifiedHooks.includes(filename)) continue;
      if (!hooksNeedingUpdate.includes(filename) && fs.existsSync(path.join(HOOKS_DIR, filename))) continue;
      fs.copyFileSync(path.join(PACKAGE_HOOKS_DIR, filename), path.join(HOOKS_DIR, filename));
      newChecksums['hook:' + filename] = packageHookHashes[filename];
    }
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));
    process.exit(0);
  }

  // 6. Startup mode — non-interactive, backup + merge context for Claude Code
  if (STARTUP) {
    if (needsUpdate.length === 0 && modifiedSkills.length === 0 &&
        hooksNeedingUpdate.length === 0 && modifiedHooks.length === 0) {
      process.exit(0);
    }

    fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    const newChecksums = Object.assign({}, storedChecksums);
    const updated = [];            // display labels with version transitions
    const mergeNeeded = [];        // plain names (used in merge instructions)
    const mergeNeededLabels = [];  // display labels with version transitions

    for (const name of skillNames) {
      const newV = getSkillVersion(path.join(PACKAGE_SKILLS_DIR, name));
      if (modifiedSkills.includes(name)) {
        // Backup local version, install new version
        const oldV = getInstalledSkillVersion(name);
        backupSkill(name);
        installSkillFiles(name);
        newChecksums[name] = packageHashes[name];
        mergeNeeded.push(name);
        mergeNeededLabels.push(withVersion(name, oldV, newV));
        continue;
      }
      if (!needsUpdate.includes(name) && fs.existsSync(path.join(AGENTS_DIR, name))) continue;
      const oldV = getInstalledSkillVersion(name);
      installSkillFiles(name);
      newChecksums[name] = packageHashes[name];
      updated.push(withVersion(name, oldV, newV));
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
        fs.copyFileSync(path.join(PACKAGE_HOOKS_DIR, filename), path.join(HOOKS_DIR, filename));
        newChecksums['hook:' + filename] = packageHookHashes[filename];
        mergeNeededHooks.push(filename);
        mergeNeededHookLabels.push(withVersion(filename, oldV, newV));
        continue;
      }
      if (!hooksNeedingUpdate.includes(filename) && fs.existsSync(path.join(HOOKS_DIR, filename))) continue;
      const oldV = getHookVersion(path.join(HOOKS_DIR, filename));
      fs.copyFileSync(path.join(PACKAGE_HOOKS_DIR, filename), path.join(HOOKS_DIR, filename));
      newChecksums['hook:' + filename] = packageHookHashes[filename];
      updatedHooks.push(withVersion(filename, oldV, newV));
    }

    setupRepoSearchNudgeHook();

    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));

    // Build output for Claude Code
    const output = {};
    const msgParts = [];

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

  if (modifiedSkills.length > 0 || modifiedHooks.length > 0) {
    console.log('\nThe following items have been modified locally:');
    if (modifiedSkills.length > 0) {
      console.log('  Skills:');
      for (const name of modifiedSkills) {
        console.log('    - ' + name);
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
    if (modifiedSkills.includes(name)) {
      if (modifiedAction === 'skip') {
        console.log('  Skipped ' + name + ' (local modifications preserved)');
        const currentHash = computeSkillHash(path.join(AGENTS_DIR, name)) ||
                            computeSkillHash(path.join(SKILLS_DIR, name));
        if (currentHash) newChecksums[name] = currentHash;
        continue;
      }
      if (modifiedAction === 'merge') {
        if (!DRY_RUN) backupSkill(name);
        mergedSkills.push(name);
        console.log((DRY_RUN ? '  [dry run] Would back up ' : '  Backed up ') + name + ' → ~/.estack-backup/' + name);
      }
      // overwrite or merge — fall through to install
    } else if (!needsUpdate.includes(name) && fs.existsSync(path.join(AGENTS_DIR, name))) {
      // Already installed and up-to-date
      if (DRY_RUN) console.log('  [dry run] Up to date (no change): ' + name);
      continue;
    }
    const isUpdate = fs.existsSync(path.join(AGENTS_DIR, name)) ||
                     isRealDir(path.join(SKILLS_DIR, name));
    const label = withVersion(name,
      isUpdate ? getInstalledSkillVersion(name) : null,
      getSkillVersion(path.join(PACKAGE_SKILLS_DIR, name)));
    if (!DRY_RUN) installSkillFiles(name);
    newChecksums[name] = packageHashes[name];
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
    if (!DRY_RUN) fs.copyFileSync(path.join(PACKAGE_HOOKS_DIR, filename), path.join(HOOKS_DIR, filename));
    newChecksums['hook:' + filename] = packageHookHashes[filename];
    installedHookCount++;
    if (DRY_RUN) {
      console.log('  [dry run] Would ' + (isHookUpdate ? 'update hook ' : 'install hook ') + hookLabel);
    } else {
      console.log('  Installed hook ' + hookLabel);
    }
  }

  // 9. Write checksums
  if (!DRY_RUN) fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));

  // 10. Setup startup hook and repo-search nudge hook
  // In dry-run these inspect settings.json read-only and report would-be action.
  const hookInstalled = setupStartupHook(DRY_RUN);
  const nudgeHookInstalled = setupRepoSearchNudgeHook(DRY_RUN);

  // 11. Summary output
  if (DRY_RUN) {
    console.log('\n[dry run] No files were changed. Run with --install to apply.\n');
    console.log('  ' + installedCount + ' skill' + (installedCount !== 1 ? 's' : '') + ' would be installed/updated in ~/.agents/skills/ (linked from ~/.claude/skills/; auto-detected by any agent that reads ~/.agents/skills/)');
    if (installedHookCount > 0) {
      console.log('  ' + installedHookCount + ' hook' + (installedHookCount !== 1 ? 's' : '') + ' would be installed/updated in ~/.claude/hooks/');
    }
  } else {
    console.log('\nestack installed successfully!\n');
    console.log('  ' + installedCount + ' skill' + (installedCount !== 1 ? 's' : '') + ' installed to ~/.agents/skills/ (symlinked from ~/.claude/skills/; auto-detected by any agent that reads ~/.agents/skills/)');
    if (installedHookCount > 0) {
      console.log('  ' + installedHookCount + ' hook' + (installedHookCount !== 1 ? 's' : '') + ' installed to ~/.claude/hooks/');
    }
  }
  console.log('');
  console.log('Skills available:');

  for (const name of skillNames) {
    const desc = getSkillDescription(path.join(PACKAGE_SKILLS_DIR, name));
    const ver = getSkillVersion(path.join(PACKAGE_SKILLS_DIR, name));
    console.log('  /' + name + (ver ? ' v' + ver : '') + (desc ? ' — ' + desc : ''));
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
    if (nudgeHookInstalled) {
      console.log('[dry run] Would register repo-search nudge hook in settings.json.');
    } else {
      console.log('Repo-search nudge hook already configured (no change).');
    }
  } else {
    if (hookInstalled) {
      console.log('\nAuto-update hook added to ~/.claude/settings.json');
      console.log('Skills will update automatically when you start Claude Code.');
    } else {
      console.log('\nAuto-update hook already configured.');
    }
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
