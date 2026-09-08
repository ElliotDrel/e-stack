---
name: estack-notify
version: 1.0.1
description: (notify) Turn on desktop notifications at the end of every turn for the current session. Use when the user invokes /estack-notify or /estack-notify off, or asks to be pinged whenever a turn finishes.
argument-hint: "[off]"
disable-model-invocation: true
---

# estack-notify

Turn the requested state on or off directly. Do not claim it already ran unless the host supplied a successful command result.

```powershell
powershell.exe -NoProfile -File "$env:USERPROFILE\.agents\skills\estack-notify\scripts\estack-notify.ps1" <on|off>  # estack-path-ok: executes the installed skill script; it does not write in the skill folder
```

Use `off` only when the invocation explicitly includes that argument; otherwise use `on`. Relay the script's verified status concisely. If the host cannot run PowerShell, state that notifications were not changed and give the command above for the user to run.

## Requirements

Windows only. The toast is rendered through the Windows notification API from PowerShell 5.1.

Armed sessions are tracked as flag files in `~/.e-stack/estack-notify/`, keyed by session id, so arming one session never affects another. Flags older than 30 days are pruned automatically. The statusline shows a bell for any session that is currently armed.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-notify:` and a body. File an
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
