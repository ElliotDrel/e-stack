# Codex CLI — `codex exec` reference

Sourced from OpenAI's official docs and the `openai/codex` GitHub repo. Doc URLs redirect: `developers.openai.com/codex/*` → `learn.chatgpt.com/docs/*`. If anything here contradicts observed behavior, fetch the cited URL — Codex CLI moves fast and this file was researched against codex-cli 0.144.x (2026-07).

Primary sources:
- Non-interactive mode: https://developers.openai.com/codex/noninteractive (→ https://learn.chatgpt.com/docs/non-interactive-mode)
- CLI command/flag reference: https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-exec
- Config reference: https://learn.chatgpt.com/docs/config-file/config-reference.md
- Auth: https://developers.openai.com/codex/auth (→ https://learn.chatgpt.com/docs/auth)
- Sandboxing: https://learn.chatgpt.com/docs/sandboxing
- Windows sandbox: https://learn.chatgpt.com/docs/windows/windows-sandbox
- Issue tracker (search here first when something breaks): https://github.com/openai/codex/issues

## Flags

| Flag | What it does |
|---|---|
| `--cd, -C <path>` | Workspace root for the run |
| `--sandbox, -s <read-only\|workspace-write\|danger-full-access>` | Sandbox policy. **Default with no flags: read-only** |
| `--ask-for-approval, -a <untrusted\|on-request\|never>` | Approval policy. Use `never` headless |
| `--dangerously-bypass-approvals-and-sandbox` (`--yolo`) | Full bypass — "only use inside an isolated runner" |
| `--full-auto` | Deprecated; use explicit `--sandbox` instead |
| `-c, --config key=value` | Inline config override, repeatable (e.g. `-c sandbox_workspace_write.network_access=true`) |
| `--ignore-user-config` | Skip `$CODEX_HOME/config.toml` entirely — use when the global config must not interfere |
| `--json` | stdout becomes a JSONL event stream (see below) |
| `--model, -m <id>` | Model override |
| `-o, --output-last-message <path>` | Write final message to a file |
| `--output-schema <path>` | Enforce final response against a JSON Schema file |
| `--ephemeral` | Don't persist a session rollout file |
| `--skip-git-repo-check` | Allow running outside a git repo (required otherwise) |
| `codex exec resume --last` / `resume <SESSION_ID>` | Continue a prior exec session |

Prompt input: positional arg, `-` for stdin-as-prompt, or pipe + positional arg (arg = instruction, piped content = context).

## Output

- Plain mode: progress → stderr, final agent message → stdout (only that).
- `--json` mode: JSONL events on stdout. Types: `thread.started` (has `thread_id` — this is the SESSION_ID for `resume`), `turn.started`, `item.started`/`item.updated`/`item.completed` (each with `item: {id, type, status, ...}`), `turn.completed` (has `usage` token counts), `turn.failed`, `error`.
- Final answer = the `item.completed` event where `item.type == "agent_message"` (its `text` field).
- Field-level shapes beyond the ones above aren't fully documented — inspect one real `codex exec --json "ls" < /dev/null` run before hard-coding a parser.

## Exit codes — don't trust them

No official exit-code table exists, and Codex has exited **0 on Ctrl+C/SIGINT** ([#4721](https://github.com/openai/codex/issues/4721)). Verify success via `turn.completed` in the `--json` stream or via the `-o` file's existence + content, then verify claimed *effects* against git/filesystem ground truth.

## Sandbox semantics

- `read-only`: no writes. `workspace-write`: writes inside workspace root only, **network blocked by default** — enable per-run with `-c sandbox_workspace_write.network_access=true`. `danger-full-access`: no boundaries.
- Under `-a never`, a sandbox-blocked action fails back to the model as a tool-call error — no hang, no prompt.
- Non-zero exit from a tool the model runs can hide that tool's output from the model ([#1367](https://github.com/openai/codex/issues/1367)) — for linters/tests where non-zero means "findings", have the prompt tell Codex to append `|| true`.
- Sandboxed "build/tests pass" is not trustworthy when the sandbox network posture differs from the real environment (e.g. a build failing at a font fetch before typechecking ever ran).
- MCP tool calls in exec mode get auto-cancelled (stdin closed → approval prompt reads EOF as reject); only the full bypass flag works around it — avoid designs that need MCP tools inside headless Codex ([#24135](https://github.com/openai/codex/issues/24135)).

## Auth (subscription, no API keys)

- `codex login` = browser OAuth against the ChatGPT plan; credentials at `~/.codex/auth.json` (treat as a password). Tokens auto-refresh during use; mid-run expiry behavior is undocumented.
- Setting `OPENAI_API_KEY` or `CODEX_API_KEY` switches billing to API rates. Precedence when both auths exist is buggy ([#3286](https://github.com/openai/codex/issues/3286)) — just never set them.

## Timeouts and process management

- **No whole-run timeout, and no per-tool-call timeout inside a turn.** A runaway shell command inside Codex can hang the turn indefinitely and silently drop turn state. Enforce the deadline from the caller: Bash-tool `timeout` foreground, or `run_in_background` for long runs.
- If a run must be killed: kill the process tree (`taskkill /T /F /PID <pid>` on Windows), then read the session rollout for partial work.
- Rollouts: `~/.codex/sessions/YYYY/MM/DD/rollout-<local-timestamp>-<uuid>.jsonl`, written incrementally (partial state generally survives a kill; no fsync guarantee documented). `--ephemeral` or `history.persistence = "none"` disables. Resume replays history but does not resurrect an in-flight tool call.

## Windows specifics

- **The stdin hang (SKILL.md rule 1) is the big one** — reproduced with PowerShell spawned by Claude Code, exactly this use case ([#20919](https://github.com/openai/codex/issues/20919)). PowerShell has no `<` redirection operator, so run Codex calls through Git Bash (`< /dev/null`) or cmd (`< NUL`).
- Two sandbox implementations via `[windows] sandbox = "elevated" | "unelevated"` in config.toml; unelevated (the non-admin fallback) has documented weaker network isolation ([source](https://learn.chatgpt.com/docs/windows/windows-sandbox)).
- Sandbox-setup helper can crash with `STATUS_DLL_INIT_FAILED` (`0xC0000142`) on specific directories (stale sandbox-user SIDs from old versions) — every command in the run fails instantly with that status. Check `~/.codex/.sandbox/sandbox.<date>.log`; often transient.
