# Brief 02 — PR merge-readiness signals + stale-data reconciliation

**Closes:** #2 (all three failure modes)
**Files:** `references/gh-cli-patterns.md`, `SKILL.md`, `references/result-file-schema.md`,
`bin/tracker-tools.cjs`
**Size:** medium — schema + prompt + one fetch addition. Independent of other briefs.

---

## Root cause (verified against source)

One compound root produces all three reported failure modes:

> **The pipeline is issue-shaped (never fetches PR health), and the reconciliation rule only
> fills blanks — it never overwrites stale API facts.**

### FM1 — PR merge-readiness never fetched
- `gh-cli-patterns.md` PR template fetches only `state, merged, title, updated_at`. No
  `mergeStateStatus`, `mergeable`, `reviewDecision`, `statusCheckRollup`, or reviews.
- `cmdFetchIssues` calls `repos/OWNER/REPO/issues/NUMBER` for everything and extracts 6
  issue-shaped fields; it never inspects `raw.pull_request` or hits the pulls endpoint. So
  `raw-*.json` contains no PR health for agents to read.
- `result-file-schema.md` has no PR-specific section — no slot to write merge/CI/review state.

### FM2 — stale tracker data trusted over fresh API data (verified at SKILL.md:167-169)
```
**Fill in missing data:** ... If the tracker entry is missing factual fields ... the agent
should fill them in from the API data.
```
The operative word is **missing**. A wrong-but-present value (e.g. a PR wrongly marked
"approved" in a prior run) is never overwritten — a one-way ratchet. Confirmed: agents only
emit `status_summary:`/etc. into `## Tracker Updates` when they decide a field needs writing,
and the prompt tells them to only populate blanks.

### FM3 — bot reviews misread as approvals
Downstream of FM1: reviews are never fetched, so `COMMENTED` vs `APPROVED` and `[bot]` vs
human reviewers are invisible. No CLI template, schema field, or prompt instruction guards it.

**Red-herring check passed:** FM3 is not independent — it's a consequence of FM1 (no review
fetch). Fixing FM1 surfaces the data; FM3 needs only the interpretation rule on top.

---

## The fix (recommended: full fix across 4 files)

Apply in this order:

1. **`gh-cli-patterns.md`** — add a PR-health template and a bot-filter note:
   ```bash
   # PR health (run when the tracked item is a PR)
   gh pr view NUMBER --repo OWNER/REPO \
     --json state,mergeStateStatus,mergeable,reviewDecision,statusCheckRollup,reviews
   ```
   Note: `gh pr view --json` resolves `reviewDecision`/`statusCheckRollup` via GraphQL under
   the hood — REST issues endpoint cannot. Add: "A review with `state: COMMENTED` is not an
   approval. Reviewers whose login ends in `[bot]` do not satisfy a human-review requirement —
   record them separately."

2. **`SKILL.md` Step 2b** — replace the "fill missing" rule (line 167-171) with two explicit
   categories:
   - **Always re-fetch and overwrite (API-observable, high-churn):** open/closed `state`,
     `labels`, `comment_count`, last-comment date, `mergeStateStatus`, `mergeable`,
     `reviewDecision`, CI status. Never trust the tracker for these.
   - **Fill only if missing (human analysis, low-churn):** Goal, root cause, Workaround, Key
     technical data, Role description.
   Add: "If the item is a PR, fetch the PR-health template from `gh-cli-patterns.md` and
   record merge state, review decision, and CI status in Status Summary and Next Steps.
   Distinguish bot reviews from human reviews; `COMMENTED` ≠ `APPROVED`."

3. **`result-file-schema.md`** — add `is_pr: true|false` to frontmatter; add a conditional
   `## PR Health` body section (merge_state, mergeable, review_decision, ci_status,
   ci_failures, human_reviews vs bot_reviews); annotate which `## Tracker Updates` keys are
   "always-write" vs "fill-if-missing" to mirror the Step 2b rule.

4. **`bin/tracker-tools.cjs` `cmdFetchIssues`** — in the issue fetch path, detect
   `raw.pull_request != null`; if true, fire a second `gh pr view ... --json ...` and attach
   the result as `pr_health` on the issue's raw JSON. Centralizing here (vs. asking agents to
   fetch ad-hoc) guarantees coverage, parallelism, and caching to `raw-*.json`.

### Why centralize the fetch (Option B over C)
Letting agents fetch PR health ad-hoc (Option C) is easy to skip and impossible to verify —
Step 2b verifies file count but nothing about PR coverage. Doing it in `fetch-issues` means
every PR gets health data unconditionally and it's cached for debugging.

---

## Verification / test plan
1. Track a PR that currently has a merge conflict + a failing check + a bot `COMMENTED`
   review. Run a check-in.
2. Confirm the result file's `## PR Health` shows `mergeStateStatus: DIRTY`, the CI failure,
   and `reviewDecision` ≠ APPROVED, with the bot review listed separately from human reviews.
3. Confirm the compiled report surfaces the conflict / CI failure / review-needed as actions.
4. **FM2 regression:** seed the tracker with a wrong `state`/review value, run a check-in,
   confirm the API value overwrites it (not preserved).
5. Confirm human-analysis fields (Goal, root cause) are still preserved, not clobbered.

## Sequencing
Independent — can run in parallel with Brief 01. Touches no regex in the #1/#5/#6 cluster.

## Commit / PR
`feat(tracker-tools): fetch PR merge-readiness and always-refresh API-observable fields (#2)`
