# Manual CLI Publish (fallback when GitHub Actions are disabled)

The normal release path is tag-triggered and runs through GitHub Actions with OIDC Trusted Publishing — see `docs/publishing.md`. **Use this manual flow only when Actions are unavailable** (e.g. Actions disabled at the account level — see the Learnings in `docs/publishing.md` for how to detect that).

This flow publishes directly from your machine with `npm publish`. It requires two prerequisites that are **deliberately left OFF between releases** for security, so you must re-enable both each time.

---

## ⚠️ Prerequisites you must re-enable every time

These are reverted after each manual publish on purpose. Without both, `npm publish` will fail.

### 1. Allow token bypass on the package (npm package settings)

By default the `elliot-stack` package is set to **"Require two-factor authentication and disallow tokens"** — this blocks token-based publishing entirely, so even a valid token gets rejected with an OTP prompt.

To enable manual publishing, change it to:

> **Require two-factor authentication or a granular access token with bypass 2FA enabled**

Where: npmjs.com → your packages → **elliot-stack** → **Settings** → Publishing access.

**After publishing, change it back to "…and disallow tokens".**

### 2. Create a granular token with 2FA bypass

A normal token is not enough — the bypass flag must be set **at creation time** (it cannot be added to an existing token afterward).

On npmjs.com → avatar → **Access Tokens** → **Generate New Token** → **Granular Access Token**:

- **Expiration:** as short as practical (e.g. 7 days)
- **Packages and scopes:** Read and write — scope to `elliot-stack` if possible
- **Security settings:** check **"Allow this token to bypass two-factor authentication"** ← the critical box
- Generate and copy the token

**After publishing, revoke this token** (Access Tokens → Delete).

---

## Publish steps

Run from the repo root. Assumes the CHANGELOG is already promoted and `npm version` has created the commit + tag (the standard pre-publish steps in `docs/publishing.md` Phase 1–2 still apply — only the publish mechanism differs).

```bash
# 1. Point npm at the bypass token (the --//... CLI flag form does NOT work — set it in config)
npm config set //registry.npmjs.org/:_authToken=<paste-bypass-token>

# 2. Publish to npm
npm publish

# 3. Push the commit + tag to GitHub
git push --follow-tags
```

A successful publish prints `+ elliot-stack@X.Y.Z`.

---

## Cleanup checklist (do not skip)

After a successful publish, restore the secure baseline:

1. **Revoke the granular token** — npmjs.com → Access Tokens → Delete.
2. **Revert the package setting** back to **"Require two-factor authentication and disallow tokens"**.
3. (Optional) Remove the token from your local npm config: `npm config delete //registry.npmjs.org/:_authToken`.

---

## Gotchas

- **`--//registry.npmjs.org/:_authToken=TOKEN` as a CLI flag silently does nothing** — npm still demands an OTP. You must `npm config set` it first.
- **Bypass must be set when the token is created.** An existing token can't have bypass added later; you'll get an `EOTP` (one-time password required) error and have to make a new one.
- **The package-level "disallow tokens" setting overrides the token.** Even a correctly-created bypass token is rejected until you flip the package setting to allow token bypass (prerequisite #1).
- Treat the token like a password — if it ever appears in a chat, terminal log, or commit, revoke it immediately.
