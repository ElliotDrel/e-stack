---
name: estack-notify
version: 1.0.0
description: (notify) Turn on desktop notifications at the end of every turn for the current session. Use when the user invokes /estack-notify or /estack-notify off, or asks to be pinged whenever a turn finishes.
argument-hint: "[off]"
disable-model-invocation: true
---

# estack-notify

Notify mode is now ON for this session. The block below already ran and armed it:

```!
powershell.exe -NoProfile -File "$USERPROFILE/.agents/skills/estack-notify/scripts/estack-notify.ps1" on 2>&1
```

## What to do

**If this was invoked with the argument `off`**, run this one command and relay its output verbatim:

```text
powershell.exe -NoProfile -File "$USERPROFILE/.agents/skills/estack-notify/scripts/estack-notify.ps1" off
```

**Otherwise** relay the block output above verbatim and stop. Run nothing.

Either way: no commentary, no explanation of what estack-notify does.

## Why it is built this way

`$ARGUMENTS` is not interpolated into a skill body, so the `!` block cannot see the argument. It always arms, which is the common case and costs no tool call. Turning it off is the only path that needs a command from you, and arming first is harmless since the flag is just deleted again before the turn ends.

## Requirements

Windows only. The toast is rendered through the Windows notification API from PowerShell 5.1.

Armed sessions are tracked as flag files in `~/.e-stack/estack-notify/`, keyed by session id, so arming one session never affects another. Flags older than 30 days are pruned automatically. The statusline shows a bell for any session that is currently armed.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-notify: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-notify: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
