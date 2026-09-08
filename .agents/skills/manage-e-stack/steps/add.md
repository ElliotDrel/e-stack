# Add or Migrate a Skill

Inspect the repository and any existing skill before choosing a structure. Use a
template when it helps, but do not force a coaching or multi-file design onto a
task that needs a smaller skill.

Create the skill in `skills/estack-<name>/` with valid frontmatter: a matching
`name`, an initial `version: 1.0.0`, and a concise description that begins with
`(<short-name>)`. Add only the supporting files the workflow needs. Use the
shared feedback template through `node scripts/update-skill-feedback.cjs` after
the template is settled.

For a new skill, register its name in the README and AGENTS inventories and add
release notes when the change is intended to be user-visible in a release. Run
the focused checks that establish valid frontmatter and inventory state.

If an installed copy exists, use `node bin/install.cjs` to preview the live
change. Show that preview and wait for approval before `--install`; installation
can replace local skill files and adjust host links.

Follow the requested branch, commit, and PR workflow. A regular commit does not
publish. Route to `prep.md` or `publish.md` only when the user asks for release
work.
