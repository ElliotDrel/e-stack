---
name: estack-pdf-to-md
version: 1.2.4
description: >-
  (pdf-to-md) Convert a PDF to Markdown or plain text with the RunPulse API,
  including OCR of scanned pages. Use when asked to extract text from or
  convert a PDF.
---


Convert a PDF (or several PDFs) to Markdown or plain text using the RunPulse API. The underlying script splits the PDF into page batches, fires all batches in parallel against the RunPulse `/extract` endpoint, polls each async job, and reassembles the markdown in correct page order.

## API key check

When the host executes fenced commands on skill load, use its output. Otherwise run this
check before conversion; do not claim the key is available without its result.

```!
# One credential file for the whole pack, not one per skill.
ENV_FILE="$HOME/.e-stack/.env"
echo "=== PULSE_API_KEY status ==="

# Older installs kept the key per-skill, including inside the installed skill
# folder that the installer overwrites on every sync. Read those, but write to
# the shared file.
LEGACY_FILES=(
  "$HOME/.e-stack/estack-pdf-to-md/.env"  # estack-path-ok: read-only legacy credential fallback
  "$HOME/.claude/skills/estack-pdf-to-md/.env"  # estack-path-ok: read-only legacy credential fallback
  "$HOME/.claude/skills/pdf-to-md/.env"  # estack-path-ok: historical legacy path, read-only fallback
)  # estack-path-ok: read-only legacy fallbacks

ENV_KEY="${PULSE_API_KEY:-}"
FOUND_IN="the current process environment"
if [ -z "$ENV_KEY" ]; then
  FOUND_IN="$ENV_FILE"
  for f in "$ENV_FILE" "${LEGACY_FILES[@]}"; do
    if [ -f "$f" ]; then
      ENV_KEY=$(grep -E '^PULSE_API_KEY=' "$f" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' | xargs)
      if [ -n "$ENV_KEY" ]; then FOUND_IN="$f"; break; fi
    fi
  done
fi

USER_VAR=""
if command -v powershell.exe >/dev/null 2>&1; then
  USER_VAR=$(powershell.exe -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('PULSE_API_KEY','User')" 2>/dev/null | tr -d '\r\n')
fi

if [ -n "$ENV_KEY" ]; then
  echo "[OK] PULSE_API_KEY is available from $FOUND_IN."
  if [ "$FOUND_IN" != "the current process environment" ] && [ "$FOUND_IN" != "$ENV_FILE" ]; then
    echo "     Move it privately to $ENV_FILE when convenient; that is the shared home."
  fi
  if [ -n "$USER_VAR" ]; then
    echo "     A Windows user environment copy also exists. The live process value takes precedence; avoid keeping two persistent copies."
  fi
elif [ -n "$USER_VAR" ]; then
  echo "[MISSING] A Windows user environment copy exists but is unavailable to this process."
  echo "          Move it privately to $ENV_FILE, then clear the user-environment copy."
else
  echo "[MISSING] No PULSE_API_KEY configured."
  echo "ACTION: Do not run the script yet. Walk the user through 'First-time setup' below."
fi
```

## First-time setup (only if the startup check reports [MISSING])

If the check above said `[MISSING]`, the user has not configured a RunPulse API key yet. Walk them through it before doing anything else:

1. **Open** https://www.runpulse.com in a browser and create an account (Google/email signup).
2. **Find the API keys section** in the RunPulse dashboard (typically under Settings → API Keys or Developers).
3. **Generate a new key** and copy it. Keys look like a 40-ish character random string (e.g. `kwMLkDai0V7Q...`).
4. **Store it** by adding one line to `~/.e-stack/.env`, the shared credential file every e-stack skill reads:
   ```
   PULSE_API_KEY=<paste-the-key-here>
   ```
   **Append to that file, never overwrite it** — other skills keep their keys there too. Create it if it does not exist. Do not ask the user to paste a credential into chat or echo any part of it back. That file is the only persistent place the key belongs: not a Windows user env var, not a shell profile, not a per-skill `.env`, and never inside the installed skill folder, which the installer overwrites on every sync.
5. **Re-run the startup check** above (or re-invoke the skill only when the host executes fenced commands), and confirm it now reports `[OK]`.

**Never echo a real key back to the user in chat.** Report only whether the setup check found it.

## Required inputs

Resolve these from the request before running:

1. **Input PDF path** — e.g. `C:\Users\2supe\Downloads\foo.pdf`
2. **Output directory** — where the resulting `.md` / `.txt` should be saved

If the PDF path is missing or ambiguous, ask. If the output directory is omitted, use the PDF's folder and state that choice in the result. Check whether the resulting filename would overwrite an existing file; ask only when it would.

## Optional inputs

Mention these only if the user's request implies them — don't ask up front:

