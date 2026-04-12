#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/pr-validate.sh [--base <ref>] [--head <ref>] [--dry-run]

Run a focused local validation profile for the current branch or a specific diff.

Options:
  --base <ref>   Diff base ref. Defaults to origin/main, main, origin/master, or master.
  --head <ref>   Diff head ref. Defaults to HEAD.
  --dry-run      Print the selected validation commands without executing them.
  -h, --help     Show this help.
USAGE
}

DRY_RUN=0
BASE_REF=""
HEAD_REF="HEAD"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --base" >&2
        exit 1
      fi
      BASE_REF="$2"
      shift 2
      ;;
    --head)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --head" >&2
        exit 1
      fi
      HEAD_REF="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --)
      shift
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

resolve_default_base() {
  local candidate
  for candidate in origin/main main origin/master master; do
    if git rev-parse --verify "$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done

  echo "Unable to resolve a default diff base. Pass --base explicitly." >&2
  exit 1
}

run_command() {
  local label="$1"
  local command="$2"

  echo
  echo "[$label]"
  echo "+ $command"

  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi

  bash -lc "$command"
}

path_exists_for_validation() {
  local path="$1"
  [[ -e "$path" ]]
}

build_prettier_command() {
  local parser="$1"
  shift
  local command="pnpm exec prettier --check"
  local file

  if [[ -n "$parser" ]]; then
    command="${command} --parser $(printf '%q' "$parser")"
  else
    command="${command} --ignore-unknown"
  fi

  command="${command} --"

  for file in "$@"; do
    command="${command} $(printf '%q' "$file")"
  done

  echo "$command"
}

build_prettier_check_command() {
  local file
  local command=""
  local default_files=()
  local mdc_files=()

  for file in "${changed_files[@]}"; do
    if ! path_exists_for_validation "$file"; then
      continue
    fi

    case "$file" in
      *.mdc)
        mdc_files+=("$file")
        ;;
      *)
        default_files+=("$file")
        ;;
    esac
  done

  if [[ "${#default_files[@]}" -gt 0 ]]; then
    command="$(build_prettier_command "" "${default_files[@]}")"
  fi

  if [[ "${#mdc_files[@]}" -gt 0 ]]; then
    if [[ -n "$command" ]]; then
      command="${command} && "
    fi
    command="${command}$(build_prettier_command "markdown" "${mdc_files[@]}")"
  fi

  echo "$command"
}

contains_item() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

add_profile() {
  local profile="$1"
  if [[ "${#profiles[@]}" -eq 0 ]]; then
    profiles+=("$profile")
    return 0
  fi

  if ! contains_item "$profile" "${profiles[@]}"; then
    profiles+=("$profile")
  fi
}

add_file() {
  local file="$1"

  if [[ -z "$file" ]]; then
    return 0
  fi

  if [[ "${#changed_files[@]}" -eq 0 ]]; then
    changed_files+=("$file")
    return 0
  fi

  if ! contains_item "$file" "${changed_files[@]}"; then
    changed_files+=("$file")
  fi
}

add_command() {
  local label="$1"
  local command="$2"

  if [[ "${#commands[@]}" -eq 0 ]]; then
    labels+=("$label")
    commands+=("$command")
    return 0
  fi

  if contains_item "$command" "${commands[@]}"; then
    return 0
  fi

  labels+=("$label")
  commands+=("$command")
}

collect_files() {
  local file
  while IFS= read -r file; do
    add_file "$file"
  done < <("$@")
}

require_command git
require_command pnpm

if [[ -z "$BASE_REF" ]]; then
  BASE_REF="$(resolve_default_base)"
fi

MERGE_BASE="$(git merge-base "$HEAD_REF" "$BASE_REF")"
WORKSPACE_BUILD_COMMAND="pnpm --filter @color-kit/core build && COLOR_KIT_SKIP_WASM_GENERATED=1 pnpm --filter @color-kit/core-wasm build && pnpm --filter @color-kit/react build && COLOR_KIT_SKIP_WASM_GENERATED=1 pnpm --filter color-kit build && pnpm --filter @color-kit/docs build"

changed_files=()
profiles=()
labels=()
commands=()

collect_files git diff --name-only "$MERGE_BASE...$HEAD_REF"

if [[ "$HEAD_REF" == "HEAD" ]]; then
  collect_files git diff --name-only
  collect_files git diff --name-only --cached
  collect_files git ls-files --others --exclude-standard
fi

docs_changed=0
core_changed=0
react_changed=0
wasm_changed=0
umbrella_changed=0
automation_changed=0
agents_changed=0
format_changed=0
workspace_changed=0
needs_wasm_matrix=0
needs_browser_smoke_hint=0

if [[ "${#changed_files[@]}" -eq 0 ]]; then
  add_profile "lint-only"
