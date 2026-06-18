## Skill Authoring

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
- Hooks use a `// @version x.y.z` comment near the top of the file instead.
- **Enforcement:** `node scripts/check-versions.cjs` diffs every skill/hook against the last `v*` release tag and fails if content changed without a version bump. Run `--fix` to auto-patch-bump stale items. The publish workflow (`.github/workflows/publish.yml`) runs this check as a hard gate, so a release cannot ship a content change with a stale version.
- **Division of labor:** the installer detects updates via content hashes (deterministic, can't miss a change); versions are the trustworthy human-readable label — the installer shows `name (1.0.0 → 1.1.0)` transitions in its update messages, and the version travels with the installed copy so any machine can self-report what it has.

---

### Doc Listings (README.md + CLAUDE.md)

Every skill and hook must be listed in two places:

- **README.md** — a row in the Skills table (`| **Title** | \`/estack-name\` | description |`) or the Hooks table
- **CLAUDE.md** — the "Skills in the pack" / "Hooks in the pack" lines

**Enforcement:** `node scripts/check-docs.cjs` verifies both files against `skills/` and `hooks/`, failing on missing entries AND stale ones (renamed/removed items still listed). The publish workflow (`.github/workflows/publish.yml`) runs it as a hard gate, so the docs cannot drift past a release. It only checks names — keep descriptions accurate manually when a skill's purpose changes.

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
