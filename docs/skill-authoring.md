## Skill Authoring

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
