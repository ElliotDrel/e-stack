'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/*
 * =============================================================================
 * CLAUDE CODE CHAT HISTORY MIGRATION SCRIPT
 * =============================================================================
 *
 * PURPOSE:
 *   When you rename or move a local repo folder, Claude Code loses track of
 *   your chat history because it keys project data on the folder path. This
 *   script migrates all chat history from the old project directory to the new
 *   one, rewriting every internal path reference so Claude Code treats the
 *   history as belonging to the new location.
 *
 * WHAT IT DOES:
 *   - Copies all session files (.jsonl), subagent logs, tool results, and
 *     memory files from the old Claude Code project dir to the new one
 *   - Finds and replaces 9 path encoding variants (JSON-escaped backslash,
 *     forward slash, MSYS/Git Bash, hyphenated project dir name, plain
 *     backslash — each in upper/lowercase drive letter variants)
 *   - Merges sessions-index.json entries (if one exists)
 *   - Runs a post-migration verification scan for any missed references
 *   - Never overwrites files that already exist in the new project dir
 *
 * FULL PROCESS (do these steps in order):
 *
 *   1. RENAME ON GITHUB (if applicable):
 *      - Go to repo Settings > General > rename, or use:
 *        gh repo rename new-name --yes
 *
 *   2. RENAME LOCAL FOLDER(S):
 *      - Rename the repo folder (and parent if needed) to the new name
 *      - This is just a folder rename — git history, branches, uncommitted
 *        changes, stashes all survive because .git/ is inside the folder
 *
 *   3. UPDATE GIT REMOTE URL:
 *      - cd into the renamed folder and run:
 *        git remote set-url origin https://github.com/OWNER/NEW-REPO-NAME.git
 *
 *   4. START A NEW CLAUDE CODE SESSION IN THE NEW FOLDER:
 *      - cd into the renamed folder and run: claude
 *      - Say anything, then exit. This makes Claude Code create the new
 *        project directory structure under ~/.claude/projects/
 *      - This step is important — the script needs the new project dir to
 *        already exist so it merges into the right place
 *
 *   5. CONFIGURE AND RUN THIS SCRIPT:
 *      - Set OLD_REPO_PATH to the ORIGINAL folder path (before rename)
 *      - Set NEW_REPO_PATH to the NEW folder path (after rename)
 *      - Optionally set CLAUDE_DIR if your .claude dir is non-standard
 *      - Run: node migrate-claude-history.js --dry-run   (preview first)
 *      - Run: node migrate-claude-history.js              (execute)
 *
 *      OR override via CLI flags (no constant edits needed):
 *        node migrate-claude-history.js \
 *          --old-repo "C:\path\to\old" \
 *          --new-repo "C:\path\to\new" \
 *          [--session <uuid>] \
 *          [--dry-run]
 *
 *      SINGLE-SESSION MODE (--session <uuid-or-filename>):
 *        Migrate just one .jsonl session file instead of the entire project
 *        directory. Useful when you want to move a single conversation to a
 *        different project (e.g. it logically belongs to a sub-project).
 *        Skips sessions-index merging; only verifies the one transformed file.
 *        The UUID can be the bare id ("db151ec9-...") or the full filename
 *        ("db151ec9-...jsonl").
 *
 *   6. VERIFY:
 *      - Open Claude Code in the new folder
 *      - Run /resume — your old chat history should appear
 *      - The script prints a verification report; 0 stale refs = clean
 *      - NOTE: "stale reference" warnings for the project name appearing in
 *        conversation TEXT (not metadata) are false positives and harmless
 *
 *   7. CLEANUP (optional):
 *      - Delete the old project dir: ~/.claude/projects/<old-project-dir>
 *      - Delete any backup you made
 *
 * PATH ENCODING VARIANTS (auto-generated from the two paths you provide):
 *   A) C:\\Users\\name\\old\\repo    -> C:\\Users\\name\\new\\repo    (JSON-escaped backslash, uppercase drive)
 *   B) c:\\Users\\name\\old\\repo    -> c:\\Users\\name\\new\\repo    (JSON-escaped backslash, lowercase drive)
 *   C) C:/Users/name/old/repo       -> C:/Users/name/new/repo       (forward slash, uppercase)
 *   D) c--Users-name-old-repo       -> c--Users-name-new-repo       (project dir name, lowercase)
 *   E) /c/Users/name/old/repo       -> /c/Users/name/new/repo       (MSYS/Git Bash path)
 *   F) C--Users-name-old-repo       -> C--Users-name-new-repo       (project dir name, uppercase)
 *   G) c:/Users/name/old/repo       -> c:/Users/name/new/repo       (forward slash, lowercase)
 *   H) C:\Users\name\old\repo       -> C:\Users\name\new\repo       (plain backslash, uppercase)
 *   I) c:\Users\name\old\repo       -> c:\Users\name\new\repo       (plain backslash, lowercase)
 *
 *   Patterns are sorted longest-first to prevent partial matches.
 *
 * REQUIREMENTS:
 *   - Node.js (no external dependencies)
 *   - Windows (paths are Windows-specific; the script validates this)
 *
 * =============================================================================
 *
 * CONFIGURATION — edit these three values:
 */
