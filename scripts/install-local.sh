#!/usr/bin/env bash
# Builds OPL Forge and installs/upgrades it as a local .deb package.
# If an existing installation is found, running instances are stopped
# first so dpkg can replace the files, then the new .deb replaces it in place.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PKG_NAME="opl-forge"
APP_DIR_NAME="OPL Forge"
SKIP_BUILD=false
LAUNCH_AFTER=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --launch) LAUNCH_AFTER=true ;;
    *)
      echo "Uso: $0 [--skip-build] [--launch]" >&2
      exit 1
      ;;
  esac
done

log() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }

if $SKIP_BUILD; then
  log "Pulando build (--skip-build), usando .deb já existente em release/"
else
  log "Buildando OPL Forge..."
  pnpm build
  npx electron-builder --linux deb
fi

DEB_PATH="$(find release -maxdepth 1 -name "${PKG_NAME}_*_amd64.deb" -printf '%T@ %p\n' \
  | sort -rn | head -n1 | cut -d' ' -f2-)"

if [ -z "$DEB_PATH" ]; then
  echo "Nenhum .deb encontrado em release/. Rode sem --skip-build primeiro." >&2
  exit 1
fi

NEW_VERSION="$(dpkg-deb -f "$DEB_PATH" Version)"
log "Pacote a instalar: $DEB_PATH (versão $NEW_VERSION)"

if dpkg -s "$PKG_NAME" >/dev/null 2>&1; then
  CURRENT_VERSION="$(dpkg-query -W -f='${Version}' "$PKG_NAME")"
  log "Instalação existente encontrada: versão $CURRENT_VERSION -> $NEW_VERSION"

  if pgrep -f "$APP_DIR_NAME/$PKG_NAME" >/dev/null 2>&1; then
    log "Encerrando instância em execução para liberar os arquivos..."
    pkill -f "$APP_DIR_NAME/$PKG_NAME" || true
    sleep 1
  fi
else
  log "Nenhuma instalação existente encontrada; será uma instalação nova."
fi

log "Instalando (pode pedir sua senha de sudo)..."
if ! sudo dpkg -i "$DEB_PATH"; then
  log "Resolvendo dependências pendentes..."
  sudo apt-get install -f -y
fi

INSTALLED_VERSION="$(dpkg-query -W -f='${Version}' "$PKG_NAME")"
log "OPL Forge $INSTALLED_VERSION instalado com sucesso."

if $LAUNCH_AFTER; then
  log "Abrindo OPL Forge..."
  nohup "$PKG_NAME" >/dev/null 2>&1 &
  disown
fi
