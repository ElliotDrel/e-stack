# gh CLI Patterns

Reusable command templates for all GitHub API calls in this skill. Replace CAPS placeholders
with actual values.

---

## Issue Metadata

Fetch state, labels, comment count, timestamps:
```bash
gh api repos/OWNER/REPO/issues/NUMBER --jq '{state: .state, labels: [.labels[].name], comments: .comments, updated: .updated_at, created: .created_at}'
```

## Issue Comments

Last 3 comments with author, date, full body:
```bash
gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '.[-3:] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body}'
```

All comments (for drafting — verify claims before posting):
```bash
gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '.[] | {author: .user.login, date: .created_at, body: .body}'
```

Comments since a date:
```bash
gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '[.[] | select(.created_at > "DATE")] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body}'
```

**Truncation rules:** Never truncate comments on the primary issue being reviewed — technical
details (addresses, error codes, test counts) get lost. For secondary fetches (known
duplicates, upstream), `[0:1500]` is acceptable to manage context size.

## Issue Body

Full issue body (read before commenting on unfamiliar issues):
```bash
gh api repos/OWNER/REPO/issues/NUMBER --jq '.body'
```

## Search: Issues Involving User

Open issues with recent activity:
```bash
gh api "search/issues?q=involves:USERNAME+updated:>DATE+is:open" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [updated: \(.updated_at)]"'
```

## Search: Issues by Author

```bash
gh api "search/issues?q=author:USERNAME+is:open&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [updated: \(.updated_at | split("T")[0])]"'
```

## Search: Issues by Commenter (excluding authored)

```bash
gh api "search/issues?q=commenter:USERNAME+is:open+-author:USERNAME&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [updated: \(.updated_at | split("T")[0])]"'
```

## Search: Keyword Search for Duplicates

Search for issues matching keywords, created after a specific date:
```bash
gh api "search/issues?q=repo:OWNER/REPO+is:open+created:>DATE+KEYWORD1+KEYWORD2&per_page=10" --jq '.items[] | "#\(.number) — \(.title) [\(.created_at | split("T")[0])] @\(.user.login)"'
```

Use multiple keyword variations per search to catch different phrasings. Example for an OAuth issue:
- Search 1: `OAuth redirect MCP`
- Search 2: `clientId mcp add`
- Search 3: `Slack plugin authentication`

## Search: Recently Closed Issues

```bash
gh api "search/issues?q=involves:USERNAME+is:closed+closed:>DATE&per_page=50&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [closed: \(.closed_at | split("T")[0])]"'
```

## Post Comment

```bash
gh issue comment NUMBER --repo OWNER/REPO --body "$(cat <<'EOF'
Comment body here.
Supports **markdown**.
EOF
)"
```

Always use heredoc (`<<'EOF'`) for comment bodies to handle special characters and newlines.

## Quick State Check

Check if an issue is still open (fast, minimal data):
```bash
gh api repos/OWNER/REPO/issues/NUMBER --jq '.state'
```

## PR Status Check

```bash
gh api repos/OWNER/REPO/pulls/NUMBER --jq '{state: .state, merged: .merged, title: .title, updated: .updated_at}'
```

---

## Rate Limiting

GitHub API has rate limits. If running many parallel requests:
- Authenticated requests: 5000/hour
- Search API: 30 requests/minute
- If you hit limits, batch searches and add short delays between search batches
- Metadata fetches (repos/OWNER/REPO/issues/NUMBER) don't count against search limits

## Parallel Execution Strategy

To maximize speed, batch API calls by type:

**Batch 1 (parallel):** All active issue metadata + comments (these are REST calls, not search)
**Batch 2 (parallel):** All known duplicate/related issue checks (REST calls)
**Batch 3 (parallel):** All keyword searches for new duplicates (search API — respect 30/min limit)
**Batch 4 (parallel):** User involvement search + closed issue checks + upstream checks

Batches 1 and 2 can run simultaneously. Batch 3 should start after a brief pause if Batch 1+2 included many calls. Batch 4 can run with Batch 1.
