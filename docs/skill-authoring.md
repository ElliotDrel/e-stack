## Skill Authoring

### Skill Templates

Reusable scaffolds live in `templates/` at the repo root (outside `skills/`, so they're never published, installed, or version-checked). Start a new skill by copying a template rather than authoring structure from scratch.

- **`templates/coaching-skill/`** — for a skill that coaches the user through a decision using one or more named frameworks and ends with a concrete artifact. This is the shape `estack-leadership-coach` and `estack-productivity-prioritization-coach` share. It defines the standard component set (identity → primary outcome → voice → calibrate depth → framework → coaching protocol → acceptance bar → handling resources → sources → feedback) and ships both reference tiers: a lightweight `sources/` model and a heavier `references/` knowledge vault with an `adding-references.md` playbook. Keep the tier you use, delete the other.

To instantiate: `cp -r templates/coaching-skill skills/estack-<name>`, rename `SKILL.template.md` → `SKILL.md`, fill the `{{PLACEHOLDERS}}`, resolve the tier files (rename `adding-references.template.md` or delete it; the sources template is a pattern to copy, then delete), then run `node scripts/update-skill-feedback.cjs`. No `.template.md` file may remain in the finished skill — it would ship to npm. Full instructions are in `templates/README.md`. The `manage-e-stack` add flow (`steps/add.md`) points here at step 1.

If a future skill is a different shape (a tool, converter, tracker), add a new template folder under `templates/` rather than forcing it into the coaching scaffold.

---

### Per-Skill Versioning

Every skill carries its own semver in SKILL.md frontmatter, independent of the package version in `package.json`:

```yaml
---
name: estack-example
version: 1.2.0
description: >-
  (example) Use when the user asks for a concrete workflow. Use for: setup,
  repair, and verification. Trigger phrases: "fix this", "verify this".
---
```

- **New skills start at `1.0.0`.**
- **Bump on every content change** to the skill folder (SKILL.md, scripts, references, steps): patch for fixes/tweaks, minor for new capabilities, major for rewrites or breaking changes.
- **Use folded YAML for long descriptions** whenever the text contains `Use for:`, `Triggers:`, or any other colon followed by a space. Plain one-line YAML values cannot safely contain `: ` unless quoted.
- **Write the description as the moment the skill is needed, in one to three sentences.** Name the step or request that calls for it, not the topic it touches: "Create and validate Postgres schema migrations, used when adding or changing a migration or reviewing its result", not "...used when working with databases, queries, models, or persistence." Skip trigger-phrase lists, ALL CAPS, MANDATORY/NEVER, and "even if the user didn't ask": every skill's description competes for the same routing budget, and a description that claims a whole topic loads the skill on tasks it does not help. When two skills border each other, each description names the seam in one clause ("first-touch mail to a stranger is estack-cold-message-writer").
- **Write the body for several models.** The pack is read by Claude Code, Codex, and other agents, and each release of those models needs less hand-holding than the last. Prefer intent plus boundaries over a step-by-step recipe, put workflow-specific material in `steps/` or `references/` files the root routes to, and reserve emphasis for real gates (destructive actions, credentials, never fabricating a citation).
- Hooks use a `// @version x.y.z` comment near the top of the file instead.
- **Enforcement:** `node scripts/check-versions.cjs` diffs every skill/hook against the last `v*` release tag and fails if content changed without a version bump. Run `--fix` to auto-patch-bump stale items. The publish workflow (`.github/workflows/publish.yml`) runs this check as a hard gate, so a release cannot ship a content change with a stale version.
- **Division of labor:** the installer detects updates via content hashes (deterministic, can't miss a change); versions are the trustworthy human-readable label — the installer shows `name (1.0.0 → 1.1.0)` transitions in its update messages, and the version travels with the installed copy so any machine can self-report what it has.

---

### Where a Skill Puts the Files It Creates

Every file a skill creates lands in one of four places. Decide which kind of file
it is first, then the location follows.

**1. Skill state → `~/.e-stack/<skill-folder>/`**

Anything the skill persists for its own use between runs: config, credentials,
caches, history, registries, cloned repos, internal artifacts. Use the skill's
full folder name — `estack-doc-review-viewer` owns
`~/.e-stack/estack-doc-review-viewer/`. The name is deliberately not shortened:
the installed skill, its frontmatter `name:`, and its state directory all answer
to one identity, which is also what keeps `check-skill-name.cjs` honest.

One folder holds everything every e-stack skill has ever written. The user has a
single directory to find, back up, inspect, or delete, instead of a dotfile per
skill scattered across the home directory.

**2. A deliverable the user asked for → wherever they said**

A document, export, or design the user requested is theirs, not skill state. It
goes where they asked, defaulting to the working directory. Never file a
deliverable into `~/.e-stack/` — they would never find it again.

**3. Ephemeral scratch → the system temp dir or the session scratchpad**

Intermediate output that does not outlive the run. `estack-flight-planner`'s
fetch scripts use `tempfile.gettempdir()` for raw API responses; that is correct
and should not move.

**4. A skill this skill generates → the skills directory**

`estack-book-extractor` installs what it produces into the user's skills folder,
unprefixed, because the result is their own reference library rather than part of
this pack.

Rules:

- **Never write beside the user's documents** unless the file *is* the
  deliverable. Their working directory holds their files and nothing a skill made
  for its own bookkeeping.
- **Never invent a new top-level dotfile** (`~/.my-skill/`), never use a bare home
  folder (`~/my-skill-storage/`), and never store state under `~/.claude/`, which
  belongs to Claude Code rather than to this pack.
- **Never store state inside the installed skill folder.** The installer
  overwrites it on every update.
- **Define the path once**, in a single exported constant, and derive every other
  path (including in tests) from it. A literal repeated in a test is how a moved
  root silently goes stale.
- **A skill that stores nothing needs none of this** — most skills are prose and
  should stay that way.
- **Enforcement:** `node scripts/check-paths.cjs` fails on a new home-directory
  dotfile, a bare home folder, and state under `~/.claude/`. A path a skill only
  *reads* (another tool's data) belongs in that script's `ALLOWED_PREFIXES`; a
  deliberate legacy-compatibility line gets an `estack-path-ok` comment on the
  line. The publish workflow runs it as a hard gate.
- **Create the directory before writing to it.** `~/.e-stack/<skill>/` does not
  exist on a fresh install. A skill that used to write into a folder the OS
  always provides (Documents, Desktop) has no `mkdir` anywhere in it and will
  throw `ENOENT` the first time it runs after moving.

---

### Credentials and Environment Variables

**Every API key, token, and secret in the pack lives in one file:
`~/.e-stack/.env`.** Not one per skill. A user who sets a key once has set it
for every skill that needs it, and a key two skills share is stored once.

Format is `KEY=value`, one per line. Blank lines and lines starting with `#` are
ignored. Surrounding quotes are stripped.

```
# ~/.e-stack/.env
PULSE_API_KEY=abc123
SERPAPI_KEY=def456
```

**Resolution order, always:** the live process environment first, then
`~/.e-stack/.env`.

The installer follows the same rule for its own settings — `ESTACK_SKILLS_DIR`,
`ESTACK_HOOKS_DIR`, `ESTACK_BACKUP_DIR`, `ESTACK_NO_STATUSLINE`, and `ESTACK_HOME`
all live in this file too. It is the pack's single settings file, not just its
credential file, so a new persistent setting belongs here under an `ESTACK_*`
name rather than in a new JSON sidecar or marker file. A real environment variable wins so a one-off override works
without editing the file.

**An environment variable is an override, never a home.** Never tell a user to
persist a key with `setx`, `SetEnvironmentVariable`, a shell profile, or
`$env:KEY = ...`. A key stored that way is invisible to every other skill in the
pack and does not survive a move to a new machine, and because the live
environment wins, the copy in `~/.e-stack/.env` silently goes stale beside it.
That is exactly how `SERPAPI_KEY` ended up living in two places at once. When a
setup check finds a key in the environment and not in the file, it says so and
tells the user to move it.

Rules:

- **Append, never overwrite.** The file is shared. A skill that writes a key by
  rewriting the whole file destroys every other skill's credentials. Read,
  replace-or-append the one line, write back — or tell the user to add the line
  themselves.
- **Store credentials only here.** Not in a per-skill `.env`, not in a skill's
  `config.json` next to preferences, and never inside the installed skill folder
  (the installer overwrites it on every sync). `estack-flight-planner` used to
  keep `serpapi_key` in its `config.json`; that field is gone, and preferences
  stay there without it.
- **Each skill reads the file itself.** Skills are installed independently, so a
  shared loader module would be a dependency a single-skill install cannot
  satisfy. Copy the ~15-line reader — `estack_env(name)` in
  `estack-pdf-to-md/scripts/pdf_to_md.py` and
  `estack-flight-planner/scripts/fetch_flights.py` are the reference
  implementations, and there is a bash equivalent in each skill's setup check.
- **Never print a key.** Report it as set/not-set, or mask to first 6 and last 4
  characters. This applies to setup checks, logs, and error messages.
- **Enforcement:** `node scripts/check-paths.cjs` fails on a per-skill `.env`, on
  a `.env` resolved relative to the script's own location, and on any instruction
  to store a credential-looking variable in the OS environment (`setx`,
  `export KEY=`, `$env:KEY =`, `SetEnvironmentVariable`). Assigning `$null` or an
  empty value is exempt — that clears a variable, which is the fix rather than the
  violation. Mark a deliberate legacy read with an `estack-path-ok` comment on the
  line.
- **Some env vars must stay unset.** `estack-drive-cli-agent` deliberately tells
  callers never to set `OPENAI_API_KEY`, `CODEX_API_KEY`, or
  `ANTHROPIC_API_KEY`, because each one silently switches billing from the
  logged-in subscription to API-key mode. Those do not belong in this file.

Every skill that stores anything is on this convention. When you move an existing
skill's state, leave a legacy check behind: detect the old location, tell the user
where it moved and how to move their files, and let them decide. Never relocate a
user's file silently — `estack-flight-planner`'s `scripts/check_setup.sh` is the
worked example.

---

### Doc Listings (README.md + CLAUDE.md)

Every skill and hook must be listed in two places:

- **README.md** — a row in the Skills table (`| **Title** | \`/estack-name\` | description |`) or the Hooks table
- **AGENTS.md** — the "Skills in the pack" / "Hooks in the pack" lines

**Enforcement:** `node scripts/check-docs.cjs` verifies both files against `skills/` and `hooks/`, failing on missing entries AND stale ones (renamed/removed items still listed). The publish workflow (`.github/workflows/publish.yml`) runs it as a hard gate, so the docs cannot drift past a release. It only checks names — keep descriptions accurate manually when a skill's purpose changes.

---

### Skill Name Validation

`node scripts/check-skill-name.cjs <skill-name>` (or `--all` for every skill) verifies that a skill was migrated and self-references correctly. It checks:

1. Folder is named `skills/estack-<short>/`
2. Frontmatter `name:` matches the folder name exactly
3. Frontmatter `version:` exists and is semver (`x.y.z`)
4. Frontmatter `description:` starts with `(<short>)` — e.g. `(repo-search) Use when…`
5. No bare short-name self-references inside the skill's own files — every mention of `<short>` must be prefixed `estack-<short>` or wrapped as `(<short>)` (the description convention)

Allowed exceptions: mentions inside `references/` docs (prose about the skill's display name) and the `(<short>)` description prefix itself are not flagged as stale.

The publish workflow runs `--all` as a hard gate. Run it locally before tagging if you've renamed a skill or edited its frontmatter.

---

### Skill Feedback Section

Every skill should include a `## Skill Feedback` section at the bottom. This is managed via a shared template — do not edit it manually in individual skill files.

**To update the feedback text across all skills:**

1. Edit `scripts/skill-feedback-template.md` (use `{{SKILL_NAME}}` as the placeholder for the skill's name)
2. Run `node scripts/update-skill-feedback.cjs` — rewrites the section in every `skills/estack-*/SKILL.md`
3. Verify with `node scripts/update-skill-feedback.cjs --check` (exits 1 if any skill is out of sync)

The feedback section instructs the AI to collect feedback details from the user, then file a GitHub issue via `gh issue create` (if available) or a pre-filled issue URL.

---

### Auto-run commands

Use `` ```! `` (triple backtick + `!`) code blocks in SKILL.md to run shell commands automatically when the skill is loaded. The output is presented to the model before it processes the rest of the skill.

Use this for setup tasks, environment checks, or gathering context that the skill needs upfront.

**Example:**
- `skills/estack-repo-search/SKILL.md` — clones and indexes a repo on load
