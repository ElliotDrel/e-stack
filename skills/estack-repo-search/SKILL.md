---
name: estack-repo-search
version: 1.2.2
description: >-
  (repo-search) Clone an external GitHub repository locally and search it. Use
  when a question needs code from a repository that is not in the working
  directory.
---

# Repo Search

Search external repositories by cloning them into a persistent sandbox and inspecting the relevant source.

**Preserve cached working-tree files.** This directory holds cached clones of other people's repositories for `Read`/`Grep`/`Explore`; it is not a workspace to patch or fix. Creating a new clone and fetching remote objects are allowed, but never modify, reset, clean, or delete an existing cache's worktree files. If the user wants to change code in one of these repositories, use a fork or a separate working clone.

## Available repos

```!
echo "=== Repo Sandbox: ~/.e-stack/estack-repo-search ==="
echo ""
found=0
for dir in ~/.e-stack/estack-repo-search/*/; do
  [ -d "$dir/.git" ] || continue
  found=1
  name=$(basename "$dir")
  url=$(cd "$dir" && git remote get-url origin 2>/dev/null || echo "(no remote)")
  head=$(git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  changes=$(git -C "$dir" status --short 2>/dev/null)
  echo "- $name  →  $url"
  echo "  Local HEAD: $head"
  [ -z "$changes" ] || echo "  Local changes: present (preserved)"
  echo ""
done
if [ "$found" -eq 0 ]; then
  echo "(no repos cached yet)"
fi
```

This is an inventory of cached evidence. Reuse an exact cached clone when its remote and local commit answer the question. When current upstream state matters, fetch its relevant branch, compare its remote ref with the checked-out commit, then inspect the fetched revision with `git show`, `git grep <revision>`, or a separate fresh snapshot; do not silently search a stale checkout. Never reset or clean a cache to refresh it. Present the listed repositories as available evidence and clone only when no suitable cache exists.

## Finding the correct repo

Before cloning, you must have the exact GitHub URL. Follow these rules:

- **If the user gave a full GitHub URL** (e.g. `https://github.com/org/repo`), use it directly.
- **If the user gave only a name** (e.g. "openclaw", "langchain"), use WebSearch to find the correct GitHub repository URL first. Never guess a repo URL — confirm it via search.
- **Verify** the search result matches the user's request before cloning. Ask only when multiple candidates remain plausible or the search evidence conflicts with the request.

## Cloning

Once you have a confirmed URL and no suitable cached clone, shallow-clone into the sandbox. If the simple target name already exists for a different remote (for example, two organizations both have `api`), select a distinct target such as `<owner>-<repo>` rather than overwriting or reusing it:

```bash
git clone --depth 1 <repo-url> ~/.e-stack/estack-repo-search/<repo-name>
```

## Searching

Inspect locally for a focused question. Use the available delegation facility only when the question has independent bounded areas, and include the full absolute path to the cloned repository in each task. Do not require a particular model, agent type, or delegation feature.

**The subagent's job is navigation, not answers.** Use subagent results to identify which files are relevant, then **read those files yourself** with the Read tool before drawing conclusions. Never trust a subagent's summary of code verbatim — always verify by reading the source directly.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — capture the useful details: what they expected, what happened, and relevant context. If they already provided enough detail, do not ask them to repeat it.

Draft a concise issue title prefixed with `estack-repo-search:` and a body. File an
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