else
  for file in "${changed_files[@]}"; do
    case "$file" in
      apps/docs/*|vendor/sandpack/*)
        docs_changed=1
        format_changed=1
        needs_browser_smoke_hint=1
        ;;
      packages/core/*)
        core_changed=1
        format_changed=1
        ;;
      packages/react/*)
        react_changed=1
        needs_browser_smoke_hint=1
        format_changed=1
        ;;
      packages/core-wasm/*)
        wasm_changed=1
        format_changed=1
        ;;
      packages/color-kit/*)
        umbrella_changed=1
        format_changed=1
        ;;
      .cursor/skills/*|.cursor/rules/*|scripts/*|.github/workflows/*|.greptile/*|greptile.json)
        automation_changed=1
        format_changed=1
        ;;
      AGENTS.md|AGENTS.learnings.archive.md)
        agents_changed=1
        format_changed=1
        ;;
      package.json|pnpm-lock.yaml|pnpm-workspace.yaml)
        workspace_changed=1
        format_changed=1
        ;;
      *.md|*.mdx|*.json|*.yml|*.yaml|*.sh)
        format_changed=1
        ;;
    esac
  done
fi

format_command=""
if [[ "$format_changed" == "1" ]]; then
  format_command="$(build_prettier_check_command)"
fi

if [[ "$workspace_changed" == "1" ]]; then
  add_profile "workspace"
fi
if [[ "$automation_changed" == "1" ]]; then
  add_profile "automation"
fi
if [[ "$agents_changed" == "1" ]]; then
  add_profile "agent-memory"
fi
if [[ "$docs_changed" == "1" ]]; then
  add_profile "docs"
fi
if [[ "$core_changed" == "1" ]]; then
  add_profile "core"
fi
if [[ "$react_changed" == "1" ]]; then
  add_profile "react"
fi
if [[ "$wasm_changed" == "1" ]]; then
  add_profile "core-wasm"
fi
if [[ "$umbrella_changed" == "1" ]]; then
  add_profile "color-kit"
fi
if [[ -n "$format_command" ]]; then
  add_profile "format"
fi

if [[ "$core_changed" == "1" || "$react_changed" == "1" || "$wasm_changed" == "1" || "$umbrella_changed" == "1" ]]; then
  needs_wasm_matrix=1
fi

add_command "lint" "pnpm lint"

if [[ -n "$format_command" ]]; then
  add_command "format" "$format_command"
fi

if [[ "$agents_changed" == "1" ]]; then
  add_command "agent-learnings" "pnpm agents:check"
fi

if [[ "$workspace_changed" == "1" ]]; then
  add_command "preprod" "pnpm check:preprod"
  add_command "workspace-build" "$WORKSPACE_BUILD_COMMAND"
  add_command "workspace-test" "COLOR_KIT_SKIP_WASM_GENERATED=1 pnpm test"
fi

if [[ "$core_changed" == "1" && "$workspace_changed" == "0" ]]; then
  add_command "core-build" "pnpm --filter @color-kit/core build"
  add_command "core-test" "pnpm --filter @color-kit/core test"
fi

if [[ "$react_changed" == "1" && "$workspace_changed" == "0" ]]; then
  add_command "core-build-for-react" "pnpm --filter @color-kit/core build"
  add_command "react-build" "pnpm --filter @color-kit/react build"
  add_command "react-test" "pnpm --filter @color-kit/react test"
fi

if [[ "$wasm_changed" == "1" && "$workspace_changed" == "0" ]]; then
  add_command "core-build-for-wasm" "pnpm --filter @color-kit/core build"
  add_command "core-wasm-build" "pnpm --filter @color-kit/core-wasm build"
  add_command "core-wasm-test" "pnpm --filter @color-kit/core-wasm test"
fi

if [[ "$umbrella_changed" == "1" && "$workspace_changed" == "0" ]]; then
  add_command "color-kit-build" "COLOR_KIT_SKIP_WASM_GENERATED=1 pnpm --filter color-kit build"
  add_command "color-kit-test" "pnpm --filter color-kit test"
fi

if [[ "$docs_changed" == "1" && "$workspace_changed" == "0" ]]; then
  add_command "docs-build" "pnpm --filter @color-kit/docs build"
  add_command "docs-test" "pnpm --filter @color-kit/docs test"
fi

if [[ "$needs_wasm_matrix" == "1" ]]; then
  add_command "wasm-build" "pnpm ci:wasm"
  add_command "wasm-parity" "pnpm ci:wasm-parity"
fi

echo "Validation profile: ${profiles[*]}"
echo "Diff base: $BASE_REF"
echo "Merge base: $MERGE_BASE"
echo "Diff head: $HEAD_REF"
echo "Changed files: ${#changed_files[@]}"

if [[ "${#changed_files[@]}" -gt 0 ]]; then
  echo
  echo "Files in scope:"
  for file in "${changed_files[@]}"; do
    echo "- $file"
  done
fi

echo
echo "Command plan:"
for index in "${!commands[@]}"; do
  printf '%s. [%s] %s\n' "$((index + 1))" "${labels[$index]}" "${commands[$index]}"
done

if [[ "$needs_browser_smoke_hint" == "1" ]]; then
  echo
  echo "Browser smoke hint: changed files touch docs/UI surfaces; consider a quick browser-use regression pass after local validation."
fi

for index in "${!commands[@]}"; do
  run_command "${labels[$index]}" "${commands[$index]}"
done