| Flag | Default | When to use |
|------|---------|-------------|
| `--format md\|txt` | `md` | User wants a `.txt` file instead of `.md` |
| `--batch-size N` | `10` | Large PDFs (100+ pages) → bump to 20+ to reduce API calls; flaky runs → drop to 5 to shrink the blast radius of a failed batch |
| `--no-separator` | off | User wants clean output with no `<!-- pages N-M -->` HTML comments between batches |
| `--min-chars N` | `20` | Threshold of locally-extractable text below which a page is skipped (not sent to RunPulse). Tune up if too many decoration pages are slipping through; tune down if real content pages are being skipped. |
| `--no-skip` | off | Send every page to RunPulse. **Use this for scanned PDFs** where every page is an image and RunPulse's OCR is the whole point — otherwise the default filter would skip everything. |
| `--quality fast\|high` | `fast` | `fast` = RunPulse `default` model, full parallelism, cheap. `high` = `pulse-ultra-2` vision-language model + full refinement pass (tables, text, formatting), figure extraction, footnote linking. Use `high` for **tables, math, charts, scanned pages, or sloppy formatting**. Ultra 2 is throttled by RunPulse to 2 concurrent / 5 per minute / 20 per hour, so the script caps the worker pool at 2 in this mode. |
| `--pages RANGE` | off | Restrict to a 1-indexed page range like `5`, `5-10`, or `1-2,5`. Useful for spot-testing on a single page before committing to a full run. When set, the blank/image-only filter is bypassed for explicitly requested pages. |

## Cost-saving page filter (on by default)

RunPulse is expensive, so the script filters pages *before* sending anything to the API:

1. Uses `pypdf` locally to extract text from each page.
2. Counts non-whitespace characters.
3. Drops any page with fewer than `--min-chars` (default 20) — this catches blank pages and pages whose entire content is a rasterized image, since `pypdf` can't read the text out of either.
4. Surviving pages get grouped into consecutive ranges and sent in parallel batches.

The script prints exactly which pages it's skipping (e.g. `Skipping 3 page(s): 4, 17, 92`) so the user can sanity-check it. If the user complains that real content got skipped, drop `--min-chars` (e.g. `--min-chars 5`). If the user has a fully-scanned PDF and the script exits with "No pages contain extractable text", run again with `--no-skip` to force every page through OCR.

## How to run

The script auto-loads `PULSE_API_KEY` from these sources, in order:
1. The current shell's `PULSE_API_KEY` env var — a one-off override for a single run, not a place to store the key.
2. `~/.e-stack/.env` (the shared credential file for every e-stack skill), which is where it belongs. Older per-skill locations are still read, but the startup check will tell you to move the key.

So in either shell, just invoke directly — no need to pass the key explicitly:

```powershell
python "$env:USERPROFILE\.agents\skills\estack-pdf-to-md\scripts\pdf_to_md.py" "<input-pdf>" --output-dir "<output-dir>"  # estack-path-ok: execute installed converter; output is the requested deliverable
```

```bash
python "$HOME/.agents/skills/estack-pdf-to-md/scripts/pdf_to_md.py" "<input-pdf>" --output-dir "<output-dir>"
```

If the script exits with `PULSE_API_KEY is not set`, the startup check missed something — re-run the skill to re-trigger the check, or inspect `~/.e-stack/.env` directly. Never echo the key value back to the user.

## Dependencies

The script imports `requests` and `pypdf`. If you hit `ModuleNotFoundError`, install once and retry:

```powershell
pip install requests pypdf
```

## Multiple PDFs

If the user passes a folder or a list of paths, loop sequentially — one script invocation per PDF. The script already parallelizes page batches within a single PDF; running multiple PDFs in parallel on top of that risks hammering the API and obscures which file failed when something breaks.

## Reporting back

When done, report tersely:
- Output file path(s)
- Page count converted (the script prints `Sending N page(s) in M batch(es)...` once it knows what's being sent)

Don't paste the full markdown into chat unless the user asks — the file path is enough.

## Failure handling

The script raises and exits non-zero on any batch error. Don't silently retry the whole run. Instead:

1. Show the error to the user.
2. If it looks like a transient timeout, offer to rerun the same command.
3. If a specific batch repeatedly fails, suggest `--batch-size 5` so the failure scope shrinks and successful batches can still be salvaged on a future run.

### Encrypted PDFs

The script auto-handles publisher-restricted PDFs that are *owner-locked* but have no user password (very common — most "protected" PDFs from publishers fall in this bucket). It silently `decrypt('')`s them to a temp file, runs the conversion, then deletes the temp file. You'll see a one-line note like `<file> was owner-locked; decrypted with empty password to temp copy.`

If the PDF actually has a user password, the script exits with both workarounds spelled out:
1. **Chrome print-to-PDF** — open in Chrome, Ctrl+P → Save as PDF. This re-renders the visible content and produces a clean, unencrypted file. Easiest for the user, no installs.
2. **`qpdf --decrypt --password=<pwd> in.pdf out.pdf`** — requires `qpdf` installed (`winget install qpdf`) and the actual password.

Don't try to bypass real password protection yourself — surface the message and let the user decide.

## Why this skill exists (context for judgment calls)

This was built on 2026-05-20 as a wrapper around a hand-written script, now bundled at `scripts/pdf_to_md.py`. The script was validated on `the-4-hour-workweek-expanded-and-updated-by-timothy-ferriss.pdf` (37 pages, 4 parallel batches). The batching + parallel design is for throughput and to make error messages name the specific page range that failed — but note that **one failed batch currently aborts the whole run** (no partial-result salvage today). Surface the failed range to the user so they can rerun just that span with `--pages`.
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-pdf-to-md:` and a body. File an
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
