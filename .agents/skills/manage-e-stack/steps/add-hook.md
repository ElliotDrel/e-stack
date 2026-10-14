# Add or Edit an E-Stack Hook

Inspect the hook, its event contract, and the installer path it needs before
editing. Hooks are host integrations, so keep each hook narrow and ensure it
fails safely: parse its event input defensively, isolate errors, and never break
the underlying tool call.

For a new or changed hook, keep its `// @version` current and update
`bin/install.cjs` only where a host registration is required. The setup function
must be idempotent and must not write during a dry run. Follow the existing host
architecture rather than assuming every hook belongs in the same location.

Run a synthetic stdin test when the event behavior changes, plus a focused
settings or registration check if applicable. Register a new hook in the README
and AGENTS inventories; update release notes when the user-facing behavior is
being prepared for release.

Use `node bin/install.cjs` to preview any live installation. Show the changed
files and host configuration before asking for approval to run `--install`.
Repository edits then follow the branch, commit, and PR workflow the user asked
for. Publish only through the explicit release route.
