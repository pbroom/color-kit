#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUST_DIR="${PACKAGE_DIR}/rust"
OUT_DIR="${PACKAGE_DIR}/dist/generated"

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "wasm-pack is required to build @color-kit/core-wasm."
  echo "Install: https://rustwasm.github.io/wasm-pack/installer/"
  exit 1
fi

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"
wasm-pack build "${RUST_DIR}" --target web --out-dir "${OUT_DIR}"

echo "WASM artifacts generated at ${OUT_DIR}"
