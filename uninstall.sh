#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
if command -v readlink >/dev/null 2>&1; then
  RESOLVED="$(readlink -f "$SCRIPT_PATH" 2>/dev/null || true)"
  if [ -n "$RESOLVED" ]; then
    SCRIPT_PATH="$RESOLVED"
  fi
fi
cd "$(dirname "$SCRIPT_PATH")"

find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  for candidate in /usr/local/bin/node /usr/bin/node "$HOME/.nvm/current/bin/node" "$HOME/.local/share/fnm/aliases/default/bin/node" "$HOME/.volta/bin/node"; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

NODE_BIN="$(find_node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "[twfoxtetrio] No se encontro Node.js en este equipo."
  echo "Instala Node.js LTS (https://nodejs.org/) y vuelve a ejecutar bash uninstall.sh"
  exit 1
fi

TARGET_ASAR="$("$NODE_BIN" scripts/install.js --locate "$@")" || exit $?
TARGET_DIR="$(dirname "$TARGET_ASAR")"

if [ ! -w "$TARGET_DIR" ] || { [ -e "$TARGET_ASAR" ] && [ ! -w "$TARGET_ASAR" ]; }; then
  if [ "$(id -u)" -ne 0 ]; then
    echo "[twfoxtetrio] Permisos de administrador requeridos para desinstalar de:"
    echo "  $TARGET_ASAR"
    exec sudo "$NODE_BIN" scripts/install.js --uninstall "$@"
  fi
fi

exec "$NODE_BIN" scripts/install.js --uninstall "$@"
