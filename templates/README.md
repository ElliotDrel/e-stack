# E-Stack Skill Templates

Reusable starting points for skills with a similar workflow. Use a template when
it fits, then keep, adapt, or remove sections based on the user's task.

> Templates live here (repo root `templates/`), **not** under `skills/`, on purpose. The npm package only ships `bin/`, `skills/`, and `hooks/`, and the install/version/docs gates only scan `skills/` and `hooks/`. So nothing here gets published, installed, or version-checked — it's a pure authoring aid.

## When to use which template

| Template | Use it for |
|---|---|
| `coaching-skill/` | A skill that **coaches the user through a decision** using one or more named frameworks, surfacing principles in the moment and ending with a concrete artifact or decision. Both `estack-leadership-coach` and `estack-productivity-prioritization-coach` follow this shape. |

If a future skill is a different shape (a pure tool, a converter, a tracker), don't force it into the coaching template — add a new template folder here instead.

## How to instantiate `coaching-skill/`

1. **Copy the scaffold** into a new skill folder:
   ```bash
   cp -r templates/coaching-skill skills/estack-<short-name>
   ```
2. **Rename and fill `SKILL.template.md` → `SKILL.md`.** Replace the relevant
   `{{PLACEHOLDERS}}`, then remove guidance comments and unused starter
   sections. Keep the frontmatter at the top so the skill parses.
3. **Pick your reference tier** (see below) and resolve the template files. No `.template.md` file may remain in the finished skill — anything left in `skills/` ships to npm and installs to users' machines:
   - **Tier 1:** delete the `references/` folder. Use `sources/00-source-name.template.md` as the pattern for your first real `sources/01-<name>.md`, then delete the `00-*.template.md` file.
   - **Tier 2:** delete the `sources/` folder. Rename `references/adding-references.template.md` → `adding-references.md` and fill its `{{PLACEHOLDERS}}`.
4. **Stamp the feedback section** — do not write it by hand:
   ```bash
   node scripts/update-skill-feedback.cjs
   ```
5. **Register the skill** — add it to the README and AGENTS inventories, add
   release notes when appropriate, and run `node scripts/check-docs.cjs && node
   scripts/check-skill-name.cjs estack-<short-name>`.

The add flow is in `.agents/skills/manage-e-stack/steps/add.md`. It covers repository validation and routes to live installation or release only when those are requested.

## The two reference tiers

Every coaching skill grounds its frameworks in source material. Pick the tier that matches how many sources you have and whether they feed inline placeholders:

- **Tier 1 — lightweight `sources/`** (the productivity-coach model). A handful of numbered files (`01-name.md`, `02-name.md`). Each is a metadata table + what-it-contributes + synthesized takeaways. No inline citation placeholders to wire up. **Default — start here.**
- **Tier 2 — `references/` vault** (the leadership-coach model). Many cited sources that feed "Real-world case" / "Going deeper" placeholders scattered across multiple framework files. Comes with an `adding-references.md` playbook (live-fetch rules, extraction vs. synthesis templates, a cross-reference map). **Graduate to this** only when Tier 1's flat list stops scaling.

The `coaching-skill/` scaffold ships both tiers. Delete the one you don't use.

## Useful coaching components

These components are a menu for coaching skills, not a required order or
checklist. Include the parts that help the user reach the requested outcome.

| # | Component | When useful |
|---|---|---|
| 1 | Frontmatter (`name`, `version`, description) | Always |
| 2 | Identity and posture | When a consistent coaching role helps |
| 3 | Intended outcome | When the task has a concrete end state |
| 4 | Voice guidance | When tone affects the result |
| 5 | Depth choices | When the skill serves both quick and involved work |
| 6 | Framework or method | When it gives the user a repeatable advantage |
| 7 | Conversation guidance | When interaction order matters |
| 8 | Completion cues | When the user needs a checkable deliverable |
| 9 | Likely shortcuts | When a specific failure pattern recurs |
| 10 | Resource handling | When the skill maintains a source base |
| 11 | Sources or references | When factual claims depend on them |
| 12 | Skill Feedback (auto-stamped by script) | Always |

## Writing the prose inside a skill

The skill body is a prompt, so keep its instructions task-specific, concise, and
consistent with [`docs/skill-authoring.md`](../docs/skill-authoring.md). Explain
the purpose of a constraint when it changes judgment, preserve user intent over
template defaults, and use only the structure the workflow needs.
