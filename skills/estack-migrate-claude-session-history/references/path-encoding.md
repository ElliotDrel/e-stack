# Path Encoding Reference

Why session migration needs **nine** path replacements instead of one.

A Claude Code project's working directory shows up inside session transcripts in several different encodings depending on which subsystem wrote it. Missing even one variant produces a transcript that *looks* migrated but breaks on `/resume` or shows the wrong project name. The migration script applies all nine; this file documents what each one is, and where it tends to appear.

The script sorts the nine pairs longest-first before substitution, which prevents partial overlaps (e.g. matching the forward-slash form inside the JSON-escaped backslash form).

## The nine variants

For an old path `C:\Users\name\old\repo` migrating to `C:\Users\name\new\repo`, the script rewrites all of these:

| Key | Encoding | Example old form | Where it appears |
|---|---|---|---|
| A | JSON-escaped backslash, uppercase drive | `C:\\Users\\name\\old\\repo` | `cwd` field on most entries; tool inputs serialized as JSON strings. This is usually the highest-count replacement by far. |
| B | JSON-escaped backslash, lowercase drive | `c:\\Users\\name\\old\\repo` | Rare; only when something on the system normalized the drive to lowercase. |
| C | Forward slash, uppercase drive | `C:/Users/name/old/repo` | Tool outputs from Unix-ish utilities running on Windows (e.g. `find`, `grep` via Git Bash). |
| D | Hyphenated project-dir name, lowercase drive | `c--Users-name-old-repo` | References to the encoded project dir under `.claude/projects/` in lowercase. |
| E | MSYS / Git Bash path | `/c/Users/name/old/repo` | Bash tool outputs from MSYS / Git Bash. |
| F | Hyphenated project-dir name, uppercase drive | `C--Users-name-old-repo` | References to the encoded project dir, the form Claude Code itself uses on Windows. |
| G | Forward slash, lowercase drive | `c:/Users/name/old/repo` | Rare lowercase-drive variant of C. |
| H | Plain backslash, uppercase drive | `C:\Users\name\old\repo` | Conversation text — when Claude prints a path inline, it usually uses this form. |
| I | Plain backslash, lowercase drive | `c:\Users\name\old\repo` | Rare lowercase-drive variant of H. |

## How the encoded project-dir name is built

Given a Windows path like `C:\Users\name\old\repo`:

1. Take the drive letter and colon → `C:`
2. Append each path segment separated by `\` → `C:\Users\name\old\repo`
3. Replace every `:`, `\`, `/`, space, and `'` with `-` → `C--Users-name-old-repo`

This is the folder name under `~/.claude/projects/`. Claude Code creates the uppercase-drive form on Windows; the lowercase form exists for case-insensitive filesystem quirks.

## Why this matters for migrations

Most replacements happen in the `cwd` field (variant A). But other variants show up in:

- Subagent transcripts that captured shell output (variants C, E, G)
- Tool result strings where Claude or a tool quoted a path (variant H)
- References to other sessions or the project dir itself (variants D, F)

The replacement count printed by the migration script's dry-run reveals which subsystems your session interacted with. A session that only ever talked to native Windows tools will show 100% pattern A; one that ran a lot of `git` or `bash` will show a mix.

## What does NOT get rewritten

- The new project's encoded folder name (`new-repo`'s `C--...` form). This is computed from `--new-repo` and used as the target directory name; it isn't substituted into entry bodies.
- File contents outside the session transcripts. The script operates only on text files inside the project directory under `~/.claude/projects/`.
- Anything that doesn't include the old path as a substring. The script does literal substring matching, not pattern matching.

## What to do when the new path is a substring of the old path (or vice versa)

This happens when you migrate a session into a subdirectory of its current project (e.g. `Other Claude Code` → `Other Claude Code\Sub-Project`). The script handles it correctly thanks to longest-first sorting, but its post-migration verifier will produce **false-positive** warnings because every occurrence of the new path also contains the old path as a substring.

See `references/troubleshooting.md` → "Stale reference false positive" for the recipe that distinguishes real stale references from prefix-containment artifacts.
