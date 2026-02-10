#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/stack-pr.sh [--dry-run] [--parent <branch>]

Automates stacked PR submission and metadata updates:
1. Tracks the current branch in Graphite (if needed)
2. Submits the stack with Graphite
3. Updates the current branch PR title/body using a standard template

Options:
  --dry-run         Print planned actions without mutating remote PR state
  --parent <branch> Parent branch used when tracking untracked branches (default: main)
  -h, --help        Show this help

Environment overrides:
  PR_STACK_PARENT            Default parent branch for tracking (default: main)
  PR_STACK_MAX_FILES         Max files shown in PR body (default: 20)
  PR_STACK_MAX_SUMMARY_ITEMS Max summary bullets from commit subjects (default: 5)
USAGE
}

DRY_RUN=0
PARENT_BRANCH="${PR_STACK_PARENT:-main}"
MAX_FILES="${PR_STACK_MAX_FILES:-20}"
MAX_SUMMARY_ITEMS="${PR_STACK_MAX_SUMMARY_ITEMS:-5}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      continue
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --parent)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --parent" >&2
        exit 1
      fi
      PARENT_BRANCH="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

require_command git
require_command gt
require_command gh
require_command rg

branch="$(git branch --show-current)"
if [[ -z "$branch" ]]; then
  echo "Could not determine current branch." >&2
  exit 1
fi

if [[ "$branch" == "main" || "$branch" == "master" ]]; then
  echo "Refusing to submit PR from $branch. Create/use a feature branch first." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before running pr:stack." >&2
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  agent_learning_check_output=""
  if agent_learning_check_output="$(pnpm agents:check 2>&1)"; then
    if [[ -n "$agent_learning_check_output" ]]; then
      echo "$agent_learning_check_output"
    fi
    if echo "$agent_learning_check_output" | rg -q "WARNING:"; then
      echo "Agent learning warnings detected. Update learnings or mark N/A in the PR checklist."
    fi
  else
    echo "$agent_learning_check_output"
    echo "Agent learning check errored; continuing without blocking stacked PR submission."
  fi
else
  echo "pnpm not found; skipping optional agent learning check."
fi

# Track the branch if Graphite is not aware of it yet.
if ! gt ls --no-interactive | awk -v branch="$branch" '
  {
    for (i = 1; i <= NF; i++) {
      if ($i == branch) {
        found = 1
      }
    }
  }
  END {
    exit found ? 0 : 1
  }
'; then
  run gt track --parent "$PARENT_BRANCH" --no-interactive
else
  echo "Branch $branch is already tracked by Graphite."
fi

run gt submit --stack --no-interactive --no-edit --publish

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run complete."
  exit 0
fi

pr_number="$(gh pr list --head "$branch" --json number --jq '.[0].number')"
if [[ -z "$pr_number" || "$pr_number" == "null" ]]; then
  echo "Unable to locate PR for branch $branch." >&2
  exit 1
fi
pr_url="$(gh pr view "$pr_number" --json url --jq '.url')"
base_ref="$(gh pr view "$pr_number" --json baseRefName --jq '.baseRefName')"

if git show-ref --verify --quiet "refs/remotes/origin/${base_ref}"; then
  diff_base="origin/${base_ref}"
elif git show-ref --verify --quiet "refs/heads/${base_ref}"; then
  diff_base="${base_ref}"
else
  diff_base="$(git merge-base HEAD "$PARENT_BRANCH")"
fi

summary_items=()
while IFS= read -r line; do
  summary_items+=("$line")
done < <(git log --no-merges --format='%s' "${diff_base}..HEAD" | head -n "$MAX_SUMMARY_ITEMS")
if [[ "${#summary_items[@]}" -eq 0 ]]; then
  summary_items=("$(git log -1 --format='%s')")
fi

key_files=()
while IFS= read -r line; do
  key_files+=("$line")
done < <(git diff --name-only "${diff_base}...HEAD" | head -n "$MAX_FILES")
if [[ "${#key_files[@]}" -eq 0 ]]; then
  key_files=("(no file changes detected relative to ${base_ref})")
fi

milestones=()
while IFS= read -r line; do
  milestones+=("$line")
done < <(git diff -U0 "${diff_base}...HEAD" -- notes.md 2>/dev/null | rg -o 'M[0-9]+' | sort -u)
if [[ "${#milestones[@]}" -eq 0 ]]; then
  milestones=("Not specified in this branch")
fi

tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT

{
  echo "## Summary"
  for item in "${summary_items[@]}"; do
    echo "- ${item}"
  done
  echo

  echo "## What Changed"
  echo "- submitted/updated this branch as part of a Graphite stack"
  echo "- refreshed PR metadata from the current branch diff and commit history"
  echo

  echo "## Key Files"
  for file in "${key_files[@]}"; do
    echo "- \`${file}\`"
  done
  echo

  echo "## Validation"
  echo "- pnpm build"
  echo "- pnpm test"
  echo "- pnpm format:check"
  echo "- [ ] Agent learnings updated (or N/A with reason)"
  echo

  echo "## Milestones"
  for milestone in "${milestones[@]}"; do
    echo "- ${milestone}"
  done
} > "$tmp_body"

title="${summary_items[0]}"
run gh pr edit "$pr_number" --title "$title" --body-file "$tmp_body"

echo "Updated PR #${pr_number}: ${pr_url}"
