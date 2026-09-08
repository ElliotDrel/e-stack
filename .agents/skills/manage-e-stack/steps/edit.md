# Edit an E-Stack Skill

Inspect the target skill and its relevant supporting files before changing it.
The preflight script is read-only and can help compare repository and installed
state. On Windows, use Git Bash explicitly when `bash` would resolve to WSL:

```bash
"C:/Program Files/Git/bin/bash.exe" .agents/skills/manage-e-stack/scripts/preflight.sh
```

Make the requested targeted edits in `skills/estack-*/`. Keep the frontmatter
valid and bump the skill version for the content change. Update documentation
only where the skill's inventory entry or user-facing description is affected;
do not create unrelated documentation churn.

Run checks that match the edit, such as `node scripts/check-skill-name.cjs
<skill-name>` and a focused link or syntax check. Treat a preflight parser
warning as a lead to investigate; the repository's authoritative validation
scripts determine whether the frontmatter is valid.

Before changing an installed copy, run `node bin/install.cjs` and show its
preview. Wait for the user's approval before `node bin/install.cjs --install`.
For repository-only edits, continue through the requested branch, commit, and PR
workflow without an extra approval pause.
