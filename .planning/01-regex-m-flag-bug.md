# Brief 01 — Section-extracting regexes truncate to one line (`'m'` flag bug)

**Closes:** #1, #5, #6
**File:** `skills/estack-github-issue-tracker/bin/tracker-tools.cjs`
**Size:** ~3 lines changed across 2 regexes. Highest-impact, lowest-risk brief.

---

## Root cause (verified against source)

Two regexes use the `'m'` (multiline) flag together with a `$` alternative inside a
lookahead that follows a **lazy** `[\s\S]*?` capture. With `'m'`, `$` matches at the end of
**every line**, so the lazy quantifier stops after the first body line — every extracted
section is truncated to one line.

### Site A — `applyTrackerUpdates`, line 510-513 (causes #5 **and** #1)
```js
const sectionRe = new RegExp(
  `(### ${escapeRegex(meta.owner)}/${escapeRegex(meta.repo)}#${meta.number}\\s*[—–-][^\\n]*\\n[\\s\\S]*?)(?=\\n### |\\n## |$)`,
  'm'
);
```
`sectionMatch[1]` captures only the header line. Consequences I verified:
- **#5:** the `section.replace(...)` calls that follow (status, history, dupes) find nothing
  in the stub, so `update-tracker` returns `{updated:false, changes:[]}` — no writes land.
- **#1:** at line 594, `updated = updated.replace(originalSection, '')` removes only the
  captured header line when moving an issue to Closed, leaving the body (Role, Filed, Status,
  Goal, History) behind as an orphaned, heading-less block in Active Issues.
- **Bonus:** lines 566-588 extract Goal/Role/History from `originalSection` to preserve them
  in the Closed entry — those always return null too, so closed entries lose their data. Same
  root; fixed by the same change.

### Site B — `extractSection`, line 478-486 (causes #6)
```js
function extractSection(body, headerPattern) {
  const re = new RegExp(
    `^#{2,4}\\s+(?:[^\\n]*?${headerPattern}[^\\n]*)\\n([\\s\\S]*?)(?=^#{2,4}\\s|$)`,
    'mi'
  );
  const match = body.match(re);
  return match ? match[1].trim() : null;
}
```
18 call sites (in `cmdCompileReport`, `buildIssueDetailBlock`, `buildQuietIssueBlock`,
`applyTrackerUpdates`, `buildTrackerEntry`) all extract sections — Activity, Status Summary,
Next Steps, Watch For, Tracker Updates, etc. — truncated to one line. This silently degrades
both the compiled report and the `## Tracker Updates` parsing.

**Red-herring check passed:** #1 reads like an independent "move-to-closed" bug but is a
downstream symptom of Site A. The two issues are the same line. Not a separate fix.

**"Already fixed" claims are false:** both #5 and #6 say "Fixed in session on 2026-05-07."
The buggy flags are present in committed code (lines 482, 512). Verified directly. Issues
must stay OPEN until this brief lands.

---

## The fix

### Site A (line 510-513) — drop `'m'` only
The lookahead already uses `\n### ` / `\n## ` (newline-prefixed), so once `'m'` is gone the
bare `$` correctly means end-of-string. No anchor changes needed.
```diff
     const sectionRe = new RegExp(
       `(### ${escapeRegex(meta.owner)}/${escapeRegex(meta.repo)}#${meta.number}\\s*[—–-][^\\n]*\\n[\\s\\S]*?)(?=\\n### |\\n## |$)`,
-      'm'
+      ''
     );
```
(Or drop the second argument entirely.)

### Site B (line 481-482) — drop `'m'`, fix both anchors
**Do not just remove the flag here.** This regex uses bare `^` anchors. Without `'m'`, a bare
`^` matches only string-start, so every section except the first becomes unfindable, and the
lookahead `(?=^#{2,4}\s)` never fires mid-string (lazy capture would then run to `$`,
swallowing all later sections). Three coordinated changes:
```diff
     const re = new RegExp(
-      `^#{2,4}\\s+(?:[^\\n]*?${headerPattern}[^\\n]*)\\n([\\s\\S]*?)(?=^#{2,4}\\s|$)`,
-      'mi'
+      `(?:^|\\n)#{2,4}\\s+(?:[^\\n]*?${headerPattern}[^\\n]*)\\n([\\s\\S]*?)(?=\\n#{2,4}\\s|$)`,
+      'i'
     );
```
- `^` → `(?:^|\n)`: header can be at string-start (alt `^`, pos 0) or after any newline.
- `(?=^#{2,4}\s` → `(?=\n#{2,4}\s`: stop the capture immediately before a newline+header.
- keep `'i'`: case-insensitive header matching is intentional.

Traced on a 3-section body: `extractSection(body, 'Activity')` correctly returns the full
multi-line `## Activity` body and stops before `## Next Steps`. Header-at-start edge case
handled by the `^` alternative. Template-literal escaping (`\\s`, `\\n`) is correct as-is.

### Why not the alternatives
The agents floated split-on-headers / find-then-slice rewrites (more robust against nested
`####` sub-headers). Not worth it now: all callers pass flat section names and the markdown
is single-level. The minimal flag/anchor fix is correct, reviewable, and zero-risk. If nested
sub-sections ever get introduced, revisit with the split approach.

---

## Verification / test plan

1. **Unit-level repro before fix:** craft a tracker with ≥2 active issues, each with full
   bodies, and a result file marking one closed. Run `update-tracker`. Confirm current code
   leaves an orphaned body (#1) and/or writes nothing (#5).
2. **After fix:**
   - `update-tracker` moves the closed issue's **entire** entry (header + body) to Closed,
     preserving Goal/Role/History — no orphan remains in Active.
   - `update-tracker` actually applies status/history/dupe changes (`changes[]` non-empty).
   - `compile-report` shows full multi-line Activity / Status Summary / Next Steps / Watch For.
3. Add a regression test under `tests/` if a harness exists there (check `pytest.ini` /
   `tests/` — this is JS, so a small node assertion script or existing JS test runner).
4. Run the skill end-to-end on a small real tracker to confirm no markdown corruption.

## Sequencing
Land this **first.** Brief 03 (`append-history`) reuses this section-finding logic and must
not be built on the broken version.

## Commit / PR
Single commit, both sites:
`fix(tracker-tools): drop 'm' flag from section-extracting regexes (#1, #5, #6)`
PR body should close all three issues and note #1 was a downstream symptom of the same root.
