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
const BACKUP_DIR = path.join(CLAUDE_DIR, '.estack-backup');
const CHECKSUMS_FILE = path.join(CLAUDE_DIR, '.estack-checksums.json');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const PACKAGE_SKILLS_DIR = path.join(__dirname, '..', 'skills');

// ── Flags ──────────────────────────────────────────────────────────────────
const SILENT = process.argv.includes('--silent');
const STARTUP = process.argv.includes('--startup');

// ── Helpers ────────────────────────────────────────────────────────────────

function walkDir(dir, base) {
  base = base || dir;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full, base));
    } else {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

function computeSkillHash(skillDir) {
  if (!fs.existsSync(skillDir)) return null;
  const hash = crypto.createHash('sha256');
  const files = walkDir(skillDir, skillDir);
  for (const relPath of files) {
    const fullPath = path.join(skillDir, relPath);
    const contents = fs.readFileSync(fullPath);
    hash.update(relPath.replace(/\\/g, '/'));
    hash.update(contents);
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
  const installedDir = path.join(SKILLS_DIR, name);
  if (!fs.existsSync(installedDir)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  copyDir(installedDir, path.join(BACKUP_DIR, name));
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
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return '';
  const fm = frontmatterMatch[1];
  const singleLine = fm.match(/^description:\s*(.+)$/m);
  if (singleLine) return singleLine[1].trim();
  const multiLine = fm.match(/^description:\s*>\n((?:\s+.+\n?)+)/m);
  if (multiLine) {
    return multiLine[1].replace(/\s+/g, ' ').trim();
  }
  return '';
}

// ── Startup hook setup ─────────────────────────────────────────────────────

function setupStartupHook() {
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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
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
  const modifiedSkills = [];
  const needsUpdate = [];
  for (const name of skillNames) {
    const installedDir = path.join(SKILLS_DIR, name);
    if (!fs.existsSync(installedDir)) {
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
      if (storedChecksums[name] !== packageHashes[name]) {
        needsUpdate.push(name);
      }
    } else if (currentHash !== packageHashes[name]) {
      // Current matches stored but differs from package — upstream update
      needsUpdate.push(name);
    }
  }

  // 5. Silent mode — no output at all
  if (SILENT) {
    if (needsUpdate.length === 0 && modifiedSkills.length === 0) {
      process.exit(0);
    }
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    const newChecksums = Object.assign({}, storedChecksums);
    for (const name of skillNames) {
      if (modifiedSkills.includes(name)) continue;
      if (!needsUpdate.includes(name) && fs.existsSync(path.join(SKILLS_DIR, name))) continue;
      copyDir(path.join(PACKAGE_SKILLS_DIR, name), path.join(SKILLS_DIR, name));
      newChecksums[name] = packageHashes[name];
    }
    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));
    process.exit(0);
  }

  // 6. Startup mode — non-interactive, backup + merge context for Claude Code
  if (STARTUP) {
    if (needsUpdate.length === 0 && modifiedSkills.length === 0) {
      process.exit(0);
    }

    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    const newChecksums = Object.assign({}, storedChecksums);
    const updated = [];
    const mergeNeeded = [];

    for (const name of skillNames) {
      if (modifiedSkills.includes(name)) {
        // Backup local version, install new version
        backupSkill(name);
        copyDir(path.join(PACKAGE_SKILLS_DIR, name), path.join(SKILLS_DIR, name));
        newChecksums[name] = packageHashes[name];
        mergeNeeded.push(name);
        continue;
      }
      if (!needsUpdate.includes(name) && fs.existsSync(path.join(SKILLS_DIR, name))) continue;
      copyDir(path.join(PACKAGE_SKILLS_DIR, name), path.join(SKILLS_DIR, name));
      newChecksums[name] = packageHashes[name];
      updated.push(name);
    }

    fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));

    // Build output for Claude Code
    const output = {};
    const msgParts = [];

    if (updated.length > 0) {
      msgParts.push('estack: updated ' + updated.join(', '));
    }

    if (mergeNeeded.length > 0) {
      const backupPath = BACKUP_DIR.replace(HOME, '~');
      msgParts.push(
        'estack: updated ' + mergeNeeded.join(', ') +
        ' (local changes backed up to ' + backupPath + ')'
      );
      output.additionalContext =
        'estack skills were updated but the user had local modifications to: ' +
        mergeNeeded.join(', ') + '. ' +
        'Their previous versions are saved at ' + BACKUP_DIR + '. ' +
        'The new upstream versions are now installed at ' + SKILLS_DIR + '. ' +
        'Offer to merge their customizations from the backup into the updated versions. ' +
        'To merge: read both the backup version and the new version of each skill, ' +
        'identify the user\'s changes, and apply them to the new version where compatible.';
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

  if (modifiedSkills.length > 0) {
    console.log('\nThe following skills have been modified locally:');
    for (const name of modifiedSkills) {
      console.log('  - ' + name);
    }
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

  // 8. Install skills
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  const newChecksums = Object.assign({}, storedChecksums);
  let installedCount = 0;
  const mergedSkills = [];

  for (const name of skillNames) {
    if (modifiedSkills.includes(name)) {
      if (modifiedAction === 'skip') {
        console.log('  Skipped estack:' + name + ' (local modifications preserved)');
        const currentHash = computeSkillHash(path.join(SKILLS_DIR, name));
        if (currentHash) newChecksums[name] = currentHash;
        continue;
      }
      if (modifiedAction === 'merge') {
        backupSkill(name);
        mergedSkills.push(name);
        console.log('  Backed up estack:' + name + ' → ~/.claude/.estack-backup/' + name);
      }
      // overwrite or merge — fall through to install
    } else if (!needsUpdate.includes(name) && fs.existsSync(path.join(SKILLS_DIR, name))) {
      // Already installed and up-to-date
      continue;
    }
    copyDir(path.join(PACKAGE_SKILLS_DIR, name), path.join(SKILLS_DIR, name));
    newChecksums[name] = packageHashes[name];
    installedCount++;
    console.log('  Installed estack:' + name);
  }

  // 9. Write checksums
  fs.writeFileSync(CHECKSUMS_FILE, JSON.stringify(newChecksums, null, 2));

  // 10. Setup startup hook
  const hookInstalled = setupStartupHook();

  // 11. Summary output
  console.log('\nestack installed successfully!\n');
  console.log('  ' + installedCount + ' skill' + (installedCount !== 1 ? 's' : '') + ' installed to ~/.claude/skills/\n');
  console.log('Skills available:');

  for (const name of skillNames) {
    const desc = getSkillDescription(path.join(PACKAGE_SKILLS_DIR, name));
    console.log('  /estack:' + name + (desc ? ' — ' + desc : ''));
  }

  if (mergedSkills.length > 0) {
    console.log('\nLocal changes backed up for: ' + mergedSkills.join(', '));
    console.log('Ask Claude to merge your changes:');
    console.log('  "Merge my estack changes from ~/.claude/.estack-backup/"');
  }

  if (hookInstalled) {
    console.log('\nAuto-update hook added to ~/.claude/settings.json');
    console.log('Skills will update automatically when you start Claude Code.');
  } else {
    console.log('\nAuto-update hook already configured.');
  }
  console.log('');
}

main().catch((err) => {
  if (!SILENT && !STARTUP) {
    console.error('Error during installation:', err.message || err);
  }
  process.exit(1);
});
