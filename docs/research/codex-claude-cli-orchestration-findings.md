# Findings: Teaching Claude Code to Drive Codex CLI (and Itself) Programmatically

Status: **research complete — the skill was built from this document** (`skills/estack-drive-cli-agent/`, added 2026-07-22, then trimmed by a four-lens adversarial review: clarity, overcomplication, KISS, overengineering). This doc is the full research record behind it: flag semantics, footguns with sources, the openai-codex plugin failure autopsy, and prior art. When editing that skill, check claims against the cited URLs — both CLIs move fast and this snapshot is from 2026-07.

*Reconciliation note (2026-07-21): this document's first draft predates today. Every citation was re-verified live this session — GitHub issue numbers spot-checked via `gh issue view`/`gh pr view` (all confirmed real and accurate), official doc pages re-fetched directly, and live local state re-checked (`~/.codex/config.toml`) — with several corrections and additions folded in inline where marked "verified this session" / "live-verified this session." Where the original draft's figures had gone stale (issue counts) or the live system state had changed since it was written (config.toml's `approval_policy`), the text now reflects current reality with the discrepancy called out explicitly rather than silently overwritten.*

Scope recap: CLI-only, non-interactive invocation on both sides (`claude -p` / `codex exec`), under existing logged-in subscriptions (Claude Pro/Max, ChatGPT/Codex plan) — not the Agent SDK, not raw API-key billing.

---

## 1. Claude Code CLI — headless/print mode deep dive

Sources fetched live this session: `code.claude.com/docs/en/headless`, `/cli-reference`, `/permission-modes`, `/sessions`, `/errors`, `/env-vars`, `/best-practices`, `/tools-reference`.

### 1.1 Framing note — read before anything else

Anthropic's current docs page for `-p` is titled **"Run Claude Code programmatically"** and opens with: *"The Agent SDK gives you the same tools, agent loop, and context management that power Claude Code. It's available as a CLI for scripts and CI/CD... This page covers using the Agent SDK via the CLI (`claude -p`)."*

So as of today, Anthropic no longer treats "headless CLI" as a distinct thing from "the SDK" — `claude -p` **is** documented as the Agent SDK's CLI entry point. This doesn't change the billing/auth mechanics the task cares about (that's governed by `--bare` and `ANTHROPIC_API_KEY`, see 1.3), but the new skill's docs/description should not claim "this isn't the SDK" as a factual distinction — it should instead say "this uses the CLI form of the Agent SDK, authenticated via your existing subscription login, not API-key billing." Get ahead of this framing so it doesn't read as wrong to someone who's read the current docs.

### 1.2 Invocation & flags relevant to scripted use

Core: `claude -p "prompt"` (or `--print`). All flags below work with `-p`.

| Flag | What it does | Notes |
|---|---|---|
| `--bare` | Skips auto-discovery of hooks, skills, plugins, MCP servers, auto-memory, CLAUDE.md | **See 1.3 — also skips OAuth.** Anthropic's docs call this "the recommended mode for scripted and SDK calls" and say it "will become the default for `-p` in a future release." |
| `--output-format` | `text` (default) / `json` / `stream-json` | See 1.4 |
| `--input-format` | `text` (default) / `stream-json` | For streaming stdin |
| `--json-schema '<schema>'` | Forces structured output into a `structured_output` field alongside `result` | Requires `--output-format json`. Invalid schema → `Error: --json-schema is not a valid JSON Schema` + validator diagnostic. Accepts `format` (e.g. `"format":"email"`) as an annotation only — not enforced. |
| `--allowedTools` | Auto-approves listed tools/rules, e.g. `"Bash,Read,Edit"` or scoped rules like `Bash(git diff *)` | The mechanism the docs actually use for "restrict what Claude can do without prompting." |
| `--disallowedTools` | Denies tools; a bare name (`"Edit"`) removes the tool from context entirely, a scoped rule (`Bash(rm *)`) denies only matching calls | |
| **`--tools` does not exist.** | — | A colleague's draft snippet used `--tools "Read,Grep,Glob"`. Verified directly against the CLI reference: no such flag is documented. Use `--allowedTools`/`--disallowedTools` instead. |
| `--permission-mode` | `default` (alias `manual`), `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` | Full valid set, confirmed. See 1.6 for what each actually allows without prompting. |
| `--dangerously-skip-permissions` | Equivalent to `--permission-mode bypassPermissions` | Refuses to start under root/sudo on Linux/macOS outside a recognized sandbox. |
| `--continue` / `-c`, `--resume`/`-r <id>`, `--session-id <uuid>`, `--fork-session` | Session continuation | See 1.3 for the worktree-scoping footgun. |
| `--no-session-persistence` | Suppresses transcript writes for **one** non-interactive run | Confirmed to exist (it's on `/cli-reference` and `/sessions`, the colleague's snippet had this right). |
| `--mcp-config <file-or-json>`, `--settings <file-or-json>`, `--agents <json>`, `--plugin-dir`, `--plugin-url` | Load config explicitly | Needed in `--bare` mode since nothing is auto-discovered. |
| `--add-dir <path>` | Grants file access to an extra directory | Does **not** persist across `--resume` unless re-passed (see 1.3). |
| `--model` | `opus`/`sonnet`/`haiku`/`fable` or full model id | |
| `--append-system-prompt[-file]` / `--system-prompt[-file]` | Extend or replace the system prompt | |
| `--max-turns` | Caps agentic turns, print mode only, exits with error at the limit | |
| `--max-budget-usd` | Stops when spend hits the cap, print mode only | |
| `--verbose`, `--include-partial-messages`, `--forward-subagent-text` | Streaming verbosity | Needed for token-level `stream-json` output and to see subagent text/thinking blocks (v2.1.211+). |
| `--permission-prompt-tool` | An MCP tool that answers permission prompts non-interactively | Waits up to the 30s `MCP_TIMEOUT` for that server to connect (v2.1.206+); before that version a slow server could make the whole run exit with "MCP tool not found." |

### 1.3 Auth — the load-bearing footgun for subscription-only automation

- `ANTHROPIC_API_KEY`, if set, **silently overrides** a logged-in Pro/Max/Team/Enterprise subscription in `-p` mode (no prompt, unlike interactive mode). **For subscription-only automation, the calling environment must not have this env var set.**
- **`--bare` mode skips OAuth and keychain reads entirely.** Its own docs state: *"Anthropic authentication must come from `ANTHROPIC_API_KEY` or an `apiKeyHelper`."* This is a direct conflict with the subscription-only requirement — and it's the mode Anthropic recommends by default for scripted calls and says will become the `-p` default. **The new skill must explicitly NOT use `--bare` when subscription auth is required**, and should say so, because the docs' own default nudge points the other way.
- There is no documented env var to inject an OAuth token for headless use (no `CLAUDE_CODE_OAUTH_TOKEN` in the official env-vars reference). Subscription auth in headless mode depends entirely on having run interactive `claude /login` at least once beforehand on that machine.
- **Login expiry has no headless recovery path.** From `/errors`: an expired login (that can't silently refresh) surfaces as `Login expired · Please run /login` — but `/login` is a slash command not available in `-p` mode. A long-lived automation whose token expires mid-script has no self-heal option; it just fails until a human runs interactive login again. Worth a periodic health-check pattern in the skill (e.g. a cheap `claude -p "ok" --output-format json` canary before a batch of real work).
- **Session resume is scoped to the current project directory and its git worktrees** — resuming from a different directory reports `No conversation found with session ID: <id>`. This is a direct parallel to the Codex sibling-worktree bug (§4) and matters for any orchestration that resumes a Claude session across worktrees.
- Rate/usage limits (session, weekly, Opus-specific) block all models until reset except the Opus limit, which has a `--model` escape hatch (switch to Sonnet/Haiku). 429s are retried automatically with backoff for subscriptions since v2.1.199; 529 overload doesn't count against quota.

### 1.4 Output parsing

- `--output-format json`: response includes at minimum a `result` field (the text answer), `session_id`, and — per the docs' own words — "the response payload includes `total_cost_usd` and a per-model cost breakdown." **I could not independently verify the exact field names for error signaling** (a colleague's draft assumed `is_error`/`error_message`/`usage.input_tokens` — plausible but not confirmed verbatim on any fetched page). **Recommendation: the skill should have the calling agent run one throwaway `claude -p "..." --output-format json` and inspect actual keys before hard-coding a parser, rather than trusting an assumed schema.**
- `--output-format stream-json`: NDJSON, one JSON object per line. Confirmed event shapes:
  - `system/api_retry` — `{type, subtype:"api_retry", attempt, max_retries, retry_delay_ms, error_status, error, uuid, session_id}`, where `error` is one of `authentication_failed | oauth_org_not_allowed | billing_error | rate_limit | overloaded | invalid_request | model_not_found | server_error | max_output_tokens | unknown`.
  - `system/init` — first event, reports model/tools/MCP servers/plugins, `plugins`/`plugin_errors` arrays (use `plugin_errors` to fail CI when a plugin didn't load), and (v2.1.205+) a `capabilities` string array for feature-detection instead of version comparison.
  - Final line is a `result` message with text, cost, session metadata — **before v2.1.208, a large piped response could truncate the final line and drop the `result` message entirely.** Pin to a version at/after 2.1.208 if relying on this.
  - Subagent messages carry `parent_tool_use_id` (null for main conversation); by default only subagent `tool_use`/`tool_result` blocks stream — pass `--forward-subagent-text` to also get subagent text/thinking.
- `--json-schema` output: structured payload lands in a separate `structured_output` field, `result` still present alongside it.
- `jq` is the documented parsing tool of choice in Anthropic's own examples (`... | jq -r '.result'`).

### 1.5 Exit codes — weaker than expected

Officially documented: **0 = success, 1 = general error, 137 = OOM-killed during `claude install`** specifically (not a general runtime OOM code). **There is no documented fine-grained exit-code table** — tool-denied, permission-denied, auth-failed, schema-invalid, and turn-limit-exceeded all appear to just be "exit 1 with a distinguishing message," not distinguishable exit codes. **Don't design the skill around exit-code branching for failure type — parse the error text/JSON instead.**

### 1.6 Non-interactive footguns

- **`dontAsk` mode auto-denies** anything not in `permissions.allow` or the built-in read-only command set — including `AskUserQuestion`, org-`ask` connector tools, and any MCP tool marked `requiresUserInteraction`, **even if an allow rule matches them.** There's no fallback prompt; the run just proceeds without that action or aborts.
- **`acceptEdits` mode** auto-approves file edits plus a specific allowlist of filesystem Bash commands (`mkdir, touch, rm, rmdir, mv, cp, sed`, plus PowerShell-tool equivalents `Set-Content/Add-Content/Clear-Content/Remove-Item` when that tool is active) — but **any other shell command or network request still needs an explicit `--allowedTools` entry, and the run aborts when one is attempted without one.** This is a common "worked in my quick test, broke on the real task" trap.
- **`auto` mode in non-interactive runs has no fallback.** In the interactive CLI, 3 consecutive or 20 total classifier blocks pause and re-prompt the user; **in `-p` mode there's no user to prompt, so the session just aborts.** Also specific to non-interactive: the classifier normally re-checks a sandbox network deny at the next interactive turn boundary, but "in non-interactive mode and Agent SDK sessions there is no turn boundary, so a deny is reused for the rest of the run" — one denied host early in a long run poisons every later attempt to reach it.
- **`bypassPermissions` shows no acceptance dialog in non-interactive mode** — and a background session started with `--bg` is refused entirely until the dialog has been accepted once in an interactive session on that machine. Can't fully bootstrap bypass-mode automation from zero without one manual interactive step first.
- **Protected paths** (`.git`, `.claude`, `.mcp.json`, shell rc files, etc.) are never auto-approved for writes in any mode except `bypassPermissions` — including `dontAsk`, where they're flatly denied, and `auto`, where they're routed to the classifier regardless of allow rules.
- Bash tool timeouts: `BASH_DEFAULT_TIMEOUT_MS` (120000/2min default) and `BASH_MAX_TIMEOUT_MS` (600000/10min ceiling the model itself can set per-command). API request timeout: `API_TIMEOUT_MS` (600000/10min default, can raise to `2147483647`). A background Bash task started during `-p` is killed ~5 seconds after Claude returns its final result and stdin closes — background **subagents/workflows** are exempt and instead wait up to `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` (10 min default, `0` = unlimited).
- **No built-in whole-process timeout** — if the caller wraps `claude -p` externally (`timeout 300 claude -p ...`) and sends SIGTERM/SIGKILL, Claude Code does not document what happens to partial output or session state; treat it as unspecified and verify empirically if it matters.

### 1.7 Windows / piping specifics

- Piped stdin capped at **10 MB** (since v2.1.128) — exceeding it exits with a clear error; write to a file and reference the path instead for larger input.
- If the piping process disconnects stdout early, Claude Code (v2.1.211+) prints a stderr warning and continues with just the CLI prompt argument; **before v2.1.211, an unreadable stdin on Windows crashed the session or exited silently with no output** — a real trap if the skill will be used on an older install.
- Session transcripts: `~/.claude/projects/<project>/<session-id>.jsonl` (`%USERPROFILE%` on Windows), project name = cwd path with non-alphanumerics replaced by `-`. **Anthropic explicitly warns the entry format changes between versions and "scripts that parse these files directly can break on any release" — use `/export`, `claude -p --resume <id> --output-format json`, or hook `transcript_path` fields instead of parsing the JSONL directly.** This is exactly the mistake the installed Codex plugin does NOT make for Claude's side, but is worth stating as a rule for the new skill regardless.

---

## 2. Codex CLI — `exec` mode deep dive

Docs location note: `openai/codex`'s in-repo `docs/*.md` files (exec.md, sandbox.md, authentication.md, config.md) have been reduced to redirect stubs pointing to `developers.openai.com/codex/...`, which itself 308-redirects to `learn.chatgpt.com/docs/...`. All citations below are the final live URLs after following those redirects, fetched this session.

### 2.1 Invocation & flags

```
codex exec "prompt"
```
Progress streams to **stderr**; only the final agent message goes to **stdout** — by design, so `codex exec "..." | tee out.md` is safe.

| Flag | What it does |
|---|---|
| `--cd, -C <path>` | Sets workspace root before executing |
| `--sandbox, -s <read-only\|workspace-write\|danger-full-access>` | Sandbox policy, defaults to config |
| `--ask-for-approval, -a <untrusted\|on-request\|never>` | Approval policy |
| `--dangerously-bypass-approvals-and-sandbox` (alias `--yolo`) | Full bypass — docs mark "only use inside an isolated runner." Confirmed as the exact flag name a colleague's memory note referenced. |
| `--full-auto` | **Deprecated** compatibility flag; prefer `--sandbox workspace-write` explicitly |
| `-c, --config key=value` | Inline config override, repeatable |
| `--profile, -p <name>` | Layers `$CODEX_HOME/profile-<name>.config.toml` on top |
| `--ignore-user-config` | Skip `$CODEX_HOME/config.toml` (auth still resolves via `CODEX_HOME`) |
| `--json` (alias `--experimental-json`) | Switches stdout to JSONL event stream — see 2.5 |
| `--model, -m <string>` | Model override |
| `-o, --output-last-message <path>` | Writes final message to a file (also still prints to stdout) |
| `--output-schema <path>` | Enforces the final response against a JSON Schema file, written via `-o` |
| `--ephemeral` | Don't persist session rollout files for this run |
| `--skip-git-repo-check` | Allow running outside a git repo (default requires one — see 2.4) |
| `codex exec resume --last "<follow-up>"` / `codex exec resume <SESSION_ID>` | Resume a prior exec session, optionally with a new prompt |

Prompt input: positional argument, or `-` to force reading the whole prompt from stdin, or a piped stream combined with a positional argument (argument = instruction, piped content = appended context).

**Open question, not resolved by docs:** exact precedence between `-c`/CLI flags and `config.toml` values — asserted by convention ("override for this run") but no explicit precedence table found.

### 2.2 Auth — a second version of the same subscription-vs-automation tension

- `codex login` = browser OAuth (ChatGPT subscription). `printenv OPENAI_API_KEY | codex login --with-api-key` = API key, billed at standard API rates instead of plan credits.
- Credentials cache at `~/.codex/auth.json` (or OS credential store, per `cli_auth_credentials_store` config) — docs explicitly warn to treat it like a password.
- Token refresh is automatic during use before expiry — "active sessions usually continue without requiring another browser login." No documentation of what happens if a token expires *mid-run* of a long `codex exec` call.
- **OpenAI's own docs state: "API keys are still the recommended default for automation."** This directly parallels Claude Code's `--bare` nudge (§1.3) — both vendors steer scripted use toward API-key billing, and both require a deliberate choice to keep subscription auth for headless work.
- For CI/headless use while staying on subscription auth, three paths are documented: `codex login --device-auth` (beta device-code flow), copying `auth.json` to the target machine, or SSH-tunneling the local OAuth callback port. There's also an advanced "ChatGPT-managed auth in CI/CD" path, explicitly scoped to enterprise/trusted-runner scenarios, not public/open-source repos.
- `CODEX_API_KEY` is a **separate, exec-only** env var for inlining a key for one invocation (`CODEX_API_KEY=<key> codex exec ...`) — distinct from `OPENAI_API_KEY`. Docs warn against setting either as a job-level CI env var where untrusted code in the same job could read it.
- **Precedence between `OPENAI_API_KEY` and an active ChatGPT login is an open/documented bug, not a clean answer**: GitHub issue `openai/codex#3286` — verified this session, title exactly "Sign in with API key via environment variable cannot be used if ChatGPT subscription login is active" — reports the ChatGPT login silently wins even with the key set, and still prints a misleading "set OPENAI_API_KEY" message. Issue shows closed on GitHub with no visible resolution text in the fetched content. **Recommendation: don't rely on this precedence — for subscription-only automation, simply never set `OPENAI_API_KEY`/`CODEX_API_KEY` in the environment the skill runs in**, and verify empirically against the installed CLI version (locally: `codex-cli 0.144.4`) if precedence ever matters.
- **A third, better-fitting auth path exists for pure-subscription automation, but has a hard eligibility gate**: `CODEX_ACCESS_TOKEN` (`printf '%s' "$CODEX_ACCESS_TOKEN" | codex login --with-access-token`, or `export CODEX_ACCESS_TOKEN=... ; codex exec --json ...` directly) — "ChatGPT workspace credentials scoped to Codex permissions," designed exactly for "trusted non-interactive local workflows" without a browser sign-in per run. Source: `learn.chatgpt.com/docs/enterprise/access-tokens`, fetched live this session. **The gate**: "currently supported only for ChatGPT Business and Enterprise workspaces — not free or Plus tiers." If the target account is a personal ChatGPT Plus/Pro seat rather than a Business/Enterprise workspace, this path is unavailable and plain `codex login` (personal browser OAuth → `~/.codex/auth.json`) remains the only pure-subscription, non-API-key option — looping back into the same automation-vs-subscription tension OpenAI's own docs flag.

### 2.3 Sandbox & approval semantics

- **Default with zero flags: read-only sandbox.** (Direct quote from the official non-interactive guide.) `workspace-write` allows edits inside the workspace root and "routine local commands"; `danger-full-access` removes all filesystem/network boundaries.
- **Network access under `workspace-write` is opt-in, not default** — the config reference exposes `sandbox_workspace_write.network_access` as a boolean; its existence as something you must explicitly enable implies git/npm network calls are blocked under plain `workspace-write` unless set. **Live-verified this session** (`~/.codex/config.toml`, re-checked directly): `sandbox_mode = "danger-full-access"`, **`approval_policy = "on-request"`** — this is a change from an earlier `"never"` snapshot; Elliot revised it interactively on 2026-07-19→20 ("i want full access just with approval checked by ai"), and also removed a `[windows] sandbox = "elevated"` override that was previously silently taking precedence over the top-level `sandbox_mode` on Windows. **Implication for the skill**: don't assume `approval_policy = "never"` from the global interactive config — a headless automated run should set its own `--ask-for-approval never` explicitly per-invocation (via `-a never` or `-c approval_policy=never`) rather than relying on whatever the user's interactive global posture happens to be at the time, since that value is proven to drift. This does not apply to the plugin's forced-`workspace-write` override, which is a separate, plugin-layer hardcode — see §4.
- **Sandbox denial detection is a text-matching heuristic, not a structured signal**, per the CLI's own source (referenced via `openai/codex#18711`): a function matches keywords like "sandbox," "permission denied," "operation not permitted" across combined stdout/stderr — known to false-positive on legitimate output containing those words.
- **With `approval_policy=never` (the only sane setting for headless use), a blocked action fails and is returned to the model as a tool-call error — it does not hang and does not silently no-op.** The interactive "retry without sandbox?" prompt only exists when there's a TTY to answer it.
- **MCP tool calls are a known, currently-open gap in exec mode**: `openai/codex#24135` reports MCP tool calls get auto-cancelled in `codex exec` because stdin is closed and the approval prompt receives EOF (read as rejection) — none of `approval_policy=never`, `mcp_approval_policy=never`, or other guessed config keys fix it; only the full `--dangerously-bypass-approvals-and-sandbox` bypass works, which also disables sandboxing entirely. **If the new skill ever wants Codex to use MCP tools headlessly, this is a hard current limitation to design around or explicitly avoid.**
- Requires being inside a git repo by default ("to prevent destructive changes"); override with `--skip-git-repo-check`.

### 2.4 The single most load-bearing footgun: stdin hang on Windows/PowerShell

**`openai/codex#20919`** — "`codex exec '<prompt>'` hangs indefinitely when stdin is a non-TTY pipe with no writer" — was reproduced with the **exact scenario at hand**: PowerShell spawned by Claude Code, inherited-but-unwritten piped stdio. Codex detects piped stdin and blocks on `read()` waiting for EOF that never arrives, even though a full prompt was already supplied as an argument. Reported open as of the fetch, against codex-cli 0.128.0 and prior on Windows 11 (locally installed: 0.144.4 — verify whether it's fixed before relying on this being resolved).

**Documented workaround — always redirect stdin explicitly:**
- POSIX / Git Bash: `codex exec "prompt" < /dev/null`
- Windows cmd: `codex exec "prompt" < NUL`
- From a PowerShell parent (Claude Code's Bash tool on this machine runs Git Bash, but if PowerShell is used directly): `cmd /c "codex exec \"prompt\" < NUL"`

This must be a hard rule in the new skill, in bold, not a footnote — it is exactly the trap for "Claude Code driving Codex CLI on Windows," which is this project's actual environment. (Related, same family: `#19945` "silently crashes with no output when stdio is detached from TTY", `#27019` "hangs at 'Reading additional input from stdin...'" with `TERM=dumb`.)

### 2.5 Output parsing (`--json`)

JSONL, one event per line. Documented event types: `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.started`/`item.updated`/`item.completed`, `error`. Item types include agent messages, reasoning, command execution, file changes, MCP tool calls, web searches, plan updates.

```jsonl
{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"..."}}
{"type":"turn.completed","usage":{"input_tokens":24763,"cached_input_tokens":24448,"output_tokens":122,"reasoning_output_tokens":0}}
```

- **Reliable success/failure signal**: `turn.completed` = success (carries token usage), `turn.failed` = failure (carries error details).
- **Simplest reliable "get me the final answer" pattern, officially supported and recommended over parsing the full stream**: skip `--json` entirely and just capture stdout (it's *only* the final message by design), or use `-o/--output-last-message <path>` regardless of mode. Combine with `--output-schema` for a schema-conformant result written straight to a file — this is the cleanest machine-parseable path and avoids stream-parsing altogether.
- **Known parsing footgun**: `openai/codex#14691` — an item can end with an inconsistent `status` if the turn ends mid-item; don't assume every `item.started` gets a matching `item.completed` before `turn.completed`/`turn.failed`.
- **Field-level schema, directly re-verified this session against a fresh fetch of the live docs page** (not a search-engine summary): only these fields are actually shown in the page's own JSON examples — `{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"bash -lc ls","status":"in_progress"}}`, `{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"..."}}`, `{"type":"turn.completed","usage":{"input_tokens":...,"cached_input_tokens":...,"output_tokens":...,"reasoning_output_tokens":...}}`. A richer field list (`aggregated_output`, `exit_code` on `command_execution`; `changes[].path/kind` on `file_change`; `server`/`tool`/`arguments`/`result`/`error` on `mcp_tool_call`) was reported by a research pass but **could not be re-confirmed verbatim on the primary doc page** — treat those specific extra field names as plausible but unverified, and confirm empirically (`codex exec --json "ls"` and inspect real output) before hard-coding a parser against them. Full field-level schema for the `error` object in `turn.failed`, and a complete `item.type` enumeration, were not found in the fetched docs — the maintainers' own source (`codex-rs`) would be the ground truth, not located this session.

### 2.6 Exit codes — even weaker than Claude Code's

No dedicated exit-code reference page exists. Confirmed data points only:
- **`openai/codex#4721`**: on Ctrl+C/SIGINT during `codex exec`, the process currently exits **0 (success)** instead of a conventional 130. Shown closed on GitHub with no visible resolution — **treat "exit 0 on interrupt" as a live risk and do not trust exit code alone after a timeout-kill.**
- A `required=true` MCP server that fails to initialize causes exec to exit with an error instead of continuing.
- `--oss` without `--local-provider`/`oss_provider` config exits with an error.
- **A separate, unrelated trap**: the exit code of a *shell command the model itself runs inside the sandbox* can suppress Codex's visibility into that tool's stdout/stderr when non-zero (`openai/codex#1367`) — e.g. linters that use non-zero exit for "findings, not failure" (flake8/eslint/pytest). Workaround mentioned in the issue: append `|| true` to such commands so Codex still sees the output. This is about tool calls Codex makes internally, not `codex exec`'s own process exit code, but will bite any pipeline built around lint/test delegation.

**Recommendation: verify success via the `--json` stream's `turn.completed`/`turn.failed` or via checked output content (`-o` file existence + non-empty), never via process exit code alone.**

### 2.7 Other non-interactive footguns

- **No built-in whole-run timeout, and no per-tool-call timeout inside a turn either.** The only timeout-shaped config keys are per-MCP-server startup/tool timeouts and a `background_terminal_max_timeout` (5 min default) for background-terminal polling — none of these cap a whole `codex exec` invocation or an individual shell command Codex runs internally. **Corroborated by real usage history this session** (Codex running as a backend model behind a third-party gateway, not the Claude Code plugin, but evidence about Codex's own execution engine): a `bun run test` shell call hung 424s–15.8min while other calls completed around it; Codex's app-server logged `dropping turn tool count update: missing turn state` and never delivered a `tool.result`, even though `model.completed` fired elsewhere — a runaway shell command inside a turn can silently drop that turn's state with no error surfaced. Filed upstream as `openclaw/openclaw#95474`. **The caller must enforce its own wall-clock timeout at every level — the whole invocation and, if scripting multiple internal tool calls matters, be aware Codex itself provides no backstop** — same conclusion as Claude Code (§1.6), but with an extra layer of risk since even Codex's own internal tool calls aren't time-boxed.
- **On-disk durability under SIGKILL is undocumented.** Rollout files are written incrementally as JSONL, which structurally suggests partial state survives a hard kill, but no first-party fsync/flush guarantee was found. A documented resume caveat: resuming replays conversation history but does not resurrect an in-flight tool call that was mid-execution.
- **Sibling git-worktree "Access denied" — root cause confirmed, and a fix has shipped upstream in the CLI itself** (separate from the plugin-layer bug in §4). `openai/codex#PR21409` ("Fix Windows sandbox git safe.directory for worktrees"): a worktree's `.git` is a *file* pointing into the main repo's `.git/worktrees/<name>/`; the Windows sandbox helper injected `safe.directory` for that internal path instead of the actual worktree root, so git's dubious-ownership check failed inside worktree checkouts specifically. Fixed and merged (treats `.git` file-or-dir uniformly, resolves to worktree root). **Verify the installed Codex CLI version is newer than this merge before assuming sandboxed git-inside-worktree "just works" — locally installed is 0.144.4, likely post-fix but not independently confirmed this session.** Note this is a *different* bug from the plugin's own worktree failure (§4), which is a plugin-layer flag-forwarding gap that exists regardless of whether the underlying Codex CLI has this fix.
- **Windows has two distinct sandbox implementations, and the weaker one is silent about being weaker.** Config key `[windows] sandbox = "elevated"` (recommended default, requires admin rights: uses dedicated lower-privilege sandbox users, filesystem permission boundaries, firewall rules) vs `"unelevated"` (fallback for non-admin accounts: a restricted Windows token plus ACL-based filesystem boundaries, "weaker network isolation" per OpenAI's own docs — `learn.chatgpt.com/docs/windows/windows-sandbox`, fetched live this session). **If the machine running the skill doesn't have admin rights, sandboxed network isolation is documented as measurably weaker than the recommended mode** — worth checking `[windows]` in `config.toml` (or its absence, which defaults to elevated-if-available) before assuming sandbox network blocking is reliable on Windows.
- Windows shell-quoting issues turn up repeatedly in the open issue tracker (PowerShell-only syntax executed under cmd, `python.exe` crashing on `0xC0000142` from a bad Git-Bash→PowerShell→python chain, quoted multi-word args not surviving `cmd.exe /c`) — none confirmed fixed, several Desktop-app-specific rather than CLI-confirmed. Treat as "test empirically on the target Windows CLI version," not "assume broken or assume fixed."
- **Directly observed on this machine, via session history**: the Windows sandbox-setup helper (`codex-windows-sandbox-setup.exe`) can crash with `STATUS_DLL_INIT_FAILED` (`0xC0000142`) — every process the sandbox tries to run, including trivial ones like `Get-Location`, exits immediately with no work done. Root-caused (session `6610b65e…`, 2026-07-06→07) to the helper choking while reconciling ACLs on a specific cwd, tied to stale/dangling SIDs left over from older Codex versions' per-directory synthetic-account sandbox model. It self-resolved the next day without an explicit ACL fix being applied. Diagnostic log to check if it recurs: `~/.codex/.sandbox/sandbox.<date>.log`. This is a distinct failure from the git-worktree `safe.directory` bug above — same general area (Windows sandbox setup) but a different root cause, and one the CLI itself doesn't surface a clear error for (the model just reports every command failing with an opaque status code).
- No documented hard per-run turn/token cap; the practical limiter is context-window size plus automatic compaction (referenced in OpenAI's cookbook, not independently fetched this session — lower confidence).

### 2.8 Session storage

`~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<session-id>.jsonl`, each line a timestamped `RolloutLine` wrapping user/assistant/tool-call/usage records — structurally similar to but not identical to the `--json` event stream. `history.persistence = "save-all"|"none"` config key controls whether these get written at all; `--ephemeral` is the CLI-flag equivalent for a single run. (Path pattern corroborated by Elliot's own prior memory note on Codex session files; exact `RolloutItem`/`RolloutLine` field schema was not independently verified against `codex-rs` source this session — treat field-level detail as inferred, not quoted.)

**Practical read-back pattern**: don't use `--ephemeral`, capture the session/thread id from the first `--json` event or from `codex exec resume --last`, read the corresponding rollout file if stdout/`-o` isn't sufficient.

---

## 3. Prior art — what already exists

### 3.1 Local marketplace scan

Nothing in the currently-installed marketplaces (`claude-plugins-official`, `anthropic-agent-skills`, `impeccable`) directly tackles CLI-to-CLI AI orchestration. Two adjacent things worth knowing:
- **`ralph-loop`** (`claude-plugins-official`) — Claude looping on *itself* via a Stop hook, not cross-CLI, but documents a real Windows gotcha that will recur here too: bare `bash` in a hook command can resolve to a misconfigured WSL bash instead of Git Bash, breaking silently — fixed by hardcoding `C:/Program Files/Git/bin/bash.exe`.
- **`impeccable`** marketplace — ships one skill compiled for many agent CLIs' native formats (`.claude/`, `.codex/`, `.cursor/`, etc.) via a build step, not a runtime driver. Pattern reference only ("author once, target every agent"), not runtime delegation.

### 3.2 The closest direct analog — read this one first when building

**`skills-directory/skill-codex`** (`github.com/skills-directory/skill-codex`) — a Claude Code `SKILL.md` that already does almost exactly what's being scoped here: shells out to `codex exec` under a real subscription. Notable choices worth adopting directly:
- Always passes `--skip-git-repo-check`.
- **Already documents the stdin-hang trap from §2.4** — explicitly requires closing stdin (`</dev/null`) in non-TTY/background invocation or the process hangs.
- Scales execution timeout to the chosen reasoning effort (150s–1200s) rather than one fixed number.
- Treats Codex's output as "a peer suggestion, not authority" — the calling agent is told to independently validate and flag disagreements rather than blindly relaying Codex's answer. This is a good default posture for any second-opinion/delegation skill.

### 3.3 Most architecturally mature — worth reading before designing the transport layer

**`awslabs/cli-agent-orchestrator`** (official AWS Labs project, `github.com/awslabs/cli-agent-orchestrator`, with an AWS Open Source blog post). Each agent CLI (Claude Code, Codex CLI, Cursor CLI, Kiro, Copilot CLI, OpenCode) runs as its own subprocess **inside a dedicated tmux session**, not scraped from raw stdout — a supervisor talks to workers over a local MCP HTTP server using three primitives: `handoff` (sync), `assign` (async fire-and-forget), `send_message` (inbox). This sidesteps stdout-scraping entirely via PTY + MCP. Auth is deliberately *not* centralized — each CLI keeps its native credentials, avoiding a class of session-hijacking bugs. `docs/codex-cli.md` in that repo documents their own Codex-specific flag/PTY special-casing and is worth reading directly if the new skill ever needs PTY-level control (this doc scoped exec-mode-only, so likely not needed, but flagging it exists).

### 3.4 A worked negative example — cite this as what NOT to do

**Agent Council family** (`team-attention/agent-council`, `yogirk/agent-council`, others) — poll N CLIs in parallel, synthesize with a "chairman." The representative implementation **captures raw text output, not structured JSON** — no validation of malformed responses, no fallback if a member CLI fails, silent failure if a CLI isn't installed. This is precisely the text-scraping trap both `--json`/`stream-json` output modes exist to avoid, and a clean citable negative example for the new skill's design rationale.

### 3.5 Looping/retry precedent

`mikeyobrien/ralph-orchestrator` — the "grown-up" version of the local `ralph-loop` plugin, supports Claude Code, Codex, Gemini CLI, and others as interchangeable backends in a retry loop with quality-gate backpressure (tests/lint/typecheck must pass before advancing). Relevant only if the new skill needs to support looped/retried delegation rather than one-shot; skip if scope stays one-shot.

### 3.6 Equivalents for other CLIs

Both Gemini (`sakibsadmanshajib/gemini-plugin-cc`, uses ACP — Agent Client Protocol, a structured alternative to raw subprocess text) and Cursor (`freema/cursor-plugin-cc`, with a documented parity gap: `cursor-agent` doesn't register skills from any plugin marketplace) have community equivalents of the OpenAI codex plugin. Neither looked more mature than the OpenAI plugin from search alone. Not directly relevant to scope but confirms this is a known pattern across the ecosystem, not a one-off.

### 3.7 Anthropic's own stance

Anthropic's own cookbook orchestration patterns (`orchestrator_workers.ipynb` etc.) only cover the Python/TS SDK + API keys — explicitly out of scope here. **There is no official Anthropic guidance for "CLI subprocess drives another CLI subprocess under subscription auth."** The new skill genuinely fills a documentation gap rather than duplicating existing guidance.

---

## 4. Failure modes in the installed `openai-codex` plugin (`openai/codex-plugin-cc`)

This is the specific cautionary example named in the task — "works but breaks often because of how it's built." Two independent research legs (local source read + GitHub issue tracker) plus real usage history from six of Elliot's own past sessions all converge on the same handful of root causes.

### 4.1 Architecture — why it's fragile as a category, not just a list of bugs

A single `/codex:rescue` call crosses **6–7 layers** before a Codex model runs: slash command → `codex-rescue` subagent (tools: Bash only, explicitly forbidden from inspecting the repo) → `codex-companion.mjs` CLI dispatcher (hand-rolled arg parser + per-workspace job state) → `lib/codex.mjs` (builds JSON-RPC calls, hardcodes `approvalPolicy`/`sandbox`) → `lib/app-server.mjs` (chooses direct spawn vs. shared broker) → `app-server-broker.mjs` (one broker process per git workspace root, single-flight) → the real `codex app-server` subprocess. A parallel, independent control path runs alongside via Claude Code's own hooks (`SessionStart`/`SessionEnd`/`Stop`), including an opt-in "stop-review-gate" that can block a Claude Code session from ending based on a Codex-run review.

Four systemic mistakes explain the recurring breakage, not just the individual bugs below:

1. **Soft natural-language contracts standing in for hard schema/protocol contracts, exactly where it matters most.** The stop-review-gate parses a literal `"ALLOW:"`/`"BLOCK:"` string prefix (case-sensitive) between two independently-versioned LLMs; the one real JSON Schema in the repo (`schemas/review-output.schema.json`) is passed to Codex as a hint, never validated locally — actual parsing is bare `JSON.parse` in a try/catch with a 4-field hand-rolled shape check.
2. **Indirection stacked without shrinking the failure surface.** The broker exists specifically to avoid redundant `codex app-server` spawns, but on contention it silently falls back to spawning a second, fully independent one anyway (`BROKER_BUSY_RPC_CODE` → catch → `disableBroker: true`) — "shared runtime" quietly becomes N unshared processes under load.
3. **Safety knobs hardcoded at the lowest layer with no escape hatch surfaced upward.** `sandbox: request.write ? "workspace-write" : "read-only"` and `approvalPolicy: "never"` are baked into `lib/codex.mjs` — no CLI flag, skill instruction, or subagent ever overrides them, and no command in the chain ever constructs a `--cwd` override, so a worktree-scoped run has no way to escape the primary directory's sandbox root, and `approvalPolicy: "never"` means it can't even ask.
4. **Build-time version pinning with no runtime verification, applied inconsistently.** The RPC protocol types are generated from whatever Codex CLI the maintainer had installed at release time (`codex app-server generate-ts`), with no shipped record of which version, and only 1 of ~10 RPC call sites has defensive "unknown method" handling for version skew — despite other files in the same codebase explicitly branching on `process.platform`, so the awareness exists but isn't applied uniformly (see the arg-tokenizer bug below, which ignores platform entirely).

### 4.2 Cited failure modes — local source (file:line, all under `plugins/codex/` in the marketplace install)

- **Worktree bug, precise mechanism**: `scripts/codex-companion.mjs:491` and `scripts/lib/codex.mjs:68,81,67` hardcode sandbox to `workspace-write`/`read-only` and `approvalPolicy` to `"never"`; nothing in `commands/*.md`, the `codex-rescue` agent, or the `codex-cli-runtime` skill ever constructs a `--cwd` override (confirmed the underlying `codex-companion.mjs:144-148` CLI *can* accept one — the gap is one layer up, and the rescue agent is explicitly forbidden from even inspecting the repo to detect it's in a different worktree, per `skills/codex-cli-runtime/SKILL.md:41`).
- **Structured-output parsing**: `scripts/lib/codex.mjs:1188-1213` bare `JSON.parse` in try/catch; `scripts/lib/render.mjs:24-41` hand-rolled 4-field shape check; the real 8-field schema (`schemas/review-output.schema.json`) is advisory-only, passed as a hint into the RPC call, never enforced locally. The built-in `/codex:review` path (`codex-companion.mjs:387-394`) has **zero** parsing — prints raw stdout verbatim.
- **Stop-review-gate**: `scripts/stop-review-gate-hook.mjs:69-96` requires a literal case-sensitive `"ALLOW:"`/`"BLOCK:"` first line; any unparseable output, genuine block, *or timeout* (`:16`, hardcoded 15-minute `spawnSync` ceiling) all collapse to the same fail-closed `block` decision (`:167-176`), trapping the session from ending.
- **Broker single-flight → silent process multiplication**: `scripts/app-server-broker.mjs:69,170-182` (one connection, immediate `-32001 BROKER_BUSY` on a second concurrent request); `scripts/lib/codex.mjs:613-642` catches that and silently spawns a second independent `app-server` process instead of queuing.
- **Windows-hostile arg tokenizer**: `scripts/lib/args.mjs:76-128,89-92` treats bare `\` as a universal escape character regardless of `process.platform` — a Windows path like `C:\Users\foo\bar.js` inside a prompt string has its backslashes silently eaten before Codex ever sees it. Triggered whenever a whole command arrives as one string (`commands/review.md:45`).
- **Detached-process cleanup only on clean exit**: `scripts/lib/broker-lifecycle.mjs:59-70`, `scripts/codex-companion.mjs:671-682` spawn `detached:true,.unref()` processes whose cleanup depends on `SessionEnd` firing; an abrupt Claude Code crash/kill leaves the broker and background workers orphaned until the next invocation happens to notice a stale socket.

### 4.3 Cited failure modes — GitHub issues (`openai/codex-plugin-cc`, releases v1.0.0→v1.0.6)

**Issue count re-verified live this session** (`gh issue list --state open/closed`): **262 total — 199 open, 63 closed**. An earlier pass through this repo (whenever this document's first draft was written) recorded 163 total (100 open, 63 closed) — the closed count hasn't moved, but the open count nearly doubled, meaning bug reports are still arriving faster than they're being closed. All issue numbers below were individually re-spot-checked live this session (title/state fetched via `gh issue view`) and confirmed accurate — treat the citations as reliable, but note the *count* framing below reflects the growth.

- **#78, #3** (closed): the plugin's hardcoded sandbox enum literally drifted out of sync with the real Codex CLI's enum (`"read-only"`/`"workspace-write"` vs. CLI 0.118's `readOnly`/`workspaceWrite`/`dangerFullAccess`) — direct evidence of the version-skew systemic issue.
- **#304** (open, verified — full body fetched live this session, confirms the DNS-failure repro steps exactly as summarized): `git push` fails under the forced sandbox (DNS blocked), work is silently stranded in a local worktree, and the job still reports "completed" — a false-success result. Same class, both open and independently verified: **#531** ("write-mode dispatch fails to land any workspace writes... companion still records the job as `status: 'completed'` with `touchedFiles: []`" — a write-mode rescue job ran ~6 minutes, every write was denied by the Windows sandbox, zero files landed, yet the job record read `status: "completed"`) and **#524** (a turn blocked entirely by the sandbox still yields `status: 0` with the model's fabricated narrative as the "result," because completion is derived from `finalTurn.status === "completed"` alone, never cross-checked against actual filesystem/git effects).
- **#421** (closed): on Windows, the plugin never sends `workspace_roots`, so writes get `ACCESS_DENIED` even with `--write`.
- **#280, #380** (open): worktree review on Windows burns ~15 sandbox-declined shell attempts before a plain `git diff` works; `SessionEnd` looks up the broker by session cwd while the broker was spawned against worktree cwd — a hash mismatch that orphans the broker even on a clean `/quit`.
- **#512** (open): the hand-rolled tokenizer strips backslashes from Windows paths and lets prose words like `--model`/`--write` inside a natural-language prompt get hijacked as real flags.
- **#402** (open): sequential, non-concurrent `task` calls fail ~50% of the time with "app-server connection closed" — root-caused to broker reuse plus a retry-fallback that misses a clean-close case.
- **#517, #458, #428** (open): unguarded read-modify-write on `state.json` drops job records and can silently disable the safety gate; no PID-liveness check leaves killed jobs marked "running" forever.
- **#67, #85, #96, #46, #50, #53, #32, #16** (closed) → **#409, #331, #413, #423, #510**: the original Windows `spawn("codex")` ENOENT fix (`shell:true` for `.cmd` shims) caused a second bug wave, since `shell:true` on Windows routes args through Git-Bash/MSYS and mangles POSIX-looking arguments (`taskkill /PID` becomes `C:/Program Files/Git/PID`).
- **#371** "[Epic] Codex plugin durability & safety hardening" (closed): maintainers had already scoped a hardening pass around the state-race and fail-closed-gate themes — confirms these are known-systemic to the maintainers themselves, not one-off reports.
- **#75** (open, verified) "Codex plugin bypasses project-level Claude Code permission settings (deny rules in `.claude/settings.json`)": a `.claude/settings.json` deny rule (e.g. `Read(pom.xml)`) is correctly enforced when Claude Code's own tools try to read that file, but has zero effect when the same file is read via `/codex:rescue` — because the companion script spawns Codex as an independent subprocess with no visibility into Claude Code's permission state. Affects both the read path (Codex reads files Claude Code is denied from reading) and the write path (`workspace-write` writes bypass any Claude Code ask/deny mode). This is a fifth systemic issue beyond the four in §4.1: **the plugin operates entirely outside Claude Code's own permission model** — two independent agents sharing a filesystem with no shared authorization layer. Directly relevant to the new skill: whatever it builds should not silently grant Codex a wider filesystem view than the calling Claude Code session itself has.

### 4.4 Cited failure modes — actual usage in Elliot's own past sessions (via `estack-read-claude-session-history`)

Six distinct patterns beyond the known worktree bug, plus the likely origin session for the global `danger-full-access` config change:

1. **`codex-rescue` is a strict one-shot forwarder, does not poll.** Session `765f212f…` (2026-07-13): re-invoking it to check an already-running job just fires a *new* dispatch. Worked around by shelling directly into `codex-companion.mjs status <job-id> --json`.
2. **10-minute foreground-Bash ceiling kills long dispatches; the async path can also return a stub instead of real output.** Session `6063ba11…` (2026-07-13): confirmed against upstream issues `#370` and `#324` (Elliot had already filed comments on both with a Windows repro). Worked around by writing the prompt to a scratch file and backgrounding `codex exec` directly via PowerShell.
3. **Delegation overhead + no completion signal**, in Claude's own retrospective words from session `ae1392f7…` (2026-07-12, 7 parallel worktree dispatches): *"To hand Codex a task I had to load a skill, which told me to spawn a forwarder subagent, whose only job was to make one Bash call to a companion script... Each forwarder burned ~15k tokens and 1–2 minutes to move text from A to B. Worse, job completion never notifies me... I wrote a shell script polling seven status files every 60 seconds."* Also in this session: a subagent "died in 3 seconds with zero tool uses and returned garbage" with no health signal, and one worktree job left a source file deleted mid-task requiring manual restore.
4. **Resource exhaustion mid-delegation with no partial-commit safety net.** Session `2e7329b5…` (2026-06-20): Codex ran out of usage quota mid-task, made zero git commits, left 497 changed files intermingled across what should have been 5 scoped commits. Recovered by hand-reconstructing commit boundaries.
5. **Worktree write-isolation leak via the direct MCP integration path** (not codex-rescue — `mcp__codex__codex`/`mcp__codex__codex-reply` tools directly). Session `5c1998be…` (2026-06-18): untracked files appeared in the primary directory despite Codex's working dir being scoped to a sibling worktree. Never fully root-caused in-session.
6. **Codex's sandbox has no outbound network by default → false-negative build/gate results that hide real bugs.** Same session: *"Codex's build failure was just its sandbox blocking Google Fonts... its `next build` died at the font fetch before type-checking ran, so it never saw [the real error]."* Codex's self-reported "tests pass" is not a trustworthy signal when its sandbox network posture differs from the real dev environment.
7. **`codex-rescue` can no-op silently outside the primary repo root and still report success — a false positive distinct from the "Access denied" worktree case.** Session `aaa72e0b…` (2026-07-06): a task asked Codex to edit files under `~/.claude` (outside the session's cwd). The forwarder reported success; a background file-watcher then timed out because nothing had actually changed — diagnosis: *"Codex modified nothing... The codex-rescue forwarder's app-server task ran in a sandbox scoped to the project repo and never touched `~/.claude`, and it returns no result to me."* Unlike the worktree "Access... is denied" case, this failure mode produces **no error at all** — the forwarder simply reports success for a task it never actually performed. Same session also surfaced a Windows-specific sandbox-helper crash (`STATUS_DLL_INIT_FAILED`, `0xC0000142` — see §2.7) that was initially misdiagnosed before a follow-up investigation (session `6610b65e…`) corrected it.

**Origin session for the global config change**: `0ef2a6bd…` (2026-06-18) — root-caused the "can only write to the main worktree" boundary to Codex's own `sandbox_mode` being rooted at the primary dir regardless of `--cwd`, fixed live by editing `~/.codex/config.toml` to `danger-full-access`/`approval_policy="never"`. Same session independently found a critical PUT token-bypass vulnerability in Codex-generated code — caught only because Claude commissioned a *separate* adversarial reviewer, since Codex's own output could not self-certify security-critical code it had written.

---

## 5. Recommended approach for the new e-stack skill

### 5.1 Design principles, derived directly from §4

The codex plugin's failures cluster into four categories; the new skill should structurally avoid each:

1. **No soft-parsing where a hard contract is available.** Both CLIs support structured output natively — Claude Code's `--output-format json`/`--json-schema`, Codex's `--json`/`--output-schema`. The new skill should mandate these, never text-scrape `stdout`, and treat "the docs don't fully specify the error schema" as a reason to verify empirically once (§1.4, §2.5), not a reason to regex-match text.
2. **Minimum viable indirection.** No broker/daemon layer, no persistent background process the calling agent has to remember to clean up. One-shot: construct the command, run it (correctly backgrounded/timed-out — see below), read the structured result. If polling/async is needed later, it should be an explicit, visible loop the calling agent runs itself (as Elliot's own sessions did when working around the plugin's silent one-shot-forwarder limitation) — not a hidden state file the skill manages on the user's behalf.
3. **No hardcoded safety knobs without an escape hatch.** Sandbox mode, approval policy, and working directory must always be things the skill's instructions let the calling agent set per-invocation (especially `--cd`/`-C` and `--sandbox` for Codex, `--add-dir` and cwd for Claude) — the single most repeated root cause across both the local source and the GitHub issues was a knob hardcoded one layer below where it needed to be adjustable.
4. **State version skew as a first-class risk, not an afterthought.** Both CLIs update independently of the skill. The skill's reference material should tell the calling agent to run `claude --version` / `codex --version` and sanity-check flag availability before a batch of automated calls, rather than assuming a flag from this document still exists — exactly the discipline this findings doc itself had to apply when the docs turned out to have moved (§2, redirect chain) or a flag turned out not to exist (`--tools`, §1.2).
5. **"The call completed" and "the task actually happened" are different claims — verify the second one, don't infer it from the first.** This is the single most repeated failure pattern in §4: `git push` silently stranded while the job reports "completed" (#304, #531), a sandbox-blocked no-op turn still yielding a fabricated "success" result (#524), and `codex-rescue` reporting success for a task that touched zero files because it silently ran scoped to the wrong directory (§4.4 pattern 7) are all the same root mistake — trusting protocol-level completion (the RPC call returned, the turn finished) as a proxy for task-level success. Whenever the new skill's invocation pattern claims something changed, it should verify that claim against something external and cheap to check (git status/diff, a file's mtime, a test run) rather than trusting the CLI's own "done" signal at face value.

Additional principles from prior art (§3): treat a driven CLI's output as "a peer suggestion, not authority" needing independent validation (skill-codex's posture, and validated by Elliot's own session 6 in §4.4 — Codex's sandboxed "tests pass" was a false signal); always explicitly redirect stdin (`< /dev/null` / `< NUL`) for any non-interactive Codex invocation, no exceptions, given the confirmed Windows/PowerShell stdin-hang bug reproduces in exactly this setup.

### 5.2 Naming

Following the `estack-<short>` convention (`estack-repo-search`, `estack-read-agent-history`), and given the skill covers driving *both* Claude Code itself and Codex CLI programmatically, not just one:

- **Recommended: `estack-drive-cli-agent`** — reads as an imperative action ("drive a CLI agent"), matches the verb-first pattern of most existing skill names, and doesn't lock the name to "codex" specifically if a third CLI (Gemini, Cursor) gets added later.
- Alternate: `estack-cli-agent-bridge` — more noun-y, less consistent with the pack's action-oriented naming.
- Alternate: `estack-headless-agent-cli` — technically accurate but reads awkwardly and buries "what does this do" behind jargon.

Open decision for Elliot: whether this is **one skill** covering both `claude -p` self-driving and `codex exec` driving (recommended — the two share almost all the hard-won footgun material: subscription-auth preservation, structured-output-over-scraping, stdin handling, worktree scoping, no-fine-grained-exit-codes, external timeout enforcement), or split into two skills if the actual invocation patterns diverge enough in practice once written out.

### 5.3 SKILL.md structure

This skill is a "tool" shape, not the coaching shape `templates/coaching-skill/` is built for (per `docs/skill-authoring.md`, which explicitly says a different-shaped skill should get its own template rather than being forced into the coaching scaffold). The closest existing structural models are `estack-repo-search` (single-file SKILL.md, an auto-run health-check block, clear guardrail language, delegates work via the Agent tool) and `estack-read-agent-history` (CLI + reference library backing a set of documented pitfalls). Recommended shape, blending both:

- **`SKILL.md`** — frontmatter (`name: estack-drive-cli-agent`, `version: 1.0.0`, description starting `(drive-cli-agent) Use when...`), a short guardrail section up top (never trust exit codes alone, always structured output, always redirect stdin for Codex), then two clearly separated reference sections: "Driving Claude Code (`claude -p`)" and "Driving Codex CLI (`codex exec`)" — each with a copy-pasteable invocation template (flags pre-selected per §1–2's recommendations: `--output-format json` + explicit `--allowedTools`/`--permission-mode` for Claude; `--json` or `-o`+`--output-schema` + `--sandbox`/`-a never`+`< /dev/null` for Codex) and a short "known footguns" list distilled from §1.6/§2.4/§2.6–2.7.
- **`references/`** — one file per CLI (`references/claude-headless.md`, `references/codex-exec.md`) holding the fuller detail from §1–2 of this document (flag tables, auth notes, exit-code caveats), so `SKILL.md` itself stays a fast-loading decision guide and the deep material is there when the calling agent needs to debug something unusual. This mirrors the coaching template's "lightweight top-level + heavier references/ tier" pattern without adopting the coaching-specific framework content.
- **No scripts/companion process** — deliberately, per 5.1's "minimum viable indirection" principle. The skill teaches direct CLI invocation patterns; it does not ship a Node.js dispatcher, broker, or state file. If a genuine need for polling/async coordination emerges later, that should be a documented pattern (a loop the calling agent runs), not new stateful infrastructure to maintain.
- **`## Skill Feedback`** section generated via the shared template (`node scripts/update-skill-feedback.cjs`), like every other skill.

### 5.4 What NOT to build — explicit anti-checklist from §4

- No persistent broker/daemon process per workspace.
- No hand-rolled arg tokenizer — pass argv arrays or well-tested shell-escaping, never a single hand-split string, and handle Windows path backslashes explicitly rather than assuming POSIX escaping rules.
- No fail-closed text-prefix protocols between the two LLMs (no `"ALLOW:"/"BLOCK:"` style contracts) — use `--output-schema`/`--json-schema` and validate locally, don't just pass a schema as an RPC hint and trust it was honored.
- No hardcoded sandbox/approval values one layer below where the calling agent could adjust them.
- No silent fallback-to-redundant-process-spawn under contention — if concurrency limits are hit, surface that to the calling agent rather than quietly multiplying resource usage.
- No build-time-pinned protocol assumptions without a runtime version check — verify `--help` output or `--version` for flag availability rather than assuming this document's flag list stays accurate forever.
- No treating "the RPC/process call completed" as proof the task succeeded — cross-check claimed changes against something external (git status/diff, file existence, a verification command) before reporting success upstream.

### 5.5 `manage-e-stack` publish/install flow

Per `AGENTS.md`, any change to a skill routes through the `manage-e-stack` skill (project-local, `.agents/skills/manage-e-stack/`) — this findings doc does not build the skill, so `manage-e-stack` has not been invoked yet. When the build starts: `manage-e-stack`'s `steps/add.md` will point to `templates/` for scaffolding (§5.3 notes this needs either the coaching template adapted down, or a new lightweight "tool" template folder created first — recommend creating `templates/tool-skill/` as a reusable scaffold for this and future non-coaching skills, since `docs/skill-authoring.md` explicitly invites this ("add a new template folder under `templates/` rather than forcing it into the coaching scaffold")). Standard per-skill versioning (starts at `1.0.0`), doc-listing requirements (README.md skills table + AGENTS.md pack list), and the name-validation script (`check-skill-name.cjs`) all apply unchanged. Publishing itself remains tag-triggered and out of scope until Elliot explicitly asks for a release.

### 5.6 Open questions for Elliot before build starts

1. One skill covering both CLIs, or two separate skills? (Recommendation: one — see §5.2.)
2. Is a new `templates/tool-skill/` scaffold worth creating now (reusable for future non-coaching skills), or is copy-pasting `estack-repo-search`'s structure by hand fine for this one skill?
3. Scope check: does "drive Codex programmatically" include the plugin's review/rescue *use cases* (adversarial code review, delegated implementation), or strictly the mechanics of invocation regardless of use case? This affects whether the skill ships example prompts/workflows or stays mechanics-only.
4. Should the skill actively warn against / deprecate use of the installed `openai-codex` plugin for anything beyond its officially-supported happy path, given §4's findings, or stay neutral and just be the more-robust alternative?

---

**This document is the complete deliverable per the task's definition of done. No skill files have been created or modified. Awaiting review before any build work begins.**
