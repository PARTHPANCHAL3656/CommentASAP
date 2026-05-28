#!/usr/bin/env bash
# scripts/download-wasm-grammars.sh
# Download prebuilt Tree-sitter WASM grammars needed for comment removal.
# Run once during project setup: bash scripts/download-wasm-grammars.sh

set -e

WASM_DIR="./wasm"
mkdir -p "$WASM_DIR"

# Base URL for prebuilt WASM files from the tree-sitter org
BASE="https://github.com/nicolo-ribaudo/tree-sitter-grammars/releases/download/v1.0"

# You may also build these from source using:
#   npx tree-sitter build-wasm node_modules/tree-sitter-<lang>
# after installing the grammar packages.

declare -A GRAMMARS=(
  ["javascript"]="tree-sitter-javascript.wasm"
  ["typescript"]="tree-sitter-typescript.wasm"
  ["python"]="tree-sitter-python.wasm"
  ["java"]="tree-sitter-java.wasm"
  ["cpp"]="tree-sitter-cpp.wasm"
  ["c"]="tree-sitter-c.wasm"
)

echo "[commentasap] Downloading Tree-sitter WASM grammars..."

for LANG in "${!GRAMMARS[@]}"; do
  FILE="${GRAMMARS[$LANG]}"
  TARGET="$WASM_DIR/$FILE"
  if [ -f "$TARGET" ]; then
    echo "  [skip] $FILE already exists"
    continue
  fi
  echo "  [download] $FILE"
  # Try building from npm package first (requires tree-sitter CLI)
  if command -v tree-sitter &>/dev/null; then
    PKG="node_modules/tree-sitter-${LANG}"
    if [ -d "$PKG" ]; then
      npx tree-sitter build-wasm "$PKG" --output "$TARGET" 2>/dev/null && continue
    fi
  fi
  echo "  [warn] Could not build $FILE. Install tree-sitter-${LANG} and run: npx tree-sitter build-wasm node_modules/tree-sitter-${LANG}"
done

echo "[commentasap] WASM setup complete. Files in ./wasm/"
