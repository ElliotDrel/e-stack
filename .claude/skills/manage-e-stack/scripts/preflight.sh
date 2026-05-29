#!/usr/bin/env bash
# Pre-flight diagnostics for e-stack publishing
# Read-only — does not modify anything

echo "=== Current installed skills ==="
for skill in ~/.claude/skills/estack-*/; do
  [ -d "$skill" ] || continue
  echo "$(basename "$skill"): $(find "$skill" -type f | wc -l) files"
done

echo ""
echo "=== Repo skills ==="
for skill in skills/estack-*/; do
  echo "$(basename "$skill")"
done

echo ""
echo "=== Diffs between repo and installed ==="
diffs=0
for skill in skills/estack-*/; do
  name=$(basename "$skill")
  if [ ! -d ~/.claude/skills/$name ]; then
    echo "NEW: $name (not yet installed)"
    diffs=$((diffs + 1))
  else
    diff_output=$(diff -rq "$skill" ~/.claude/skills/$name 2>&1)
    if [ -n "$diff_output" ]; then
      echo "CHANGED: $name"
      echo "$diff_output"
      diffs=$((diffs + 1))
    fi
  fi
done
for skill in ~/.claude/skills/estack-*/; do
  [ -d "$skill" ] || continue
  name=$(basename "$skill")
  if [ ! -d "skills/$name" ]; then
    echo "STALE: $name (installed but not in repo)"
    diffs=$((diffs + 1))
  fi
done
if [ "$diffs" -eq 0 ]; then
  echo "(all match)"
fi

echo ""
echo "=== Current installed hooks ==="
hook_count=0
for hook in ~/.claude/hooks/*.js; do
  [ -f "$hook" ] || continue
  echo "$(basename "$hook")"
  hook_count=$((hook_count + 1))
done
[ "$hook_count" -eq 0 ] && echo "(none)"

echo ""
echo "=== Repo hooks ==="
repo_hook_count=0
for hook in hooks/*.js; do
  [ -f "$hook" ] || continue
  echo "$(basename "$hook")"
  repo_hook_count=$((repo_hook_count + 1))
done
[ "$repo_hook_count" -eq 0 ] && echo "(none)"

echo ""
echo "=== Hook diffs between repo and installed ==="
hook_diffs=0
for hook in hooks/*.js; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  if [ ! -f ~/.claude/hooks/"$name" ]; then
    echo "NEW: $name (not yet installed)"
    hook_diffs=$((hook_diffs + 1))
  else
    diff_output=$(diff -q "$hook" ~/.claude/hooks/"$name" 2>&1)
    if [ -n "$diff_output" ]; then
      echo "CHANGED: $name"
      hook_diffs=$((hook_diffs + 1))
    fi
  fi
done
for hook in ~/.claude/hooks/*.js; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  if [ -f hooks/"$name" ]; then continue; fi
  # Only flag as STALE if the repo previously had it (heuristic: installed via estack checksums)
  if grep -q "\"hook:$name\"" ~/.claude/.estack-checksums.json 2>/dev/null; then
    echo "STALE: $name (installed but not in repo)"
    hook_diffs=$((hook_diffs + 1))
  fi
done
if [ "$hook_diffs" -eq 0 ]; then
  echo "(all match)"
fi

echo ""
echo "=== Frontmatter check ==="
fm_errors=0
for skill in skills/estack-*/; do
  name=$(basename "$skill")
  skillmd="$skill/SKILL.md"
  if ! grep -q "^name:" "$skillmd"; then
    echo "FAIL: MISSING name field in $name"
    fm_errors=$((fm_errors + 1))
  fi
  if ! grep -q "^description:" "$skillmd"; then
    echo "FAIL: MISSING description field in $name"
    fm_errors=$((fm_errors + 1))
  fi
  short_name="${name#estack-}"
  desc_line=$(grep -A1 "^description:" "$skillmd" | tail -1)
  if ! echo "$desc_line" | grep -q "($short_name)"; then
    if ! grep "^description:" "$skillmd" | grep -q "($short_name)"; then
      echo "FAIL: MISSING (name) prefix in description for $name"
      fm_errors=$((fm_errors + 1))
    fi
  fi
done
if [ "$fm_errors" -eq 0 ]; then
  echo "(all valid)"
fi

echo ""
echo "=== Git status ==="
git status --short
echo ""
git diff --stat