const OLD_REPO_PATH = String.raw`C:\Users\2supe\All Coding\Elliot's Skills\elliot-skills`;
const NEW_REPO_PATH = String.raw`C:\Users\2supe\All Coding\E-Stack\e-stack`;
const CLAUDE_DIR = path.join(os.homedir(), '.claude');

const HELP_TEXT = `
Usage:
  node migrate-claude-history.js [options]

Options:
  --old-repo <path>     Override OLD_REPO_PATH constant (absolute Windows path)
  --new-repo <path>     Override NEW_REPO_PATH constant (absolute Windows path)
  --session <id>        Single-session mode: migrate only one .jsonl file
                        (UUID with or without ".jsonl" suffix). Skips
                        sessions-index merging.
  --dry-run             Show what would happen without writing any files
  --no-migration-note   Do NOT append a "this session was migrated" note to
                        each migrated .jsonl. STRONGLY DISCOURAGED. The note
                        tells future-you (and Claude on /resume) that file
                        paths in the transcript were rewritten and may not
                        exist on disk. Without it, you can waste real time
                        debugging missing-file errors that are expected
                        side-effects of the rewrite. Only pass this if you
                        actually moved every file the transcript references
                        to the new location.
  --help, -h            Show this help

Examples:
  # Migrate entire project (uses OLD_REPO_PATH/NEW_REPO_PATH constants)
  node migrate-claude-history.js --dry-run
  node migrate-claude-history.js

  # Migrate a single session to a different project, with CLI overrides
  node migrate-claude-history.js \\
    --old-repo "C:\\Users\\me\\Projects\\workspace" \\
    --new-repo "C:\\Users\\me\\Projects\\workspace\\sub-project" \\
    --session db151ec9-eae7-422e-be9c-3591f012e45b \\
    --dry-run
`.trim();

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const config = buildConfig({
    oldRepoPath: args.oldRepo || OLD_REPO_PATH,
    newRepoPath: args.newRepo || NEW_REPO_PATH,
    claudeDir: CLAUDE_DIR,
    dryRun: args.dryRun,
    sessionFilter: args.session,
    appendMigrationNote: !args.noMigrationNote,
  });

  runMigration(config);
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const flagsWithValues = new Set(['--old-repo', '--new-repo', '--session']);
  const knownBooleanFlags = new Set(['--dry-run', '--help', '-h', '--no-migration-note']);

  const result = {
    dryRun: false,
    help: false,
    oldRepo: null,
    newRepo: null,
    session: null,
    noMigrationNote: false,
  };
  const unknownArgs = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }

    if (arg === '--no-migration-note') {
      result.noMigrationNote = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }

    // Handle --flag=value form
    const eqIndex = arg.indexOf('=');
    if (eqIndex > 0) {
      const flagName = arg.slice(0, eqIndex);
      const flagValue = arg.slice(eqIndex + 1);
      if (flagsWithValues.has(flagName)) {
        assignFlagValue(result, flagName, flagValue);
        continue;
      }
    }

    // Handle --flag value form
    if (flagsWithValues.has(arg)) {
      const nextValue = args[i + 1];
      if (typeof nextValue !== 'string' || knownBooleanFlags.has(nextValue) || flagsWithValues.has(nextValue)) {
        throw new Error(`Flag ${arg} requires a value.\n\n${HELP_TEXT}`);
      }
      assignFlagValue(result, arg, nextValue);
      i += 1;
      continue;
    }

    unknownArgs.push(arg);
  }

  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(', ')}\n\n${HELP_TEXT}`);
  }

  return result;
}

function assignFlagValue(result, flagName, value) {
  if (flagName === '--old-repo') result.oldRepo = value;
  else if (flagName === '--new-repo') result.newRepo = value;
  else if (flagName === '--session') result.session = value;
}

function buildConfig(options) {
  const oldRepo = parseWindowsRepoPath(options.oldRepoPath, 'OLD_REPO_PATH');
  const newRepo = parseWindowsRepoPath(options.newRepoPath, 'NEW_REPO_PATH');

  if (oldRepo.normalized.toLowerCase() === newRepo.normalized.toLowerCase()) {
    throw new Error('OLD_REPO_PATH and NEW_REPO_PATH must be different.');
  }

  const claudeDir = path.resolve(expandHomePath(options.claudeDir));
  const projectsRoot = path.join(claudeDir, 'projects');
  const oldProjectNames = buildProjectDirNames(oldRepo);
  const newProjectNames = buildProjectDirNames(newRepo);
  const replacementPairs = buildReplacementPairs(oldRepo, newRepo);

  return {
    dryRun: Boolean(options.dryRun),
    claudeDir,
    projectsRoot,
    oldRepo,
    newRepo,
    oldProjectNames,
    newProjectNames,
    replacementPairs,
    sessionFilter: normalizeSessionFilter(options.sessionFilter),
    appendMigrationNote: options.appendMigrationNote !== false,
  };
}

function normalizeSessionFilter(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('--session must be a non-empty UUID or filename.');
  }
  const trimmed = value.trim();
  return trimmed.toLowerCase().endsWith('.jsonl') ? trimmed : `${trimmed}.jsonl`;
}

function runMigration(config, deps = {}) {
  const activeFs = deps.fs || fs;

  if (!activeFs.existsSync(config.projectsRoot)) {
    throw new Error(`Claude projects directory does not exist: ${config.projectsRoot}`);
  }

  const oldProjectDir = resolveExistingOldProjectDir(
    config.projectsRoot,
    config.oldProjectNames,
    activeFs,
  );
  const newProjectDir = resolveNewProjectDir(
    config.projectsRoot,
    config.newProjectNames,
    activeFs,
  );
  const summary = createSummary(config.replacementPairs, config.dryRun);

  if (!activeFs.statSync(oldProjectDir).isDirectory()) {
    throw new Error(`Old Claude project directory is not a directory: ${oldProjectDir}`);
  }

  printHeader(config, oldProjectDir, newProjectDir, activeFs);
  ensureDirectory(newProjectDir, config.dryRun, summary, activeFs);

  let filesToCopy = collectFiles(oldProjectDir, activeFs)
    .filter((filePath) => path.basename(filePath) !== 'sessions-index.json');

  if (config.sessionFilter) {
    // sessionFilter is "<uuid>.jsonl". The matching sidecar directory is
    // "<uuid>/" (subagent transcripts, etc.) — include all files under it.
    const sessionId = config.sessionFilter.replace(/\.jsonl$/i, '');
    const sidecarDir = path.join(oldProjectDir, sessionId);
    const sidecarPrefix = sidecarDir + path.sep;
    const matched = filesToCopy.filter((filePath) => (
      path.basename(filePath) === config.sessionFilter
      || filePath === sidecarDir
      || filePath.startsWith(sidecarPrefix)
    ));
    if (matched.length === 0) {
      throw new Error(
        `Single-session mode: file "${config.sessionFilter}" not found in old project dir.\n  ${oldProjectDir}`,
      );
    }
    const sidecarCount = matched.length - matched.filter((p) => path.basename(p) === config.sessionFilter).length;
    filesToCopy = matched;
    console.log(`Single-session mode: migrating ${config.sessionFilter}` + (sidecarCount > 0 ? ` + ${sidecarCount} sidecar file(s)` : ''));
  }

  const copiedDestinations = [];
  for (const sourcePath of filesToCopy) {
    const relativePath = path.relative(oldProjectDir, sourcePath);
    const destinationPath = path.join(newProjectDir, relativePath);

    if (activeFs.existsSync(destinationPath)) {
      summary.filesSkipped += 1;
      continue;
    }

    copyAndTransformFile(
      sourcePath,
      destinationPath,
      config.replacementPairs,
      config.dryRun,
      summary,
      activeFs,
    );
    summary.filesCopied += 1;
    copiedDestinations.push(destinationPath);
  }

  if (!config.sessionFilter) {
    mergeSessionsIndex({
      oldProjectDir,
      newProjectDir,
      replacementPairs: config.replacementPairs,
      newRepo: config.newRepo,
      dryRun: config.dryRun,
      summary,
      fs: activeFs,
    });
  } else {
    console.log('Single-session mode: skipping sessions-index.json merge.');
  }

  // Append a migration note to every top-level session .jsonl we just wrote.
  // This is on by default (and strongly recommended). Subagent sidecar
  // .jsonl files are intentionally excluded — Claude only reads the main
  // session file on /resume, so that's the only place the note matters.
  if (config.appendMigrationNote) {
    const sessionJsonlDestinations = copiedDestinations.filter(
      (destPath) => path.dirname(destPath) === newProjectDir && destPath.toLowerCase().endsWith('.jsonl'),
    );
    for (const destPath of sessionJsonlDestinations) {
      appendMigrationNote({
        filePath: destPath,
        oldRepo: config.oldRepo,
        newRepo: config.newRepo,
        dryRun: config.dryRun,
        summary,
        fs: activeFs,
      });
    }
  } else {
    console.log('--no-migration-note set: skipping migration-note append (NOT RECOMMENDED).');
  }

  printSummary(summary, config.replacementPairs);

  // Post-migration verification: check for any remaining old path references.
  // In single-session mode, only check the file(s) we just wrote; otherwise
  // scan the whole new project dir.
  const verifyRoot = config.sessionFilter
    ? { type: 'files', paths: copiedDestinations }
    : { type: 'dir', path: newProjectDir };
  const staleCount = verifyNoStaleReferences(verifyRoot, config.oldRepo, activeFs);
  if (staleCount > 0) {
    console.log('');
    console.log(`WARNING: Found ${staleCount} file(s) in the new project dir that still contain old path references.`);
    console.log('These may need manual review.');
  } else if (!config.dryRun) {
    console.log('');
    console.log('Verification: no remaining old path references found in migrated files.');
  }

  return {
    config,
    oldProjectDir,
    newProjectDir,
    summary,
  };
}

function createSummary(replacementPairs, dryRun) {
  return {
    dryRun,
    filesCopied: 0,
    filesSkipped: 0,
    indexEntriesMerged: 0,
    indexEntriesSkipped: 0,
    migrationNotesAppended: 0,
    migrationNotesSkipped: 0,
    createdDirectories: new Set(),
    replacementsByPattern: Object.fromEntries(
      replacementPairs.map((pair) => [pair.label, 0]),
    ),
  };
}

function resolveNewProjectDir(projectsRoot, projectNames, activeFs = fs) {
  // Check both casings — use whichever already exists, preferring uppercase
  // (Claude Code on Windows creates uppercase C-- dirs)
  const upperDir = path.join(projectsRoot, projectNames.upper);
  const lowerDir = path.join(projectsRoot, projectNames.lower);

  if (activeFs.existsSync(upperDir) && activeFs.statSync(upperDir).isDirectory()) {
    return upperDir;
  }

  if (activeFs.existsSync(lowerDir) && activeFs.statSync(lowerDir).isDirectory()) {
    return lowerDir;
  }

  // Neither exists — default to uppercase (matches Claude Code's convention on Windows)
  return upperDir;
}

function printHeader(config, oldProjectDir, newProjectDir, activeFs) {
  console.log(config.dryRun ? 'DRY RUN: no files will be written.' : 'Migrating Claude history...');
  console.log(`Old repo path: ${config.oldRepo.normalized}`);
  console.log(`New repo path: ${config.newRepo.normalized}`);
  console.log(`Claude dir:    ${config.claudeDir}`);
  console.log(`Old project:   ${oldProjectDir}`);
  console.log(`New project:   ${newProjectDir}`);
}

function parseWindowsRepoPath(input, variableName) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error(`${variableName} must be a non-empty absolute Windows path.`);
  }

  const normalized = stripTrailingSlashes(path.win32.normalize(input.trim()));
  const match = /^([A-Za-z]):[\\/](.+)$/.exec(normalized);

  if (!match) {
    throw new Error(
      `${variableName} must be an absolute Windows path like C:\\Users\\name\\repo. Received: ${input}`,
    );
  }

  const drive = match[1];
  const segments = match[2].split(/[\\/]+/).filter(Boolean);

  if (segments.length === 0) {
    throw new Error(`${variableName} must point to a project directory, not a drive root.`);
  }

  return {
    normalized: `${drive.toUpperCase()}:\\${segments.join('\\')}`,
    driveUpper: drive.toUpperCase(),
    driveLower: drive.toLowerCase(),
    segments,
  };
}

function expandHomePath(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    throw new Error('CLAUDE_DIR must be a non-empty path.');
  }

  if (inputPath === '~') {
    return os.homedir();
  }

  if (inputPath.startsWith(`~${path.sep}`) || inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

function stripTrailingSlashes(input) {
  return input.replace(/[\\/]+$/, '');
}

function buildProjectDirNames(repoPath) {
  return {
    lower: toHyphenatedProjectDirName(repoPath, 'lower'),
    upper: toHyphenatedProjectDirName(repoPath, 'upper'),
  };
}

function toWindowsPath(repoPath, driveCase) {
  const drive = driveCase === 'lower' ? repoPath.driveLower : repoPath.driveUpper;
  return `${drive}:\\${repoPath.segments.join('\\')}`;
}

function toJsonEscapedBackslashPath(repoPath, driveCase) {
  const drive = driveCase === 'lower' ? repoPath.driveLower : repoPath.driveUpper;
  return `${drive}:\\\\${repoPath.segments.join('\\\\')}`;
}

function toForwardSlashPath(repoPath, driveCase) {
  const drive = driveCase === 'lower' ? repoPath.driveLower : repoPath.driveUpper;
  return `${drive}:/${repoPath.segments.join('/')}`;
}

function toMsysPath(repoPath) {
  return `/${repoPath.driveLower}/${repoPath.segments.join('/')}`;
}

function toHyphenatedProjectDirName(repoPath, driveCase) {
  return toWindowsPath(repoPath, driveCase).replace(/:/g, '-').replace(/[\\/ ']/g, '-');
}

function buildReplacementPairs(oldRepo, newRepo) {
  const pairs = [
    {
      key: 'A',
      description: 'Windows backslash uppercase drive, JSON-escaped',
      oldValue: toJsonEscapedBackslashPath(oldRepo, 'upper'),
      newValue: toJsonEscapedBackslashPath(newRepo, 'upper'),
    },
    {
      key: 'B',
      description: 'Windows backslash lowercase drive, JSON-escaped',
      oldValue: toJsonEscapedBackslashPath(oldRepo, 'lower'),
      newValue: toJsonEscapedBackslashPath(newRepo, 'lower'),
    },
    {
      key: 'C',
      description: 'Forward slash uppercase drive',
      oldValue: toForwardSlashPath(oldRepo, 'upper'),
      newValue: toForwardSlashPath(newRepo, 'upper'),
    },
    {
      key: 'D',
      description: 'Project directory name lowercase drive',
      oldValue: toHyphenatedProjectDirName(oldRepo, 'lower'),
      newValue: toHyphenatedProjectDirName(newRepo, 'lower'),
    },
    {
      key: 'E',
      description: 'MSYS/Git Bash path',
      oldValue: toMsysPath(oldRepo),
      newValue: toMsysPath(newRepo),
    },
    {
      key: 'F',
      description: 'Project directory name uppercase drive',
      oldValue: toHyphenatedProjectDirName(oldRepo, 'upper'),
      newValue: toHyphenatedProjectDirName(newRepo, 'upper'),
    },
    {
      key: 'G',
      description: 'Forward slash lowercase drive',
      oldValue: toForwardSlashPath(oldRepo, 'lower'),
      newValue: toForwardSlashPath(newRepo, 'lower'),
    },
    {
      key: 'H',
      description: 'Windows backslash uppercase drive (plain)',
      oldValue: toWindowsPath(oldRepo, 'upper'),
      newValue: toWindowsPath(newRepo, 'upper'),
    },
    {
      key: 'I',
      description: 'Windows backslash lowercase drive (plain)',
      oldValue: toWindowsPath(oldRepo, 'lower'),
      newValue: toWindowsPath(newRepo, 'lower'),
    },
  ];

  return pairs
    .slice()
    .sort((left, right) => right.oldValue.length - left.oldValue.length)
    .map((pair) => ({
      ...pair,
      label: `${pair.key}) ${pair.description}`,
    }));
}

function resolveExistingOldProjectDir(projectsRoot, projectNames, activeFs = fs) {
  const candidates = [
    path.join(projectsRoot, projectNames.lower),
    path.join(projectsRoot, projectNames.upper),
  ];

  for (const candidate of candidates) {
    if (activeFs.existsSync(candidate) && activeFs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find old Claude project directory.\nChecked:\n- ${candidates.join('\n- ')}`,
  );
}

