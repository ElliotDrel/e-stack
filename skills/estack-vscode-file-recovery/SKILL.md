---
name: estack-vscode-file-recovery
version: 1.2.3
description: >-
  (vscode-file-recovery) Recover a permanently deleted file from VS Code or
  Cursor Local History snapshots or from Claude session transcripts. Use when
  a file was deleted outside the Recycle Bin and git can't restore it.
---

# VS Code / Cursor File Recovery

When a file is deleted outside of git (with `rm`, bash, or any method that bypasses the Recycle Bin), this skill recovers it from editor Local History or Claude session transcripts.

## Recovery Sources — Try in Order

1. **Editor Local History** (VS Code or Cursor) — covered below
2. **Claude or Codex session transcript** — if an agent read the file in a prior session, its content may be in the transcript. Use `estack-read-agent-history` to search it.
3. **Git** — only if the file was ever committed
4. **Cloud sync** (OneDrive, Dropbox) — check the cloud recycle bin / version history

---

## How Editor Local History Works

VS Code Local History stores full-content entries when an eligible local file is saved, subject to its configured excludes, size limit, entry limit, and merge window. On a remote workspace its user data may live on the remote host; VS Code for the Web uses browser storage. Cursor's Local History layout is similar, but inspect its `entries.json` rather than assuming every VS Code setting applies. These desktop locations are the first places to check:

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

**Critical limitations:** A file may have no recoverable entry if it was excluded, exceeded the configured size limit, was never saved while Local History was enabled, or its retained entries were pruned. See [VS Code's Local History documentation](https://code.visualstudio.com/updates/v1_66#_local-history) for the `workbench.localHistory.*` controls.

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
        $content = Get-Content $_.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
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

Choose the entry with the greatest `timestamp` value rather than relying on array order, then take its `id` field. If the result is surprising, inspect the preceding timestamped entries before restoring.

### Step 4: Read the snapshot content

Prefer the Read tool with the full path — it always decodes UTF-8 correctly. If you use PowerShell instead, you MUST pass `-Encoding UTF8`:

```powershell
Get-Content "C:\Users\[username]\AppData\Roaming\Code\User\History\[hash-folder]\[id]" -Raw -Encoding UTF8
```

Snapshots are UTF-8 without a BOM, and Windows PowerShell 5.1 decodes BOM-less files as ANSI (Windows-1252) by default. Without `-Encoding UTF8`, every non-ASCII character (curly quotes, em dashes, box-drawing, accents) turns into mojibake like `â€™` — and since Step 5 writes this content back to disk, the corruption becomes permanent in the restored file.

### Step 5: Restore the file

If the original path already exists, compare it with the selected snapshot and ask before replacing it. Otherwise copy the snapshot exactly; do not regenerate its text with a model:

```powershell
$snapshot = "C:\Users\[username]\AppData\Roaming\Code\User\History\[hash-folder]\[id]"
$original = "C:\path\to\recovered-file.md"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $original) | Out-Null
Copy-Item -LiteralPath $snapshot -Destination $original -ErrorAction Stop
if ((Get-FileHash -LiteralPath $snapshot).Hash -ne (Get-FileHash -LiteralPath $original).Hash) {
  throw "Recovery copy did not match the selected snapshot."
}
```

---

## When Editor History Won't Help

- **No eligible saved Local History entry** — the file may have been excluded, too large, unsaved while Local History was enabled, or stored on a remote/web host.
- **Entries were pruned or cleared** — inspect the configured `workbench.localHistory.maxFileEntries`, `maxFileSize`, `mergeWindow`, and `exclude` settings before concluding history is absent.

If editor history doesn't have the file, fall back to:
1. **`estack-read-agent-history`** — if Claude or Codex read the file in a prior session, search the relevant project's sessions with `--mode search --query "filename"`. Its current session roots and formats are documented by that skill.
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
    $content = Get-Content $_.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($content -like "*Untitled-1*") { $_.FullName; $content }
  }

# Result shows: C:\...\History\-6e228c75\entries.json
# entries.json has latest id: "dtgz.md"

# Read snapshot (Read tool preferred; -Encoding UTF8 required if using PowerShell)
Get-Content "C:\Users\2supe\AppData\Roaming\Code\User\History\-6e228c75\dtgz.md" -Raw -Encoding UTF8

# Restore exact bytes and verify the copy
$snapshot = "C:\Users\2supe\AppData\Roaming\Code\User\History\-6e228c75\dtgz.md"
$original = "C:\Users\2supe\All Coding\akiflow-mcp\Untitled-1.md"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $original) | Out-Null
Copy-Item -LiteralPath $snapshot -Destination $original -ErrorAction Stop
if ((Get-FileHash -LiteralPath $snapshot).Hash -ne (Get-FileHash -LiteralPath $original).Hash) { throw "Recovery copy did not match the selected snapshot." }
```
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-vscode-file-recovery:` and a body. File an
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
