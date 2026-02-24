#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="${GITHUB_BASE_REF:-main}"
BASE_REF="origin/${BASE_BRANCH}"
MAX_FILES="${PR_REVIEW_MAX_FILES:-8}"

if ! git show-ref --verify --quiet "refs/remotes/${BASE_REF}"; then
  git fetch --no-tags origin "${BASE_BRANCH}" --depth=50 >/dev/null 2>&1 || true
fi

if git show-ref --verify --quiet "refs/remotes/${BASE_REF}"; then
  DIFF_BASE="$(git merge-base HEAD "${BASE_REF}")"
else
  DIFF_BASE="$(git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD)"
fi

changed_files=()
while IFS= read -r file; do
  changed_files+=("$file")
done < <(git diff --name-only "${DIFF_BASE}...HEAD")
total_files="${#changed_files[@]}"

source_files=0
test_files=0

is_test_file() {
  local file="$1"
  case "$file" in
    *.test.*|*.spec.*|*/__tests__/*|*/tests/*|*/test/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_source_file() {
  local file="$1"
  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.py|*.go|*.rs|*.java|*.kt)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

for file in "${changed_files[@]}"; do
  if is_test_file "$file"; then
    test_files=$((test_files + 1))
  fi

  if is_source_file "$file" && ! is_test_file "$file"; then
    source_files=$((source_files + 1))
  fi
done

diff_totals="$(git diff --numstat "${DIFF_BASE}...HEAD" | awk '{added += $1; removed += $2} END {print added + 0, removed + 0}')"
added_lines="${diff_totals%% *}"
removed_lines="${diff_totals##* }"

echo "## Findings"
echo

if ((source_files > 0 && test_files == 0)); then
  echo "- [SEV-3] Source changes without matching test updates — \`multiple files\`"
  echo "  - Risk: Regressions can slip through when behavior changes are untested."
  echo "  - Evidence: ${source_files} source-like file(s) changed and 0 test-like file(s) changed."
  echo "  - Fix: Add or update focused tests that cover changed behavior and edge cases."
  echo "  - Test: Run the relevant package/app test suites in CI and locally."
else
  echo "- \`No blocking findings.\`"
fi

echo
echo "## Open Questions / Assumptions"
echo
echo "- This automated review is heuristic and complements (not replaces) human review."
echo "- Diff baseline: \`${DIFF_BASE}\` compared to \`HEAD\`."
echo
echo "## Change Summary"
echo

if ((total_files == 0)); then
  echo "- No changed files detected in this diff."
else
  echo "- Diff summary: +${added_lines} / -${removed_lines} across ${total_files} file(s)."
  echo "- Source-like files changed: ${source_files}; test-like files changed: ${test_files}."
  echo "- Key changed files:"

  listed=0
  for file in "${changed_files[@]}"; do
    echo "  - \`${file}\`"
    listed=$((listed + 1))
    if ((listed >= MAX_FILES)); then
      break
    fi
  done

  remaining=$((total_files - listed))
  if ((remaining > 0)); then
    echo "  - ... and ${remaining} more file(s)."
  fi
fi

echo
echo "- Residual risks/testing gaps: Manual semantic review is still required for correctness, security, and behavioral regressions."