function collectFiles(rootDir, activeFs = fs) {
  const files = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.pop();
    const entries = activeFs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function ensureDirectory(directoryPath, dryRun, summary, activeFs = fs) {
  if (activeFs.existsSync(directoryPath)) {
    return;
  }

  if (!dryRun) {
    activeFs.mkdirSync(directoryPath, { recursive: true });
  }

  summary.createdDirectories.add(directoryPath);
}

function copyAndTransformFile(
  sourcePath,
  destinationPath,
  replacementPairs,
  dryRun,
  summary,
  activeFs = fs,
) {
  ensureDirectory(path.dirname(destinationPath), dryRun, summary, activeFs);

  const sourceBuffer = activeFs.readFileSync(sourcePath);

  if (!isProbablyTextFile(sourceBuffer)) {
    if (!dryRun) {
      activeFs.writeFileSync(destinationPath, sourceBuffer);
    }
    return;
  }

  const sourceText = sourceBuffer.toString('utf8');
  const transformed = applyReplacementPairs(sourceText, replacementPairs);
  addReplacementCounts(summary, transformed.counts);

  if (!dryRun) {
    activeFs.writeFileSync(destinationPath, transformed.text, 'utf8');
  }
}

function isProbablyTextFile(buffer) {
  return buffer.indexOf(0) === -1;
}

function applyReplacementPairs(text, replacementPairs) {
  let nextText = text;
  const counts = Object.fromEntries(replacementPairs.map((pair) => [pair.label, 0]));

  for (const pair of replacementPairs) {
    const result = replaceAllLiteral(nextText, pair.oldValue, pair.newValue);
    nextText = result.text;
    counts[pair.label] += result.count;
  }

  return { text: nextText, counts };
}

function replaceAllLiteral(text, search, replacement) {
  if (search === '') {
    return { text, count: 0 };
  }

  let count = 0;
  let cursor = 0;
  let output = '';

  while (true) {
    const index = text.indexOf(search, cursor);

    if (index === -1) {
      output += text.slice(cursor);
      break;
    }

    output += text.slice(cursor, index);
    output += replacement;
    cursor = index + search.length;
    count += 1;
  }

  return { text: output, count };
}

function addReplacementCounts(summary, counts) {
  for (const [label, count] of Object.entries(counts)) {
    summary.replacementsByPattern[label] += count;
  }
}

function mergeSessionsIndex(options) {
  const {
    oldProjectDir,
    newProjectDir,
    replacementPairs,
    newRepo,
    dryRun,
    summary,
    fs: activeFs = fs,
  } = options;

  const oldIndexPath = path.join(oldProjectDir, 'sessions-index.json');
  const newIndexPath = path.join(newProjectDir, 'sessions-index.json');

  if (!activeFs.existsSync(oldIndexPath)) {
    return;
  }

  const oldIndex = normalizeSessionsIndexShape(readJsonFile(oldIndexPath, activeFs), oldIndexPath);
  const newIndex = activeFs.existsSync(newIndexPath)
    ? normalizeSessionsIndexShape(readJsonFile(newIndexPath, activeFs), newIndexPath)
    : { version: numberOrDefault(oldIndex.version, 1), entries: [] };

  const mergedEntries = newIndex.entries.slice();
  const seenKeys = new Set();

  for (const entry of mergedEntries) {
    addIndexEntryKeys(seenKeys, entry);
  }

  for (const entry of oldIndex.entries) {
    const transformed = transformSessionsIndexEntry(entry, replacementPairs, newRepo);
    addReplacementCounts(summary, transformed.counts);

    const entryKeys = getIndexEntryKeys(transformed.entry);
    const isDuplicate = entryKeys.some((key) => seenKeys.has(key));

    if (isDuplicate) {
      summary.indexEntriesSkipped += 1;
      continue;
    }

    mergedEntries.push(transformed.entry);
    entryKeys.forEach((key) => seenKeys.add(key));
    summary.indexEntriesMerged += 1;
  }

  const mergedIndex = {
    ...newIndex,
    version: Math.max(numberOrDefault(newIndex.version, 1), numberOrDefault(oldIndex.version, 1)),
    entries: mergedEntries,
  };

  // Update originalPath at root level if it references the old path
  if (typeof mergedIndex.originalPath === 'string') {
    const transformedOriginal = applyReplacementPairs(mergedIndex.originalPath, replacementPairs);
    mergedIndex.originalPath = transformedOriginal.text;
    addReplacementCounts(summary, transformedOriginal.counts);
  }

  if (!dryRun) {
    activeFs.writeFileSync(newIndexPath, `${JSON.stringify(mergedIndex, null, 2)}\n`, 'utf8');
  }
}

function readJsonFile(filePath, activeFs = fs) {
  try {
    return JSON.parse(activeFs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse JSON at ${filePath}: ${error.message}`);
  }
}

function normalizeSessionsIndexShape(value, filePath) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected sessions-index.json shape at ${filePath}: expected an object.`);
  }

  if (!Array.isArray(value.entries)) {
    throw new Error(`Unexpected sessions-index.json shape at ${filePath}: missing "entries" array.`);
  }

  return value;
}

function transformSessionsIndexEntry(entry, replacementPairs, newRepo) {
  const clone = entry && typeof entry === 'object'
    ? JSON.parse(JSON.stringify(entry))
    : {};
  const totalCounts = Object.fromEntries(replacementPairs.map((pair) => [pair.label, 0]));

  if (typeof clone.fullPath === 'string') {
    const transformedFullPath = applyReplacementPairs(clone.fullPath, replacementPairs);
    clone.fullPath = transformedFullPath.text;
    accumulateCounts(totalCounts, transformedFullPath.counts);
  }

  if (typeof clone.projectPath === 'string' && clone.projectPath.trim() !== '') {
    const rewrittenProjectPath = rewriteProjectPath(clone.projectPath, replacementPairs, newRepo);
    clone.projectPath = rewrittenProjectPath.text;
    accumulateCounts(totalCounts, rewrittenProjectPath.counts);
  } else {
    clone.projectPath = toWindowsPath(newRepo, 'upper');
  }

  // Transform all other string fields (firstPrompt, name, summary, etc.)
  // that may contain old path references
  const handledFields = new Set(['fullPath', 'projectPath']);
  for (const [key, value] of Object.entries(clone)) {
    if (handledFields.has(key) || typeof value !== 'string') continue;
    const transformed = applyReplacementPairs(value, replacementPairs);
    if (transformed.text !== value) {
      clone[key] = transformed.text;
      accumulateCounts(totalCounts, transformed.counts);
    }
  }

  return { entry: clone, counts: totalCounts };
}

function rewriteProjectPath(currentValue, replacementPairs, newRepo) {
  const transformed = applyReplacementPairs(currentValue, replacementPairs);

  if (transformed.text !== currentValue) {
    return transformed;
  }

  let fallbackText;

  if (/^\/[A-Za-z]\//.test(currentValue)) {
    fallbackText = toMsysPath(newRepo);
  } else if (/^[a-z]:\//.test(currentValue)) {
    fallbackText = toForwardSlashPath(newRepo, 'lower');
  } else if (/^[A-Z]:\//.test(currentValue)) {
    fallbackText = toForwardSlashPath(newRepo, 'upper');
  } else if (/^[a-z]:\\/.test(currentValue)) {
    fallbackText = toWindowsPath(newRepo, 'lower');
  } else {
    fallbackText = toWindowsPath(newRepo, 'upper');
  }

  return {
    text: fallbackText,
    counts: transformed.counts,
  };
}

function accumulateCounts(target, source) {
  for (const [label, count] of Object.entries(source)) {
    target[label] += count;
  }
}

function addIndexEntryKeys(targetSet, entry) {
  for (const key of getIndexEntryKeys(entry)) {
    targetSet.add(key);
  }
}

function getIndexEntryKeys(entry) {
  const keys = [];

  if (entry && typeof entry === 'object') {
    if (typeof entry.sessionId === 'string' && entry.sessionId !== '') {
      keys.push(`sessionId:${entry.sessionId}`);
    }

    if (typeof entry.fullPath === 'string' && entry.fullPath !== '') {
      keys.push(`fullPath:${entry.fullPath}`);
    }
  }

  return keys;
}

function numberOrDefault(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function appendMigrationNote({ filePath, oldRepo, newRepo, dryRun, summary, fs: activeFs = fs }) {
  if (!activeFs.existsSync(filePath)) {
    if (dryRun) {
      console.log(`  [dry-run] would append migration note to ${path.basename(filePath)}`);
      if (summary) summary.migrationNotesAppended += 1;
    }
    return;
  }

  const existingText = activeFs.readFileSync(filePath, 'utf8');
  const lines = existingText.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    if (summary) summary.migrationNotesSkipped += 1;
    return;
  }

  // Don't double-append if a migration note is already the last user entry.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch (_) {
      continue;
    }
    const content = entry && entry.message && entry.message.content;
    if (typeof content === 'string' && content.includes('<session-migration-note>')) {
      if (summary) summary.migrationNotesSkipped += 1;
      console.log(`  Migration note already present in ${path.basename(filePath)} — not re-appending.`);
      return;
    }
    // Only check the last few entries — bail if we go too far back
    if (lines.length - i > 5) break;
  }

  // Find the last entry that has a uuid so we can chain off it.
  let lastWithUuid = null;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry && typeof entry.uuid === 'string' && entry.uuid !== '') {
        lastWithUuid = entry;
        break;
      }
    } catch (_) {
      // skip unparseable
    }
  }

  if (!lastWithUuid) {
    if (summary) summary.migrationNotesSkipped += 1;
    console.log(`  No uuid-bearing entry found in ${path.basename(filePath)} — skipping migration note.`);
    return;
  }

  const sessionId = lastWithUuid.sessionId || path.basename(filePath, '.jsonl');
  const nowIso = new Date().toISOString();
  const oldPath = toWindowsPath(oldRepo, 'upper');
  const newPath = toWindowsPath(newRepo, 'upper');

  const noteText = [
    '<session-migration-note>',
    `This session was originally recorded in project ${oldPath} and was`,
    `migrated on ${nowIso} to project ${newPath}.`,
    '',
    'During the migration, every occurrence of the old project path was',
    'rewritten to the new project path throughout this transcript (cwd',
    'fields, tool inputs, tool outputs, and conversation text). The rewrite',
    'is correct for paths whose files now live at the new location. For',
    'paths whose files actually still live at the old location, the rewrite',
    'produced a reference that does not exist on disk.',
    '',
    'If you hit a missing-file error while resuming this session, try the',
    `original path (${oldPath}\\...) instead of the rewritten path`,
    `(${newPath}\\...), or search the parent directory for the filename.`,
    '</session-migration-note>',
  ].join('\n');

  const newEntry = {
    parentUuid: lastWithUuid.uuid,
    isSidechain: false,
    promptId: crypto.randomUUID(),
    type: 'user',
    message: { role: 'user', content: noteText },
    uuid: crypto.randomUUID(),
    timestamp: nowIso,
    userType: 'external',
    entrypoint: 'cli',
    cwd: newPath,
    sessionId,
    version: lastWithUuid.version || '',
    gitBranch: lastWithUuid.gitBranch || '',
  };

  if (dryRun) {
    console.log(`  [dry-run] would append migration note to ${path.basename(filePath)}`);
    if (summary) summary.migrationNotesAppended += 1;
    return;
  }

  // Append on a new line; preserve trailing newline shape
  const separator = existingText.endsWith('\n') ? '' : '\n';
  activeFs.appendFileSync(filePath, separator + JSON.stringify(newEntry) + '\n', 'utf8');
  if (summary) summary.migrationNotesAppended += 1;
  console.log(`  Appended migration note to ${path.basename(filePath)}`);
}

