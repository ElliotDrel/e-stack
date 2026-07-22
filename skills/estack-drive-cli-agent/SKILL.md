---
name: estack-drive-cli-agent
version: 1.0.0
description: >-
  (drive-cli-agent) Drive another AI coding agent CLI programmatically from the
  command line — Codex CLI (`codex exec`) and Claude Code headless (`claude
  -p`) — under existing logged-in subscriptions, not API keys. Use whenever the
  task involves delegating work to Codex, getting a second opinion or
  adversarial review from another model, running Claude Code non-interactively
  from a script, orchestrating one agent from another, or scripting/automating
  either CLI. Trigger phrases: "ask codex", "have codex do", "delegate to
  codex", "codex exec", "second opinion from", "run claude headless", "claude
  -p", "script claude code", "drive another agent", "spawn codex on this".
  Prefer this skill over the openai-codex plugin's rescue/forwarder path for
  anything that needs a custom working directory, sandbox mode, long runtime,
  or reliable result retrieval.
---

# Drive a CLI Agent

Run Codex CLI or Claude Code as a non-interactive subprocess and get a trustworthy result back. Both bill against the already-logged-in subscription — never set `OPENAI_API_KEY`, `CODEX_API_KEY`, or `ANTHROPIC_API_KEY` in the call's environment; each silently switches billing to API-key mode.

Before anything non-trivial, read the matching reference: `references/codex-exec.md` or `references/claude-headless.md`. Every claim there carries a source URL — when a flag misbehaves or a claim looks stale, fetch the cited URL for current truth instead of guessing.

## Hard rules

1. **Close stdin on every Codex call** — append `< /dev/null`, and run Codex through the Bash tool (Git Bash), not PowerShell (PowerShell has no `<` operator). Without it, `codex exec` hangs forever when spawned with an unwritten stdio pipe — reproduced in exactly this agent-on-Windows setup. ([openai/codex#20919](https://github.com/openai/codex/issues/20919))
2. **Own the clock.** Neither CLI enforces any timeout — not per-run, and for Codex not even on its own internal tool calls. Short calls: foreground with the Bash tool's `timeout` parameter. Anything that could pass 10 minutes: `run_in_background` (the harness notifies on completion — no PID files or polling loops).
3. **Read results from output, never from exit codes.** Both CLIs are effectively 0/1, and Codex has exited 0 on SIGINT. Codex's plain stdout is *only* the final message by design, so capturing it is fine for prose answers; when you need machine-parseable fields, use `--json`/`--output-schema` (Codex) or `--output-format json`/`--json-schema` (Claude) — never regex an answer out of interleaved text.
4. **Verify claimed effects against ground truth.** "Completed" ≠ "succeeded": check `git status`/`diff`, file existence, or a test run before reporting success. Treat the answer itself as a peer suggestion — a sandboxed "tests pass" can be a false signal (e.g. the build died at a blocked network fetch before the real check ran).
5. **Set sandbox, approval, and working directory explicitly per call.** Don't inherit the user's global config posture — it drifts, and interactive defaults are wrong for headless runs.

## Driving Codex (`codex exec`)

Quick question (default — foreground, Bash-tool timeout ~3–5 min):

```bash
codex exec --skip-git-repo-check -a never "<prompt>" < /dev/null
```

stdout is the final answer, progress goes to stderr. Sandbox defaults to read-only.

Long or write-capable task — same shape plus workspace access, run with `run_in_background`, result mirrored to a unique file:

```bash
codex exec --skip-git-repo-check -C "<workdir>" --sandbox workspace-write -a never \
  -o "<scratchpad>/codex-result-<taskname>.md" "<prompt>" < /dev/null
```

- `workspace-write` blocks network (git push, npm install fail with DNS errors) unless you add `-c sandbox_workspace_write.network_access=true`.
- Need structured fields: add `--json` (final answer = the `item.completed` event with `item.type == "agent_message"`; success = `turn.completed`) or `--output-schema <schema-file>`.
- Follow-ups: `codex exec resume --last "<follow-up>"` — only when no other Codex run happened since; otherwise capture `thread_id` from `--json`'s `thread.started` event and use `codex exec resume <id>`.

## Driving Claude Code (`claude -p`)

Read-only question/review (default — foreground, Bash-tool timeout):

```bash
claude -p "<prompt>" --output-format json \
  --allowedTools "Read,Grep,Glob" --permission-mode dontAsk \
  > "<scratchpad>/claude-result.json" 2> "<scratchpad>/claude-err.log"
```

- Answer = `.result`; follow-ups: capture `.session_id`, then `claude -p --resume "<id>" "<follow-up>"` **from the same directory** (resume is scoped to the project dir and its worktrees). On empty or non-JSON output, read the stderr log — failures exit 1 with distinguishing text there.
- Write-capable: `--permission-mode acceptEdits` plus explicit `--allowedTools` for every shell command it will need (e.g. `"Bash(npm test *),Edit,Write"`) — any unapproved command aborts the run.
- Schema-enforced output: add `--json-schema '<schema>'` → validated result in `.structured_output`.
- Add `--no-session-persistence` only for throwaway runs — it breaks both `--resume` and after-the-fact transcript retrieval.
- **Never use `--bare`** (docs recommend it for scripts, but it skips OAuth — subscription auth stops working). There is no `--tools` flag.

## Retrieval when a run outlives the conversation

Unless `--ephemeral`/`--no-session-persistence` was passed, full transcripts persist on disk (Codex: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`; Claude: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`). Read them via the `estack-read-agent-history` skill — never raw-Read the `.jsonl`.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-drive-cli-agent: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-drive-cli-agent: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
