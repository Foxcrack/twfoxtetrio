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

install_node_hint() {
  echo "[twfoxtetrio] No se encontro Node.js en este equipo."
  echo "Node.js es necesario para ejecutar el instalador (sin dependencias externas)."
  if command -v pacman >/dev/null 2>&1; then
    echo "Instala Node.js ejecutando: sudo pacman -S nodejs"
  elif command -v apt-get >/dev/null 2>&1; then
    echo "Instala Node.js ejecutando: sudo apt-get update && sudo apt-get install -y nodejs"
  elif command -v dnf >/dev/null 2>&1; then
    echo "Instala Node.js ejecutando: sudo dnf install -y nodejs"
  elif command -v zypper >/dev/null 2>&1; then
    echo "Instala Node.js ejecutando: sudo zypper install -y nodejs"
  else
    echo "Descarga Node.js LTS desde: https://nodejs.org/"
  fi
}

NODE_BIN="$(find_node || true)"
if [ -z "$NODE_BIN" ]; then
  install_node_hint
  exit 1
fi

for arg in "$@"; do
  case "$arg" in
    -h|--help|-s|--status)
      exec "$NODE_BIN" scripts/install.js "$@"
      ;;
  esac
done

TARGET_ASAR="$("$NODE_BIN" scripts/install.js --locate "$@")" || exit $?
TARGET_DIR="$(dirname "$TARGET_ASAR")"

if [ ! -w "$TARGET_DIR" ] || { [ -e "$TARGET_ASAR" ] && [ ! -w "$TARGET_ASAR" ]; }; then
  if [ "$(id -u)" -ne 0 ]; then
    echo "[twfoxtetrio] Permisos de administrador requeridos para modificar:"
    echo "  $TARGET_ASAR"
    exec sudo "$NODE_BIN" scripts/install.js "$@"
  fi
fi

exec "$NODE_BIN" scripts/install.js "$@"