function verifyNoStaleReferences(scope, oldRepo, activeFs = fs) {
  const searchStrings = [
    toJsonEscapedBackslashPath(oldRepo, 'upper'),
    toJsonEscapedBackslashPath(oldRepo, 'lower'),
    toWindowsPath(oldRepo, 'upper'),
    toWindowsPath(oldRepo, 'lower'),
    toForwardSlashPath(oldRepo, 'upper'),
    toForwardSlashPath(oldRepo, 'lower'),
    toMsysPath(oldRepo),
    toHyphenatedProjectDirName(oldRepo, 'lower'),
    toHyphenatedProjectDirName(oldRepo, 'upper'),
  ];

  let files;
  let baseDir;
  if (scope && scope.type === 'files') {
    files = scope.paths.filter((p) => activeFs.existsSync(p));
    baseDir = null;
  } else if (scope && scope.type === 'dir') {
    files = collectFiles(scope.path, activeFs);
    baseDir = scope.path;
  } else {
    // Back-compat: caller passed a raw directory path
    files = collectFiles(scope, activeFs);
    baseDir = scope;
  }

  let staleFileCount = 0;

  for (const filePath of files) {
    const buffer = activeFs.readFileSync(filePath);
    if (!isProbablyTextFile(buffer)) continue;

    const text = buffer.toString('utf8');
    for (const search of searchStrings) {
      if (text.includes(search)) {
        const displayPath = baseDir ? path.relative(baseDir, filePath) : filePath;
        console.log(`  Stale reference in: ${displayPath} (matches: ${search.slice(0, 40)}...)`);
        staleFileCount += 1;
        break;
      }
    }
  }

  return staleFileCount;
}

