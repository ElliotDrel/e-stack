---
name: estack-vscode-file-recovery
version: 1.0.0
description: >
  (vscode-file-recovery) Recover files that were permanently deleted (via rm, bash delete, or any method that bypasses the Recycle Bin) using VS Code's Local History snapshots.
  Use this skill immediately whenever: a file was deleted and git can't recover it (untracked or not committed), the user says "get it back", "restore that file", "I lost that file", "can you undo that delete", or any variation of wanting a deleted file recovered. Also use proactively after any rm or bash delete of files that weren't committed to git.
  VS Code silently saves a snapshot every time you open or edit a file in the editor — this is often the only recovery path when git and Recycle Bin both fail.
---

# VS Code File Recovery

When a file is deleted outside of git (with `rm`, bash, or any method that bypasses the Recycle Bin), and it was previously opened in VS Code, this skill recovers it from VS Code's Local History.

## How VS Code Local History Works

VS Code automatically saves timestamped snapshots of every file opened in the editor. These live at:

```
Windows: C:\Users\[username]\AppData\Roaming\Code\User\History\
Mac:     ~/Library/Application Support/Code/User/History/
Linux:   ~/.config/Code/User/History/
```

Each file gets a hash-named folder containing:
- `entries.json` — maps the original file path to snapshot IDs and timestamps
- `[id].[ext]` — the actual snapshot content (e.g., `dtgz.md`, `F9gm.txt`)

**Critical limitation:** VS Code only snapshots files that were actually *opened as a tab in the editor*. Files visible only in the sidebar Explorer are not captured.

---

## Recovery Steps

### Step 1: Identify what to search for

Collect from the user (or from the deletion event):
- The filename (e.g., `Untitled-1.md`)
- The full path if known (e.g., `C:\Users\2supe\All Coding\akiflow-mcp\Untitled-1.md`)
- Any partial path segments (folder name, project name)

### Step 2: Search VS Code history for the file

Search all `entries.json` files in the History directory for filename/path matches.

**Windows (PowerShell):**
```powershell
Get-ChildItem "$env:APPDATA\Code\User\History" -Recurse |
  Where-Object { $_.Name -eq "entries.json" } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "FILENAME_OR_PATH_PATTERN") {
      $_.FullName
      $content
    }
  }
```

Replace `FILENAME_OR_PATH_PATTERN` with the filename or path fragment. URL-encode spaces as `%20` in the pattern if you're matching a path (VS Code stores paths URL-encoded in entries.json).

**Mac/Linux (bash):**
```bash
grep -rl "FILENAME_OR_PATH_PATTERN" ~/.config/Code/User/History/ 2>/dev/null
```

### Step 3: Read the entries.json to find the latest snapshot

The `entries.json` looks like:
```json
{
  "version": 1,
  "resource": "file:///c%3A/Users/2supe/path/to/Untitled-1.md",
  "entries": [
    {"id": "F9gm.md", "source": "Workspace Edit", "timestamp": 1776196985353},
    {"id": "U4ha.md", "source": "Workspace Edit", "timestamp": 1776197058059},
    {"id": "dtgz.md", "source": "Workspace Edit", "timestamp": 1776197128275}
  ]
}
```

The **last entry** in the array is the most recent snapshot. Take its `id` field.

### Step 4: Read the snapshot content

```powershell
Get-Content "C:\Users\[username]\AppData\Roaming\Code\User\History\[hash-folder]\[id]"
```

Or use the Read tool with the full path.

### Step 5: Restore the file

Write the content back to the original location using the Write tool.

---

## When VS Code History Won't Help

- **File was never opened as a VS Code editor tab** — only visible in the sidebar Explorer won't produce a snapshot.
- **VS Code wasn't installed or wasn't used** — obvious, but worth confirming.
- **History was cleared** — VS Code's local history can be manually cleared or has a configurable retention limit (default: 30 days, 50 entries per file).

If VS Code history doesn't have the file, tell the user and suggest:
1. Check cloud sync version history (OneDrive, Dropbox, iCloud)
2. File recovery software (Recuva on Windows, PhotoRec on Mac/Linux) — only works if disk hasn't been overwritten

---

## Example

**Scenario:** `rm` deleted `Untitled-1.md` which was untracked by git.

```powershell
# Search
Get-ChildItem "$env:APPDATA\Code\User\History" -Recurse |
  Where-Object { $_.Name -eq "entries.json" } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match "Untitled-1") { $_.FullName; $content }
  }

# Result shows: C:\...\History\-6e228c75\entries.json
# entries.json has latest id: "dtgz.md"

# Read snapshot
Get-Content "C:\Users\2supe\AppData\Roaming\Code\User\History\-6e228c75\dtgz.md"

# Restore
# (Use Write tool to recreate the file at original path)
```

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-vscode-file-recovery: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-vscode-file-recovery: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
