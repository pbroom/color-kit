#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Install the Codex AGENTS.md template into another repository.

Usage:
  scripts/install-codex-agents.sh <target-repo-path> [--force]

Options:
  --force   Overwrite an existing AGENTS.md (a timestamped backup is created first)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

TARGET_REPO="$1"
FORCE="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_PATH="${SCRIPT_DIR}/../AGENTS.template.md"
TARGET_FILE="${TARGET_REPO%/}/AGENTS.md"

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Template not found: $TEMPLATE_PATH" >&2
  exit 1
fi

if [[ ! -d "$TARGET_REPO" ]]; then
  echo "Target directory not found: $TARGET_REPO" >&2
  exit 1
fi

if [[ -e "$TARGET_FILE" && "$FORCE" != "--force" ]]; then
  echo "AGENTS.md already exists at: $TARGET_FILE"
  echo "Re-run with --force to overwrite (a backup will be created)."
  exit 0
fi

if [[ -e "$TARGET_FILE" && "$FORCE" == "--force" ]]; then
  BACKUP_PATH="${TARGET_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$TARGET_FILE" "$BACKUP_PATH"
  echo "Backup created: $BACKUP_PATH"
fi

cp "$TEMPLATE_PATH" "$TARGET_FILE"
echo "Installed template: $TARGET_FILE"
