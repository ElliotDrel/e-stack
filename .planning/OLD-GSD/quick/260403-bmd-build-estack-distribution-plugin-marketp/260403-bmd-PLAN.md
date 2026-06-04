---
phase: 260403-bmd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
  - skills/better-title/SKILL.md
  - skills/better-title/scripts/rename.sh
  - skills/chris-voss/SKILL.md
  - skills/chris-voss/references/elliot-notes.md
  - skills/chris-voss/references/voss-principles.md
  - skills/github-issues-update/SKILL.md
  - skills/github-issues-update/setup.md
  - skills/github-issues-update/tracker-template.md
  - skills/github-issues-update/references/gh-cli-patterns.md
  - skills/github-issues-update/references/overview-template.md
  - skills/github-issues-update/references/tracker-schema.md
  - skills/github-issues-update/references/result-file-schema.md
  - skills/github-issues-update/workflows/check-issues.md
  - skills/github-issues-update/workflows/save-issues.md
  - skills/github-issues-update/bin/tracker-tools.cjs
  - sync.sh
  - package.json
  - bin/install.cjs
  - CLAUDE.md
autonomous: false
requirements: [ESTACK-01, ESTACK-02, ESTACK-03]

must_haves:
  truths:
    - "Repo has skills/ directory with all 3 skills moved into it"
    - "Plugin marketplace works: claude --plugin-dir . loads skills as /estack:better-title etc"
    - "npx estack@latest copies skills to ~/.claude/skills/ with checksums"
    - "Installer detects local modifications and prompts before overwriting"
    - "Installer sets up Claude Code startup hook for auto-updates"
  artifacts:
    - path: ".claude-plugin/plugin.json"
      provides: "Plugin manifest with estack namespace"
      contains: '"name": "estack"'
    - path: ".claude-plugin/marketplace.json"
      provides: "Marketplace catalog listing all skills"
      contains: '"plugins"'
    - path: "skills/better-title/SKILL.md"
      provides: "Relocated skill with estack: prefix"
      contains: "name: estack:better-title"
    - path: "package.json"
      provides: "npm package definition for npx estack@latest"
      contains: '"name": "estack"'
    - path: "bin/install.cjs"
      provides: "npx installer with checksum detection and startup hook setup"
      min_lines: 50
  key_links:
    - from: ".claude-plugin/marketplace.json"
      to: "skills/*/SKILL.md"
      via: "relative source paths"
      pattern: '"source": "./skills/'
    - from: "package.json"
      to: "bin/install.cjs"
      via: "bin field"
      pattern: '"bin".*"estack"'
    - from: "bin/install.cjs"
      to: "skills/"
      via: "copies skill directories to ~/.claude/skills/"
      pattern: "skills/"
---

<objective>
Build dual distribution for the elliot-skills repo: a Claude Code plugin marketplace (`.claude-plugin/`) with `estack` namespace, and an npx installer (`npx estack@latest`) that copies skills to `~/.claude/skills/` with local change detection and auto-update startup hook.

