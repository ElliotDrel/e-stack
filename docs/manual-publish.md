# Manual CLI Publish

This is an exceptional fallback when the normal tag-triggered GitHub Actions
release is unavailable. It still publishes a package and pushes a release tag, so
use it only after the user has explicitly approved that release. Complete the
normal release preparation in `docs/publishing.md` first.

## Confirm the fallback

Use read-only repository and Actions inspection to establish that the normal
release path is unavailable. Do not change GitHub, npm, branch-protection, or
package-security settings merely to test health. The npm account owner must
confirm the current package settings before starting because account UI labels and
authorization rules can change.

## Temporary npm access

Manual publishing may require temporarily allowing a granular npm token with
2FA-bypass capability for the package. This is a security-sensitive, external
configuration change. Before doing it, present the exact package setting change,
token scope and expiry, restoration action, and release version for explicit
approval.

Create the narrowest practical token in the npm account, keep it out of chat,
shell history, source control, and logs, and provide it to npm through an
approved local credential mechanism. Do not build shell commands by interpolating
the token or other user-supplied text.

## Publish and restore

1. Publish the already prepared package from the repository root.
2. Confirm the published package name and version with an npm read.
3. Push the prepared release commit and tag when that is part of the approved
   release path; verify the resulting remote workflow outcome separately.
4. Revoke the temporary token, remove its local npm credential, and restore the
   package's token-restriction setting.

Report each external action with separate evidence. If any cleanup step fails,
say exactly what remains and do not claim the secure baseline was restored.
