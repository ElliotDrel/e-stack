# E-Stack Skill Templates

Copy-paste scaffolds for building new skills in a consistent shape. These are **templates**, not docs — clone the folder, fill the `{{PLACEHOLDERS}}`, delete the guidance comments, and you have a skill.

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
2. **Rename and fill `SKILL.template.md` → `SKILL.md`.** Replace every `{{PLACEHOLDER}}`, work through the section-by-section guidance comments, and delete the comments as you resolve them. Each section is labeled **REQUIRED** or **OPTIONAL**. (The guidance comments sit below the frontmatter on purpose — never add anything above the opening `---`, or the frontmatter won't parse and the skill won't trigger.)
3. **Pick your reference tier** (see below) and resolve the template files. No `.template.md` file may remain in the finished skill — anything left in `skills/` ships to npm and installs to users' machines:
   - **Tier 1:** delete the `references/` folder. Use `sources/00-source-name.template.md` as the pattern for your first real `sources/01-<name>.md`, then delete the `00-*.template.md` file.
   - **Tier 2:** delete the `sources/` folder. Rename `references/adding-references.template.md` → `adding-references.md` and fill its `{{PLACEHOLDERS}}`.
4. **Stamp the feedback section** — do not write it by hand:
   ```bash
   node scripts/update-skill-feedback.cjs
   ```
5. **Register the skill** — README.md table, AGENTS.md "Skills in the pack" line, CHANGELOG `[Unreleased]`. Verify with `node scripts/check-docs.cjs && node scripts/check-skill-name.cjs estack-<short-name>`.

The full add flow (installer dry-run, commit gate, publish) is in `.agents/skills/manage-e-stack/steps/add.md` — this template plugs into step 1 of that flow.

## The two reference tiers

Every coaching skill grounds its frameworks in source material. Pick the tier that matches how many sources you have and whether they feed inline placeholders:

- **Tier 1 — lightweight `sources/`** (the productivity-coach model). A handful of numbered files (`01-name.md`, `02-name.md`). Each is a metadata table + what-it-contributes + synthesized takeaways. No inline citation placeholders to wire up. **Default — start here.**
- **Tier 2 — `references/` vault** (the leadership-coach model). Many cited sources that feed "Real-world case" / "Going deeper" placeholders scattered across multiple framework files. Comes with an `adding-references.md` playbook (live-fetch rules, extraction vs. synthesis templates, a cross-reference map). **Graduate to this** only when Tier 1's flat list stops scaling.

The `coaching-skill/` scaffold ships both tiers. Delete the one you don't use.

## The standard component set

Every coaching skill's `SKILL.md` should carry these components, in this order. This is the contract the template enforces — the same way every skill carries a `## Skill Feedback` section.

| # | Component | Required? |
|---|---|---|
| 1 | Frontmatter (`name`, `version`, `description` with `(short)` prefix) | Required |
| 2 | Identity statement — who the coach is | Required |
| 3 | Primary outcome / core shift — what every session must produce, wrapped in `<primary_outcome>` tags | Required |
| 4 | Voice & posture — tone rules applied every turn | Required |
| 5 | Calibrate depth to stakes — compressed vs. full path | Required |
| 6 | The framework(s) — the coaching method itself | Required |
| 7 | Coaching protocol — the per-turn loop + question discipline | Required |
| 8 | Acceptance bar — binary checklist for when a session is done | Required |
| 9 | Pre-empted shortcuts — named anti-patterns, each *don't* paired with its *do* | Optional (recommended) |
| 10 | Handling new resources — how sources get added (Tier 2 adds the runtime consult-the-vault rule) | Required |
| 11 | Sources / References list | Required |
| 12 | Skill Feedback (auto-stamped by script) | Required |

## Writing the prose inside a skill

The skill body is a prompt, so prompt-writing rules apply. The authoring companion is [`prompting_guidelines-Matt-Shummer.md`](../prompting_guidelines-Matt-Shummer.md) at the repo root — goal-first hierarchy, artifact-gated phases, pre-empted shortcuts, binary acceptance criteria, positive framing over negation. The template's structure already enforces about half of it; the guidelines cover the sentence-level rest (numeric bars over adjectives, motivation behind each rule, normal imperatives instead of alarm-caps).
