# Create Project Instructions

First identify the target file and the project's existing instruction layout. If
the user names `AGENTS.md` or `CLAUDE.md`, use that file. If both files already
exist, preserve their roles unless the user asks to redesign them. Ask only when
the canonical location is genuinely unclear and the choice would change the
result.

Gather the project's purpose, durable constraints, working preferences, and any
terms future agents could misunderstand. Inspect relevant repository material to
verify proposed facts, commands, paths, and references. Do not turn codebase
observations into instructions without a reason they serve the user's intent.

Draft the smallest instruction set that will help future work. A brief letter,
a structured guide, or a combination can all be appropriate. Keep operational
details that are stable and useful; omit details that merely duplicate the code.

When the user asks to create the file, write the reviewed result and verify its
paths or linked documents. If they are still choosing the content or architecture,
provide a concrete draft and identify the decision that remains.
