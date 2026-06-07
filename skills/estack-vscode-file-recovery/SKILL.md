---
name: estack-vscode-file-recovery
version: 1.2.0
description: >
  (vscode-file-recovery) Recover files that were permanently deleted (via rm, bash delete, or any method that bypasses the Recycle Bin) using VS Code's or Cursor's Local History snapshots, or from Claude session transcripts.
  Use this skill immediately whenever: a file was deleted and git can't recover it (untracked or not committed), the user says "get it back", "restore that file", "I lost that file", "can you undo that delete", or any variation of wanting a deleted file recovered. Also use proactively after any rm or bash delete of files that weren't committed to git.
  VS Code and Cursor silently save a snapshot every time you open or edit a file in the editor — this is often the only recovery path when git and Recycle Bin both fail.
---

# VS Code / Cursor File Recovery

When a file is deleted outside of git (with `rm`, bash, or any method that bypasses the Recycle Bin), this skill recovers it from editor Local History or Claude session transcripts.

## Recovery Sources — Try in Order

1. **Editor Local History** (VS Code or Cursor) — covered below
2. **Claude session transcript** — if Claude read the file in a prior session, its content may be in the JSONL. Use `/read-transcript` to search session history.
3. **Git** — only if the file was ever committed
4. **Cloud sync** (OneDrive, Dropbox) — check the cloud recycle bin / version history

---

## How Editor Local History Works

VS Code and Cursor automatically save timestamped snapshots of every file opened in the editor. These live at:

```
VS Code  (Windows): C:\Users\[username]\AppData\Roaming\Code\User\History\
Cursor   (Windows): C:\Users\[username]\AppData\Roaming\Cursor\User\History\
VS Code  (Mac):     ~/Library/Application Support/Code/User/History/
Cursor   (Mac):     ~/Library/Application Support/Cursor/User/History/
VS Code  (Linux):   ~/.config/Code/User/History/
Cursor   (Linux):   ~/.config/Cursor/User/History/
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

### Step 2: Search editor history for the file

Search `entries.json` files in both VS Code and Cursor History directories.

**Windows (PowerShell) — searches both editors:**
```powershell
@("Code", "Cursor") | ForEach-Object {
  $histPath = "$env:APPDATA\$_\User\History"
  if (Test-Path $histPath) {
    Get-ChildItem $histPath -Recurse |
      Where-Object { $_.Name -eq "entries.json" } |
      ForEach-Object {
        $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        if ($content -like "*FILENAME_OR_PATH_PATTERN*") {
          $_.FullName
          $content
        }
      }
  }
}
```

Replace `FILENAME_OR_PATH_PATTERN` with the filename or path fragment. **Use `-like "*filename*"` rather than `-match "filename"` to avoid regex metacharacter issues** (`.`, `(`, `)`, `+` in filenames break `-match`).

If matching a full path, note that editors URL-encode it in `entries.json`: drive colons become `%3A`, backslashes become `/`, and spaces become `%20`. Example: `C:\Users\2supe\My App (v2).md` → `file:///c%3A/Users/2supe/My%20App%20%28v2%29.md`. **Searching by filename alone is simpler and usually sufficient.**

**Mac (bash) — searches both editors:**
```bash
for app in "Code" "Cursor"; do
  grep -rl "FILENAME_OR_PATH_PATTERN" "$HOME/Library/Application Support/$app/User/History/" 2>/dev/null
done
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

## When Editor History Won't Help

- **File was never opened as an editor tab** — files only visible in the sidebar Explorer are not snapshotted.
- **History was cleared** — default retention is 30 days / 50 entries per file.

If editor history doesn't have the file, fall back to:
1. **`/read-transcript`** — if Claude read the file in a prior session, the content is in the session JSONL. Use `--mode search --query "filename"` to find it. Note: you need to point it at the right project's sessions — if the file lived in a different project folder, search that project's transcript directory instead.
2. **Windows Shadow Copies** (last resort, requires admin) — Windows VSS may have a snapshot of the volume. Check if any exist first:
   ```powershell
   vssadmin list shadows
   ```
   If a shadow copy exists, mount it and browse (**requires an elevated/admin shell**; the trailing backslash on the device path is required or `mklink` fails silently):
   ```powershell
   cmd /c mklink /d C:\shadow \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy3\
   ```
   Replace the device path with the one from `vssadmin list shadows`. Browse `C:\shadow\` like a normal drive to find and copy the file back. Clean up after: `cmd /c rmdir C:\shadow`.
3. **File recovery software** (Recuva on Windows) — only works if the disk blocks haven't been overwritten yet.

---

## Example

**Scenario:** `rm` deleted `Untitled-1.md` which was untracked by git.

```powershell
# Search
Get-ChildItem "$env:APPDATA\Code\User\History" -Recurse |
  Where-Object { $_.Name -eq "entries.json" } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -like "*Untitled-1*") { $_.FullName; $content }
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
