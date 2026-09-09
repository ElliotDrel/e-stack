---
name: estack-drive-cli-agent
version: 1.0.2
description: >-
  (drive-cli-agent) Run Codex CLI (codex exec) or Claude Code headless (claude
  -p) from a script under logged-in subscriptions. Use when delegating work to
  Codex, getting a second-model review, or scripting either CLI.
---

# Drive a CLI Agent

Run Codex CLI or Claude Code as a non-interactive subprocess and get a trustworthy result back. Both bill against the already-logged-in subscription — never set `OPENAI_API_KEY`, `CODEX_API_KEY`, or `ANTHROPIC_API_KEY` in the call's environment; each silently switches billing to API-key mode.

Before a non-trivial run, read the matching reference: `references/codex-exec.md` or `references/claude-headless.md`. If the installed CLI is available, check its `exec --help` or `-p --help` output before relying on a flag; the references preserve dated investigation notes as context, not as a substitute for the current interface.

## Hard rules

1. **Close stdin when the prompt is positional.** Append `< /dev/null` and run that command through Bash (Git Bash), not PowerShell (which has no `<` operator). This avoids the Windows `codex exec` stdin hang. When the prompt itself comes from a file or pipe, pass `-` as the prompt, feed the UTF-8 input, then close that input stream instead. ([openai/codex#20919](https://github.com/openai/codex/issues/20919))
2. **Own the clock at the runner.** Set the foreground timeout or use the host's equivalent asynchronous task facility for work that may take longer. Do not assume a specific harness feature or infer completion from a child process alone.
3. **Read results from output, never from exit codes.** Both CLIs are effectively 0/1, and Codex has exited 0 on SIGINT. Codex's plain stdout is *only* the final message by design, so capturing it is fine for prose answers; when you need machine-parseable fields, use `--json`/`--output-schema` (Codex) or `--output-format json`/`--json-schema` (Claude) — never regex an answer out of interleaved text.
4. **Verify claimed effects against ground truth.** "Completed" ≠ "succeeded": check `git status`/`diff`, file existence, or a test run before reporting success. Treat the answer itself as a peer suggestion — a sandboxed "tests pass" can be a false signal (e.g. the build died at a blocked network fetch before the real check ran).
5. **Set sandbox and working directory explicitly per call.** Do not inherit a global sandbox posture. In the local `codex exec --help` checked on 2026-09-07, there is no `-a`/`--ask-for-approval` exec flag: for a write task that needs automatic approval review, use `--approve-for-me` with `workspace-write`; check local help again before copying this interface.

## Driving Codex (`codex exec`)

Quick question (default — foreground, Bash-tool timeout ~3–5 min):

```bash
codex exec --skip-git-repo-check --sandbox read-only "<prompt>" < /dev/null
```

stdout is the final answer, progress goes to stderr. Sandbox defaults to read-only.

Long or write-capable task — same shape plus workspace access, run through the host's asynchronous task facility when needed, with its result mirrored to a unique file:

```bash
codex exec --skip-git-repo-check -C "<workdir>" --sandbox workspace-write --approve-for-me \
  -o "<scratchpad>/codex-result-<taskname>.md" "<prompt>" < /dev/null
```

- `workspace-write` blocks network (git push, npm install fail with DNS errors) unless you add `-c sandbox_workspace_write.network_access=true`.
- Need structured fields: add `--json` (final answer = the `item.completed` event with `item.type == "agent_message"`; success = `turn.completed`) or `--output-schema <schema-file>`.
- Follow-ups: `codex exec resume --last "<follow-up>"` — only when no other Codex run happened since; otherwise capture `thread_id` from `--json`'s `thread.started` event and use `codex exec resume <id>`.

## Driving Claude Code (`claude -p`)

Read-only question/review (default — foreground, Bash-tool timeout):

```bash
claude -p "<prompt>" --output-format json --tools "Read,Grep,Glob" \
  --allowedTools "Read,Grep,Glob" --permission-mode dontAsk \
  > "<scratchpad>/claude-result.json" 2> "<scratchpad>/claude-err.log"
```

- Answer = `.result`; follow-ups: capture `.session_id`, then `claude -p --resume "<id>" "<follow-up>"` **from the same directory** (resume is scoped to the project dir and its worktrees). On empty or non-JSON output, read the stderr log — failures exit 1 with distinguishing text there.
- Write-capable: `--permission-mode acceptEdits` plus explicit `--allowedTools` for every shell command it will need (e.g. `"Bash(npm test *),Edit,Write"`) — any unapproved command aborts the run.
- Schema-enforced output: add `--json-schema '<schema>'` → validated result in `.structured_output`.
- Add `--no-session-persistence` only for throwaway runs — it breaks both `--resume` and after-the-fact transcript retrieval.
- **Never use `--bare`** (docs recommend it for scripts, but it skips OAuth — subscription auth stops working). Claude's `--tools` selects which built-in tools are available; `--allowedTools` separately controls automatic approval. Keep those roles distinct.

## Retrieval when a run outlives the conversation

Unless `--ephemeral`/`--no-session-persistence` was passed, full transcripts persist on disk (Codex: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`; Claude: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`). Read them via the `estack-read-agent-history` skill — never raw-Read the `.jsonl`.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-drive-cli-agent:` and a body. File an
issue only when the user explicitly asks you to do so. If they have not asked,
offer the draft and issue page for their review; do not post or open anything
automatically.

When the user explicitly authorizes filing and `gh` is installed (`gh --version` succeeds), create the issue with structured arguments. Put the reviewed body in a UTF-8 temporary file and pass its literal path with `--body-file`; do not interpolate feedback into shell code.

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "<reviewed title>" \
  --body-file "<path-to-reviewed-UTF-8-body-file>"
```

If `gh` is unavailable, give the user the reviewed title and body to paste into a
new issue at `https://github.com/ElliotDrel/e-stack/issues/new`.
