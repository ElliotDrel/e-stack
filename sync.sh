#!/usr/bin/env bash
# Syncs specific skills from this repo to ~/.claude/skills/
# Usage: bash sync.sh <skill-name> [skill-name ...]
# Example: bash sync.sh better-title
#
# WARNING: This script OVERWRITES the live skill in ~/.claude/skills/.
# Claude must confirm with the user before running this.
#
# IMPORTANT: When adding a new skill to this repo, add it to the
# REGISTERED_SKILLS array below. Unregistered skills cannot be synced.

set -euo pipefail

# ── Registered skills ──────────────────────────────────────────────
# Add new skills here as you create them.
REGISTERED_SKILLS=(
  "better-title"
  "chris-voss"
  "github-issue-tracker"
)
# ───────────────────────────────────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"

is_registered() {
  local name="$1"
  for s in "${REGISTERED_SKILLS[@]}"; do
    [[ "$s" == "$name" ]] && return 0
  done
  return 1
}

if [[ $# -eq 0 ]]; then
  echo "Usage: bash sync.sh <skill-name> [skill-name ...]"
  echo ""
  echo "Registered skills:"
  for s in "${REGISTERED_SKILLS[@]}"; do
    echo "  $s"
  done
  exit 1
fi

for skill_name in "$@"; do
  # Check registration
  if ! is_registered "$skill_name"; then
    echo "Error: '$skill_name' is not registered in sync.sh."
    echo "If this is a new skill, add it to the REGISTERED_SKILLS array in sync.sh first."
    exit 1
  fi

  # Check skill exists in repo
  skill_dir="$REPO_DIR/$skill_name"
  if [[ ! -f "$skill_dir/SKILL.md" ]]; then
    echo "Error: '$skill_name' is registered but has no SKILL.md in the repo."
    exit 1
  fi

  # Overwrite live skill
  if [[ -d "$SKILLS_DIR/$skill_name" ]]; then
    rm -rf "$SKILLS_DIR/$skill_name"
  fi

  cp -r "$skill_dir" "$SKILLS_DIR/$skill_name"
  echo "Synced $skill_name → $SKILLS_DIR/$skill_name"
done

echo "Done."
