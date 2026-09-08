## Hook Authoring

A hook is a Node script in `hooks/<name>.js` that responds to a Claude Code
lifecycle event. Hooks should be small, single-purpose integrations. Read the
current host documentation before relying on a host-specific schema or behavior.

Most hooks install to `~/.claude/hooks/` and are registered in
`~/.claude/settings.json`. The shared startup updater is different: its shared
core and host adapters live under `~/.agents/hooks/`, and the installer registers
the appropriate adapter with each host. Follow the relevant installer function
and hook code instead of assuming every hook uses one location.

## Script contract

Read the event JSON from stdin, optionally write a valid hook response to stdout,
and isolate errors so a hook failure does not break the underlying tool call.
Keep the `// @version x.y.z` current for hook content changes.

The non-blocking shape used by this pack is:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "..."
  }
}
```

Write nothing when no context should be injected. Other fields and blocking
behavior depend on the current host schema and should be verified from the host
documentation before use.

When a hook has user-tunable values, keep them as clearly named constants near
the top of the script. `hooks/repo-search-nudge.js` is intentionally stateless:
it conditionally suggests `estack-repo-search` after relevant GitHub repository
web searches or fetches, without counters, throttling, or persisted state.

## Installer registration

Add a focused, idempotent setup function to `bin/install.cjs` only when the hook
needs host registration. It should read the existing settings, detect its own
entry, and return before writing in dry-run mode. Follow the closest existing
setup function for the host and event.

`node bin/install.cjs` previews the change. Show that preview and wait for user
approval before `--install`, because live installation can copy hook files and
patch host settings.

## Verification

Pipe-test a new hook or changed event contract with representative JSON. After an
authorized installation, verify the affected settings file parses and that the
expected registration exists. Match the checks to the event behavior; a stateless
hook does not need repeated state or throttle tests.