function printSummary(summary, replacementPairs) {
  console.log('');
  console.log('Summary');
  console.log(`Files copied: ${summary.filesCopied}`);
  console.log(`Files skipped (already exist): ${summary.filesSkipped}`);
  console.log(`sessions-index entries merged: ${summary.indexEntriesMerged}`);
  console.log(`sessions-index entries skipped: ${summary.indexEntriesSkipped}`);
  console.log(`Migration notes appended: ${summary.migrationNotesAppended}`);
  if (summary.migrationNotesSkipped > 0) {
    console.log(`Migration notes skipped (already present / no anchor): ${summary.migrationNotesSkipped}`);
  }

  if (summary.createdDirectories.size > 0) {
    console.log(`Directories created: ${summary.createdDirectories.size}`);
  }

  console.log('Replacements by pattern:');
  for (const pair of replacementPairs) {
    console.log(`  ${pair.label}: ${summary.replacementsByPattern[pair.label]}`);
  }
}

module.exports = {
  HELP_TEXT,
  OLD_REPO_PATH,
  NEW_REPO_PATH,
  CLAUDE_DIR,
  main,
  parseArgs,
  buildConfig,
  runMigration,
  parseWindowsRepoPath,
  expandHomePath,
  buildProjectDirNames,
  toWindowsPath,
  toJsonEscapedBackslashPath,
  toForwardSlashPath,
  toMsysPath,
  toHyphenatedProjectDirName,
  buildReplacementPairs,
  resolveExistingOldProjectDir,
  resolveNewProjectDir,
  collectFiles,
  ensureDirectory,
  copyAndTransformFile,
  isProbablyTextFile,
  applyReplacementPairs,
  replaceAllLiteral,
  mergeSessionsIndex,
  readJsonFile,
  normalizeSessionsIndexShape,
  transformSessionsIndexEntry,
  rewriteProjectPath,
  getIndexEntryKeys,
  numberOrDefault,
  verifyNoStaleReferences,
  appendMigrationNote,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
