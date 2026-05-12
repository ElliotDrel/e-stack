---
name: estack-repo-search
description: >-
  (repo-search) Clone and search external GitHub repositories to answer questions about their
  code. Use this skill whenever the user references a repo you don't have local
  context for, asks about code in an external project, wants to compare
  implementations across repos, or needs information from a codebase that isn't
  in the current working directory. Also use when the user says things like
  "check how X does it", "look at the source for Y", "search that repo",
  "clone it and find...", or references a GitHub URL. If you're unsure whether
  you have enough context about an external codebase to answer accurately,
  use this skill to clone it and look.
---

# Repo Search

Search external repositories by cloning them into a persistent sandbox and exploring with subagents.

## Available repos

```!
mkdir -p ~/repo-search-storage
echo "=== Repo Sandbox: ~/repo-search-storage ==="
echo ""
found=0
for dir in ~/repo-search-storage/*/; do
  [ -d "$dir/.git" ] || continue
  found=1
  name=$(basename "$dir")
  url=$(cd "$dir" && git remote get-url origin 2>/dev/null || echo "(no remote)")
  echo "- $name  →  $url"
  echo "  Updating..."
  (cd "$dir" && git pull --ff-only 2>&1) | sed 's/^/  /'
  echo ""
done
if [ "$found" -eq 0 ]; then
  echo "(no repos cached yet)"
fi
```

Present the user with the repos listed above and offer to search any of them or clone a new one.

## Finding the correct repo

Before cloning, you must have the exact GitHub URL. Follow these rules:

- **If the user gave a full GitHub URL** (e.g. `https://github.com/org/repo`), use it directly.
- **If the user gave only a name** (e.g. "openclaw", "langchain"), use WebSearch to find the correct GitHub repository URL first. Never guess a repo URL — confirm it via search.
- **Always verify** the search result matches what the user is asking about before cloning. It doesn't hurt to confirm with the user — "I found X repo, is that the one you meant?" — before spending time cloning. Wrong repo = wasted time and misleading answers.

## Cloning

Once you have a confirmed URL, shallow clone into the sandbox:

```bash
git clone --depth 1 <repo-url> ~/repo-search-storage/<repo-name>
```

## Searching

To explore a repo, spawn one or more **Haiku** subagents using the Agent tool with `model: "haiku"` and `subagent_type: "Explore"`. In the prompt, always include the **full absolute path** to the cloned repo (e.g. `C:/Users/2supe/repo-search-storage/gstack`) and tell the subagent to search within that directory. Without this, the subagent won't know where to look.

If the question spans multiple areas of the repo, spawn multiple subagents in parallel — each focused on a different aspect — to get answers faster.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-repo-search: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL and share it so the user can click, review, and submit:

```bash
python3 -c "
import urllib.parse
title = 'estack-repo-search: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user. They click it, review the pre-filled title and body, then click **Submit new issue**.

---

## Skill Feedback
---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-repo-search: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-repo-search: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
