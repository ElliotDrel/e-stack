## Publishing

e-stack publishes to npm via GitHub Actions when a git tag matching `v*` is pushed (`.github/workflows/publish.yml`).

The package ships both `skills/` and `hooks/` (whitelisted in `package.json`'s `files` field). Skills install to `~/.agents/skills/estack-*/` (symlinked from `~/.claude/skills/estack-*/`). Any agent that reads `~/.agents/skills/` — including OpenClaw, Codex, ChatGPT, and Cursor — will pick up skills automatically with no extra config. Hooks are Claude Code-only: they install to `~/.claude/hooks/` and get registered in `~/.claude/settings.json` by `bin/install.cjs`. Do not try to route hooks through `~/.agents/`.

### How to publish

```bash
npm version patch        # bumps package.json, makes a commit, creates v1.0.x tag
git push --follow-tags   # pushes commit + tag — the tag triggers publish
```

Use `npm version minor` or `npm version major` for non-patch bumps.

### How it works

1. `npm version patch` updates `package.json`, makes a commit (e.g. `1.0.16`), and creates a matching `v1.0.16` tag locally.
2. `git push --follow-tags` pushes both the commit (to `main`) and the tag.
3. The tag push triggers the workflow.
4. Workflow verifies the tag matches `package.json` version, verifies per-skill/hook versions were bumped for any content that changed since the previous release (`node scripts/check-versions.cjs` — run it locally with `--fix` to auto-bump before tagging), verifies README.md and CLAUDE.md list every skill and hook (`node scripts/check-docs.cjs`), then publishes to npm using OIDC Trusted Publishing.

Regular commits to `main` (no tag) do NOT trigger a publish.

### Why tag-triggered (security)

- The workflow has **no write access** to the repo (`contents: read` only) — it cannot push anything back.
- The checkout step uses `persist-credentials: false`, so even the read-only token isn't left in `.git/config` during the job.
- Only the repo owner can push to `main` (branch protection requires PRs from everyone else).
- Publishing requires deliberate action (`npm version` + tag push) — it can't be smuggled into a regular PR.
- A version-mismatch guard in the workflow refuses to publish if the tag (`v1.0.16`) doesn't match `package.json` (`1.0.16`).
- An attacker would need to (a) merge a malicious PR (blocked: only the owner can merge) AND (b) cut a release tag (blocked: only the owner can push to `main`).

### Repo configuration (security baseline)

These are the settings that make the model above hold. If something here drifts, the security argument weakens.

**Branch protection on `main`** (`gh api repos/ElliotDrel/e-stack/branches/main/protection`):

| Setting | Value | Why |
|---|---|---|
| `required_pull_request_reviews` | enabled (0 approvals required) | Non-admins must open a PR — they cannot push directly |
| `enforce_admins` | `false` | Owner (admin) bypasses, so direct pushes for releases still work |
| `required_linear_history` | `true` | No merge commits on `main` — keeps history clean and rebase-only |
| `allow_force_pushes` | `false` | No history rewrites on `main` |
| `allow_deletions` | `false` | `main` cannot be deleted |
| `restrictions` | `null` | (Personal repos can't use push allowlists — admin bypass covers it) |

**Repo settings** (`gh api repos/ElliotDrel/e-stack`):

| Setting | Value | Why |
|---|---|---|
| `allow_merge_commit` | `false` | PR merge UI only offers Squash or Rebase — supports linear history |
| `allow_squash_merge` | `true` | Allowed |
| `allow_rebase_merge` | `true` | Allowed |
| `delete_branch_on_merge` | `true` | PR branches auto-delete after merge |
| `default_workflow_permissions` | `read` | Default `GITHUB_TOKEN` in any workflow is read-only |
| Vulnerability alerts | `enabled` | Required for Dependabot security updates |
| Dependabot security updates | `enabled` | Auto-PRs for vulnerable deps |
| Secret scanning | `enabled` | Catches leaked secrets in pushes/history |
| Secret scanning push protection | `enabled` | Blocks pushes that contain detected secrets |

**npm side:**

- **Trusted Publisher** configured for `ElliotDrel/e-stack` → `publish.yml` (OIDC, no npm token stored anywhere)
- **Publishing access:** "Require two-factor authentication and disallow tokens"
- **Provenance** is emitted automatically by Trusted Publishing — no `--provenance` flag needed

**Workflow file:**

- `permissions: { id-token: write, contents: read }` — only what OIDC needs
- `actions/checkout@v6` with `persist-credentials: false`
- `actions/setup-node@v6` with Node 24 (required for OIDC, see Learnings below)

### Learnings

- npm OIDC Trusted Publishing requires `actions/setup-node@v6` and Node 24+. Older versions (v4, Node 20) silently fail with E404 because the npm CLI doesn't properly handle the OIDC token exchange.
- npm's "Trusted Publishing" handles both auth AND provenance — no `--provenance` flag or `NODE_AUTH_TOKEN` env var needed.
- YAML values containing colons (e.g. `"chore: bump"`) must be quoted or they break GitHub Actions parsing.
- The previous flow (commit-message `[publish]` → CI bumps version → CI pushes back) required the workflow to have write access to `main`, which is incompatible with strict branch protection. Tag-triggered publish removes that requirement entirely.
- GitHub Actions can be disabled at the account level. When disabled, the API returns HTTP 422: "Actions has been disabled for this user" on any workflow trigger, and zero runs appear in history — even for workflows that previously ran successfully. There is no self-service toggle (`github.com/settings/actions` 404s for personal accounts). Fix: contact GitHub Support (reinstatement request form).
- Re-enabling Actions does not replay missed tag events. If tags were pushed while Actions was disabled, delete and re-push only the latest tag after re-enabling: `git push origin :refs/tags/vX.Y.Z && git push origin refs/tags/vX.Y.Z`
- Fastest Actions health check: run `gh workflow run publish.yml --repo ElliotDrel/e-stack`. HTTP 422 = disabled at account level. A run appearing = Actions is working.
- **Manual CLI publish (when Actions are disabled):** there is a full fallback flow for publishing directly from your machine with `npm publish`. It requires temporarily enabling a package setting and creating a 2FA-bypass token, both of which are reverted after each release. See `docs/manual-publish.md`.
