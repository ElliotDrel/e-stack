# Claude Code — headless (`claude -p`) reference

Sourced from Anthropic's official docs (all under `code.claude.com/docs/en/`). If anything here contradicts observed behavior, fetch the cited URL — researched 2026-07 against a v2.1.2xx CLI.

Primary sources:
- Headless mode: https://code.claude.com/docs/en/headless
- CLI reference (all flags — consult for anything not listed below): https://code.claude.com/docs/en/cli-reference
- Permission modes: https://code.claude.com/docs/en/permission-modes
- Sessions/resume/transcripts: https://code.claude.com/docs/en/sessions
- Errors: https://code.claude.com/docs/en/errors
- Env vars: https://code.claude.com/docs/en/env-vars
- Full docs index: https://code.claude.com/docs/llms.txt

Note on framing: Anthropic now documents `claude -p` as the CLI form of the Agent SDK. Same binary, same subscription auth — the SDK label doesn't imply API-key billing.

## Flags

| Flag | What it does |
|---|---|
| `-p, --print "<prompt>"` | Non-interactive run; all other CLI flags compose with it |
| `--output-format <text\|json\|stream-json>` | `json` = single result object. `stream-json` = NDJSON events for live-progress pipelines — not needed for run-and-read use |
| `--json-schema '<schema>'` | With `--output-format json`: validated result in `.structured_output`. Invalid schema → immediate exit with `Error: --json-schema is not a valid JSON Schema` |
| `--allowedTools "<list>"` | Auto-approve tools/rules — `"Bash,Read,Edit"` or scoped `Bash(git diff *)` (note the space before `*`) |
| `--disallowedTools "<list>"` | Bare name removes the tool from context entirely; scoped rule denies matching calls only |
| `--permission-mode <mode>` | `default` (alias `manual`), `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` |
| `--dangerously-skip-permissions` | = `bypassPermissions`; refuses root/sudo outside a sandbox |
| `--continue, -c` / `--resume, -r <id>` / `--session-id <uuid>` / `--fork-session` | Session continuation |
| `--no-session-persistence` | No transcript write for this run (also breaks `--resume` for it) |
| `--add-dir <path>` | Extra directory file access (not restored on `--resume` — re-pass it) |
| `--model <alias\|id>` | `opus`/`sonnet`/`haiku`/`fable` or full id |
| `--append-system-prompt[-file]` / `--system-prompt[-file]` | Extend / replace system prompt |
| `--max-turns <n>` | Turn cap, print mode only; exits with error at limit |
| `--max-budget-usd <x>` | Spend cap, print mode only |

**There is no `--tools` flag.** Skills work in `-p` (put `/skill-name` in the prompt); interactive-only commands like `/login` don't.

## Auth — subscription-only rules

- `ANTHROPIC_API_KEY` set → **silently used instead of the subscription** in `-p` mode (interactive mode at least prompts once). Keep it unset.
- **Never use `--bare` for subscription runs.** Docs recommend it for scripts and plan to make it the `-p` default — but bare mode "skips OAuth and keychain reads; Anthropic authentication must come from `ANTHROPIC_API_KEY` or an `apiKeyHelper`" ([headless docs](https://code.claude.com/docs/en/headless)). Bare mode = API-key mode.
- No env var injects an OAuth token. Subscription headless auth requires a prior interactive `claude` login on the machine, and login expiry has no headless recovery (`Login expired · Please run /login`, but `/login` needs a terminal).
- Usage limits: session/weekly limits block all models until reset; the Opus-only limit can be dodged with `--model sonnet`. 429s auto-retry with backoff; 529 overload doesn't count against quota.

## Output parsing

- `json`: object with `.result` (text), `.session_id`, `.total_cost_usd` + usage metadata; `.structured_output` when `--json-schema` used. Error-field names aren't documented verbatim — inspect one real error payload before hard-coding error handling.
- On failure: exit 1 with distinguishing *text* (often on stderr, outside the JSON) — capture stderr to a file, don't discard it.
- Anthropic's own examples parse with `jq` (`| jq -r '.result'`).

## Exit codes

0 = success, 1 = everything else (auth, permissions, limits, schema, turn cap — all exit 1 with distinguishing text). 137 = OOM during install only. Branch on parsed output, not exit codes. ([errors doc](https://code.claude.com/docs/en/errors))

## Permission modes headless

- `dontAsk`: auto-denies anything not in `permissions.allow` / built-in read-only set / `--allowedTools`. Also denies `AskUserQuestion` and `requiresUserInteraction` MCP tools even when allowed. Locked-down CI shape.
- `acceptEdits`: auto-approves file edits + `mkdir touch rm rmdir mv cp sed` (and PowerShell equivalents) in-scope; **any other shell command or network request without an allow rule aborts the run** — the classic "worked in the quick test, died on the real task" trap.
- `auto`: classifier-gated; in `-p` repeated blocks **abort the session** (no user to re-prompt), and a network-host deny is cached for the rest of the run.
- `bypassPermissions`: needs one prior interactive acceptance on the machine; `--bg` sessions refuse until then.
- Protected paths (`.git`, `.claude`, `.mcp.json`, shell rc files…) are never auto-approved except in `bypassPermissions` — under `dontAsk` they're flatly denied.

## Timeouts / process behavior

- No whole-process timeout — enforce externally (Bash-tool `timeout` or `run_in_background`). Signal-kill behavior on partial output/session state is undocumented.
- Internal knobs: `BASH_DEFAULT_TIMEOUT_MS` (2 min), `BASH_MAX_TIMEOUT_MS` (10 min), `API_TIMEOUT_MS` (10 min). Background Bash tasks are killed ~5s after the final result; background subagents get `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` (10 min default, `0` = unlimited).
- Piped stdin is capped at 10 MB — for larger input, write a file and reference the path in the prompt.

## Sessions

- Resume lookup is scoped to **the project directory and its git worktrees** — resuming elsewhere: `No conversation found with session ID`. Run follow-ups from the same cwd.
- `-p` sessions don't appear in the interactive picker but resume fine by id.
- Ask-an-old-session pattern: `claude -p --resume <id> --output-format json "summarize what we changed" | jq -r '.result'`.
- Transcripts: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` — format is internal and version-unstable; read via the `estack-read-agent-history` skill, never raw parsing.