Purpose: Enable skill distribution via both Claude Code's native plugin system and a standalone npx installer for users who prefer direct skill installation.
Output: Restructured repo with plugin marketplace config, npm package with installer CLI, updated sync.sh.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/quick/260403-bmd-build-estack-distribution-plugin-marketp/260403-bmd-CONTEXT.md
@sync.sh
@better-title/SKILL.md
@chris-voss/SKILL.md
@github-issues-update/SKILL.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restructure repo and create plugin marketplace</name>
  <files>
    skills/better-title/SKILL.md, skills/better-title/scripts/rename.sh,
    skills/chris-voss/SKILL.md, skills/chris-voss/references/elliot-notes.md, skills/chris-voss/references/voss-principles.md,
    skills/github-issues-update/SKILL.md, skills/github-issues-update/setup.md, skills/github-issues-update/tracker-template.md,
    skills/github-issues-update/references/gh-cli-patterns.md, skills/github-issues-update/references/overview-template.md,
    skills/github-issues-update/references/tracker-schema.md, skills/github-issues-update/references/result-file-schema.md,
    skills/github-issues-update/workflows/check-issues.md, skills/github-issues-update/workflows/save-issues.md,
    skills/github-issues-update/bin/tracker-tools.cjs,
    .claude-plugin/plugin.json, .claude-plugin/marketplace.json,
    sync.sh, CLAUDE.md
  </files>
  <action>
    **Move skills into skills/ directory:**
    1. Create `skills/` directory at repo root
    2. Move `better-title/`, `chris-voss/`, `github-issues-update/` into `skills/` (use `git mv` to preserve history)
    3. Delete the now-empty top-level skill directories

    **Add estack: prefix to all SKILL.md name fields:**
    - `skills/better-title/SKILL.md`: change `name: better-title` to `name: estack:better-title`
    - `skills/chris-voss/SKILL.md`: change `name: chris-voss` to `name: estack:chris-voss`
    - `skills/github-issues-update/SKILL.md`: change `name: github-issues-update` to `name: estack:github-issues-update`

    **Create plugin manifest** at `.claude-plugin/plugin.json`:
    ```json
    {
      "name": "estack",
      "description": "Elliot's skill collection for Claude Code — negotiation, GitHub tracking, session management, and more",
      "version": "1.0.0",
      "author": {
        "name": "Elliot Drel"
      },
      "repository": "https://github.com/elliot-drel/elliot-skills",
      "license": "MIT"
    }
    ```
    Note: The `name` field "estack" becomes the plugin namespace, so skills are invoked as `/estack:better-title`, `/estack:chris-voss`, `/estack:github-issues-update`.

    **Create marketplace catalog** at `.claude-plugin/marketplace.json`:
    ```json
    {
      "name": "estack",
      "owner": {
        "name": "Elliot Drel"
      },
      "metadata": {
        "description": "Elliot's skill stack for Claude Code"
      },
      "plugins": [
        {
          "name": "estack",
          "source": ".",
          "description": "Elliot's skill collection — negotiation, GitHub tracking, session management"
        }
      ]
    }
    ```
    This is a single-plugin marketplace — the repo IS the plugin. The marketplace wraps it for discoverability.

    **Update sync.sh:**
    - Update `REPO_DIR` logic: skill directories are now under `$REPO_DIR/skills/`
    - Change the skill existence check from `$REPO_DIR/$skill_name` to `$REPO_DIR/skills/$skill_name`
    - Change the copy source from `$skill_dir` to `$REPO_DIR/skills/$skill_name`
    - Keep the REGISTERED_SKILLS array the same (skill names stay the same for local sync)

    **Update CLAUDE.md:**
    - Update "Repo layout" section to reflect new `skills/` directory structure
    - Update the diff command example to use `skills/<skill-name>` path
    - Update the sync instructions to note skills live in `skills/` subdirectory
  </action>
  <verify>
    <automated>ls skills/better-title/SKILL.md skills/chris-voss/SKILL.md skills/github-issues-update/SKILL.md .claude-plugin/plugin.json .claude-plugin/marketplace.json && grep -q "estack:better-title" skills/better-title/SKILL.md && grep -q "estack:chris-voss" skills/chris-voss/SKILL.md && grep -q "estack:github-issues-update" skills/github-issues-update/SKILL.md && echo "PASS"</automated>
  </verify>
  <done>All 3 skills moved to skills/ directory with estack: prefix on name fields. Plugin manifest and marketplace.json created. sync.sh updated to reference skills/ subdirectory. CLAUDE.md updated.</done>
</task>

<task type="auto">
  <name>Task 2: Build npx installer with change detection and auto-update hook</name>
  <files>package.json, bin/install.cjs</files>
  <action>
    **Create package.json** at repo root:
    ```json
    {
      "name": "estack",
      "version": "1.0.0",
      "description": "Elliot's skill stack for Claude Code — install via npx estack@latest",
      "bin": {
        "estack": "bin/install.cjs"
      },
      "files": [
        "bin/",
        "skills/"
      ],
      "keywords": ["claude-code", "skills", "claude", "ai"],
      "author": "Elliot Drel",
      "license": "MIT",
      "repository": {
        "type": "git",
        "url": "https://github.com/elliot-drel/elliot-skills"
      }
    }
    ```
    Note: The `files` array ensures only `bin/` and `skills/` are included in the npm package. No dev files, no `.planning/`, no `.claude-plugin/`.

    **Create bin/install.cjs** — the npx installer script. Must use CommonJS (`.cjs`) for broad Node compatibility. Add `#!/usr/bin/env node` shebang.

    The installer does the following:

    1. **Determine paths:**
       - `SKILLS_DIR` = `~/.claude/skills/`
       - `CHECKSUMS_FILE` = `~/.claude/.estack-checksums.json`
       - `PACKAGE_SKILLS_DIR` = `path.join(__dirname, '..', 'skills')` (relative to bin/)
       - `HOOKS_FILE` = `~/.claude/settings.local.json` (for startup hook — actually store in user settings)

    2. **Scan package skills:**
       - Read all subdirectories of PACKAGE_SKILLS_DIR
       - For each skill, compute SHA-256 hash of all files (recursively) concatenated
       - Build a map: `{ "better-title": "abc123...", "chris-voss": "def456...", ... }`

    3. **Check for local modifications:**
       - Load existing checksums from CHECKSUMS_FILE (if exists)
       - For each skill that exists in SKILLS_DIR AND has a checksum in the file:
         - Recompute hash of the currently installed files
         - If current hash !== stored checksum, the skill was locally modified
       - Collect all modified skill names into a list

    4. **Prompt if modifications detected:**
       - If modified skills exist, print:
         ```
         The following skills have been modified locally:
           - better-title
           - chris-voss

         Choose an action:
           [o] Overwrite all (replace with latest)
           [s] Skip all (keep local versions)
           [a] Abort (cancel installation)
         ```
       - Read single character from stdin (use `readline` module)
       - If 'o': proceed with overwrite for all
       - If 's': skip modified skills, install rest
       - If 'a': exit with message "Installation aborted"

    5. **Install skills:**
       - Create SKILLS_DIR if it doesn't exist (`fs.mkdirSync` recursive)
       - For each skill in package:
         - If skill was modified and user chose skip, skip it
         - Otherwise: remove existing dir if present, copy skill dir recursively
         - Print: `  Installed estack:better-title`
       - Write new checksums file with hashes of all installed skills (including skipped ones — use their current hash)

    6. **Set up auto-update startup hook:**
       - The startup hook should run `npx estack@latest` on Claude Code startup to check for updates.
       - Check if `~/.claude/settings.local.json` exists and read it (or start with `{}`)
       - Look for existing hooks in `hooks.PreToolUse` or create the hooks structure
       - Actually, use a simpler approach: Create/update `~/.claude/hooks.json` — but Claude Code hooks go in settings files.
       - CORRECTION: Claude Code hooks are configured via settings files OR `hooks/hooks.json` in plugins. For standalone, use `~/.claude/settings.local.json`.
       - Add a `hooks.Notification` hook (fires on startup) that runs `npx --yes estack@latest --silent` in background.
       - ACTUALLY: The cleanest approach is to NOT use hooks (which could be fragile). Instead, just tell the user to run `npx estack@latest` periodically or add it to their shell profile. Print a message:
         ```
         To auto-update on new terminal sessions, add to your shell profile:
           npx --yes estack@latest --silent 2>/dev/null
         ```
       - Support a `--silent` flag that suppresses all output except errors and only installs if checksums differ (no prompt — auto-skip modified files). This is for the auto-update use case.

    7. **Summary output:**
       ```
       estack installed successfully!

         3 skills installed to ~/.claude/skills/

       Skills available:
         /estack:better-title — Suggest better chat session titles
         /estack:chris-voss — Chris Voss negotiation principles
         /estack:github-issues-update — GitHub issue tracker management

       To auto-update, add to your shell profile (~/.bashrc or ~/.zshrc):
         npx --yes estack@latest --silent 2>/dev/null &
       ```

    **CLI flags:**
    - `--silent`: No prompts, no output. Auto-skip modified files. Exit 0 if up-to-date. For background/auto-update use.
    - No flags (default): Interactive mode with prompts and output.

    **Important implementation notes:**
    - Use ONLY Node.js built-in modules (fs, path, crypto, readline, os). No npm dependencies.
    - Use `fs.cpSync(src, dest, { recursive: true })` for directory copy (Node 16.7+).
    - Compute checksums by walking the directory tree, reading each file, updating a single SHA-256 hash with `relativePath + fileContents` for each file (sorted alphabetically for determinism).
    - Handle Windows paths correctly (use `path.join` everywhere).
    - Ensure the shebang line is `#!/usr/bin/env node` and the file is executable.
  </action>
  <verify>
    <automated>node bin/install.cjs --silent && ls ~/.claude/skills/better-title/SKILL.md ~/.claude/skills/chris-voss/SKILL.md ~/.claude/skills/github-issues-update/SKILL.md && cat ~/.claude/.estack-checksums.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(Object.keys(d).length >= 3 ? 'PASS' : 'FAIL')"</automated>
  </verify>
  <done>Running `node bin/install.cjs` copies all skills to ~/.claude/skills/, creates .estack-checksums.json, and prints install summary. Running with --silent exits quietly when already up-to-date. Modified files trigger a prompt in interactive mode.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Full estack distribution system:
    1. Repo restructured with skills/ directory and estack: prefix
    2. Plugin marketplace (.claude-plugin/) for Claude Code native plugin system
    3. npx installer (bin/install.cjs) with change detection and auto-update support
  </what-built>
  <how-to-verify>
    1. Test plugin marketplace locally:
       ```
       claude --plugin-dir .
       ```
       Then type `/estack:better-title` — should load the skill.

    2. Test npx installer:
       ```
       node bin/install.cjs
       ```
       Should install all 3 skills to ~/.claude/skills/ and show summary.

    3. Test change detection — edit a file in ~/.claude/skills/better-title/, then run:
       ```
       node bin/install.cjs
       ```
       Should detect the modification and prompt for action.

    4. Test silent mode:
       ```
       node bin/install.cjs --silent
       ```
       Should produce no output (skills already installed and unchanged).

    5. Verify sync.sh still works:
       ```
       bash sync.sh better-title
       ```
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- All 3 skills exist under skills/ with estack: prefix in SKILL.md name field
- .claude-plugin/plugin.json has name "estack"
- .claude-plugin/marketplace.json lists the estack plugin with relative source
- package.json defines estack npm package with bin pointing to bin/install.cjs
- bin/install.cjs installs skills, writes checksums, detects local changes
- sync.sh works with the new skills/ directory structure
- No top-level skill directories remain (better-title/, chris-voss/, github-issues-update/ are gone)
</verification>

<success_criteria>
- `claude --plugin-dir .` loads skills as /estack:better-title, /estack:chris-voss, /estack:github-issues-update
- `node bin/install.cjs` installs all skills to ~/.claude/skills/ with checksums
- `node bin/install.cjs --silent` exits quietly when skills are up-to-date
- Modified local skills trigger a prompt in interactive mode
- `bash sync.sh better-title` works with the new directory structure
</success_criteria>

<output>
After completion, create `.planning/quick/260403-bmd-build-estack-distribution-plugin-marketp/260403-bmd-01-SUMMARY.md`
</output>
