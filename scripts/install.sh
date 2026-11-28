#!/usr/bin/env bash
# ==============================================================================
# My Music - Universal Linux Installer & Updater
# Compatible with Arch, Debian, Ubuntu, Fedora, openSUSE, RHEL, Void, Manjaro
#
# Install / Update online:
#   curl -fsSL https://raw.githubusercontent.com/Induwara-Hansajith/mymusic/main/scripts/install.sh | bash
#
# Check for updates only:
#   mymusic --update-check
#
# Update from command line:
#   mymusic --update
#
# Install from local archive:
#   ./install.sh /path/to/My.Music.1.1.9.tar.gz
#
# Uninstall:
#   ./install.sh --uninstall
# ==============================================================================

set -e

REPO="Induwara-Hansajith/mymusic"
APP_NAME="mymusic"
APP_DISPLAY_NAME="My Music"
FALLBACK_VERSION="1.1.9"

# Terminal formatting
if [ -t 1 ]; then
  BOLD="\033[1m"
  GREEN="\033[32m"
  BLUE="\033[34m"
  YELLOW="\033[33m"
  RED="\033[31m"
  RESET="\033[0m"
else
  BOLD=""
  GREEN=""
  BLUE=""
  YELLOW=""
  RED=""
  RESET=""
fi

log_info() {
  printf "${BLUE}[info]${RESET} %s\n" "$1"
}

log_success() {
  printf "${GREEN}[ok]${RESET} ${BOLD}%s${RESET}\n" "$1"
}

log_warn() {
  printf "${YELLOW}[warn]${RESET} %s\n" "$1"
}

log_error() {
  printf "${RED}[error]${RESET} %s\n" "$1" >&2
}

# Determine install directories (user-level: safe, no sudo required)
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
INSTALL_DIR="${XDG_DATA_HOME}/mymusic"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${XDG_DATA_HOME}/applications"
ICON_DIR="${XDG_DATA_HOME}/icons/hicolor/512x512/apps"

# ------------------------------------------------------------------------------
# Uninstall action
# ------------------------------------------------------------------------------
if [ "$1" = "--uninstall" ] || [ "$1" = "-u" ]; then
  printf "${BOLD}Uninstalling %s...${RESET}\n" "${APP_DISPLAY_NAME}"
  rm -rf "${INSTALL_DIR}"
  rm -f "${BIN_DIR}/mymusic"
  rm -f "${DESKTOP_DIR}/mymusic.desktop"
  rm -f "${ICON_DIR}/mymusic.png"

  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "${DESKTOP_DIR}" 2>/dev/null || true
  fi
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f "${XDG_DATA_HOME}/icons/hicolor" 2>/dev/null || true
  fi

  log_success "My Music has been removed from your system."
  echo "Note: Your user music library cache and playlists in ~/.config/mymusic remain preserved."
  exit 0
fi

# ------------------------------------------------------------------------------
# Check essential commands
# ------------------------------------------------------------------------------
for cmd in curl tar gzip; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Missing required command '$cmd'. Please install it using your package manager."
    exit 1
  fi
done

# ------------------------------------------------------------------------------
# Detect installed version
# ------------------------------------------------------------------------------
INSTALLED_VERSION=""
if [ -f "${INSTALL_DIR}/version.txt" ]; then
  INSTALLED_VERSION="$(cat "${INSTALL_DIR}/version.txt" | tr -d '[:space:]')"
fi

# ------------------------------------------------------------------------------
# Parse arguments (local tarball, --force, --check)
# ------------------------------------------------------------------------------
LOCAL_TAR=""
FORCE_INSTALL="false"
CHECK_ONLY="false"

for arg in "$@"; do
  case "$arg" in
    --force|-f)
      FORCE_INSTALL="true"
      ;;
    --check|-c)
      CHECK_ONLY="true"
      ;;
    *.tar.gz)
      if [ -f "$arg" ]; then
        LOCAL_TAR="$(cd "$(dirname "$arg")" && pwd)/$(basename "$arg")"
      fi
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
LOCAL_SOURCE=""
if [ -z "${LOCAL_TAR}" ] && [ -n "${SCRIPT_DIR}" ] && [ -f "${SCRIPT_DIR}/mymusic" ] && [ -f "${SCRIPT_DIR}/resources/app.asar" ]; then
  LOCAL_SOURCE="${SCRIPT_DIR}"
fi

TMP_DIR=""
cleanup() {
  if [ -n "${TMP_DIR}" ] && [ -d "${TMP_DIR}" ]; then
    rm -rf "${TMP_DIR}"
  fi
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# Source resolution (Local TAR, Extracted folder, or GitHub download)
# ------------------------------------------------------------------------------
if [ -n "${LOCAL_TAR}" ]; then
  log_info "Installing from local package archive: ${LOCAL_TAR}"
  TARGET_VERSION="$(echo "${LOCAL_TAR}" | sed -n 's/.*My\.Music\.\([0-9][0-9.]*\)\.tar\.gz/\1/p')"
  TARGET_VERSION="${TARGET_VERSION:-$FALLBACK_VERSION}"

  TMP_DIR="$(mktemp -d -t mymusic-install-XXXXXX)"
  tar -xzf "${LOCAL_TAR}" -C "${TMP_DIR}"
  SRC_APP_DIR="$(find "${TMP_DIR}" -type f -name "mymusic" -exec dirname {} \; | head -n 1)"

elif [ -n "${LOCAL_SOURCE}" ]; then
  TARGET_VERSION="${FALLBACK_VERSION}"
  log_info "Installing from current directory: ${LOCAL_SOURCE}"
  SRC_APP_DIR="${LOCAL_SOURCE}"

else
  log_info "Checking latest release of ${APP_DISPLAY_NAME} on GitHub..."

  RELEASE_JSON="$(curl -fsSL -H "User-Agent: MyMusic-Installer" "https://api.github.com/repos/${REPO}/releases" 2>/dev/null || echo "")"
  
  DOWNLOAD_URL=""
  TARGET_VERSION=""

  if [ -n "${RELEASE_JSON}" ]; then
    DOWNLOAD_URL="$(echo "${RELEASE_JSON}" | grep -o 'https://github.com/[^"]*My\.Music\.[^"]*\.tar\.gz' | head -n 1 || true)"
    if [ -n "${DOWNLOAD_URL}" ]; then
      TARGET_VERSION="$(echo "${DOWNLOAD_URL}" | sed -n 's/.*My\.Music\.\([0-9][0-9.]*\)\.tar\.gz/\1/p')"
    fi
  fi

  if [ -z "${DOWNLOAD_URL}" ]; then
    log_warn "Could not query GitHub releases API directly (possible rate limit). Using fallback version v${FALLBACK_VERSION}."
    TARGET_VERSION="${FALLBACK_VERSION}"
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/my_music_V9/My.Music.${FALLBACK_VERSION}.tar.gz"
  fi

  if [ "${CHECK_ONLY}" = "true" ]; then
    echo "Installed version: ${INSTALLED_VERSION:-none}"
    echo "Latest version:    ${TARGET_VERSION}"
    if [ "${INSTALLED_VERSION}" = "${TARGET_VERSION}" ]; then
      log_success "My Music is up to date."
    else
      log_info "A new version (${TARGET_VERSION}) is available to install."
    fi
    exit 0
  fi

  if [ -n "${INSTALLED_VERSION}" ]; then
    log_info "Currently installed: v${INSTALLED_VERSION}"
    log_info "Latest available:    v${TARGET_VERSION}"

    if [ "${INSTALLED_VERSION}" = "${TARGET_VERSION}" ] && [ "${FORCE_INSTALL}" != "true" ]; then
      log_success "My Music is already at the latest version (${INSTALLED_VERSION})."
      echo "To reinstall or repair, run: $0 --force"
      exit 0
    fi
    log_info "Updating My Music to v${TARGET_VERSION}..."
  else
    log_info "Installing My Music v${TARGET_VERSION}..."
  fi

  TMP_DIR="$(mktemp -d -t mymusic-install-XXXXXX)"
  TAR_FILE="${TMP_DIR}/My.Music.${TARGET_VERSION}.tar.gz"

  log_info "Downloading ${DOWNLOAD_URL}..."
  curl -# -fSL "${DOWNLOAD_URL}" -o "${TAR_FILE}"

  log_info "Extracting package..."
  tar -xzf "${TAR_FILE}" -C "${TMP_DIR}"

  SRC_APP_DIR="$(find "${TMP_DIR}" -type f -name "mymusic" -exec dirname {} \; | head -n 1)"
fi

if [ -z "${SRC_APP_DIR}" ] || [ ! -f "${SRC_APP_DIR}/mymusic" ]; then
  log_error "Failed to locate extracted application executable."
  exit 1
fi

# ------------------------------------------------------------------------------
# Deploy files into ~/.local/share/mymusic
# ------------------------------------------------------------------------------
log_info "Deploying application to ${INSTALL_DIR}..."

# If My Music is running, terminate it cleanly so binary isn't busy
if pgrep -x "mymusic" >/dev/null 2>&1; then
  log_warn "My Music is currently running. Stopping it to complete installation..."
  pkill -x "mymusic" 2>/dev/null || true
  sleep 1
fi

mkdir -p "${INSTALL_DIR}"
mkdir -p "${BIN_DIR}"
mkdir -p "${DESKTOP_DIR}"
mkdir -p "${ICON_DIR}"

# Synchronize files cleanly
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "${SRC_APP_DIR}/" "${INSTALL_DIR}/"
else
  rm -rf "${INSTALL_DIR}/locales" "${INSTALL_DIR}/resources" "${INSTALL_DIR}"/*.so* 2>/dev/null || true
  cp -a "${SRC_APP_DIR}/." "${INSTALL_DIR}/"
fi

# Write version file
echo "${TARGET_VERSION}" > "${INSTALL_DIR}/version.txt"

# Permissions
chmod +x "${INSTALL_DIR}/mymusic" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/chrome-sandbox" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/chrome_crashpad_handler" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/resources/bin/yt-dlp" 2>/dev/null || true

# Copy this script into installation dir as update.sh
SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"
if [ -f "${SCRIPT_SELF}" ]; then
  cp -f "${SCRIPT_SELF}" "${INSTALL_DIR}/update.sh" 2>/dev/null || true
  chmod +x "${INSTALL_DIR}/update.sh" 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# Create CLI executable wrapper in ~/.local/bin/mymusic
# ------------------------------------------------------------------------------
cat <<'EOF' > "${BIN_DIR}/mymusic"
#!/usr/bin/env bash
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/mymusic"
if [ "$1" = "--update" ] || [ "$1" = "-u" ]; then
  if [ -x "${APP_DIR}/update.sh" ]; then
    exec "${APP_DIR}/update.sh" "${@:2}"
  else
    curl -fsSL https://raw.githubusercontent.com/Induwara-Hansajith/mymusic/main/scripts/install.sh | bash
    exit $?
  fi
fi
if [ "$1" = "--update-check" ]; then
  if [ -x "${APP_DIR}/update.sh" ]; then
    exec "${APP_DIR}/update.sh" --check
  fi
fi
exec "${APP_DIR}/mymusic" "$@"
EOF
chmod +x "${BIN_DIR}/mymusic"

# ------------------------------------------------------------------------------
# Install Application Icon
# ------------------------------------------------------------------------------
if [ -f "${INSTALL_DIR}/mymusic.png" ]; then
  cp -f "${INSTALL_DIR}/mymusic.png" "${ICON_DIR}/mymusic.png"
elif [ -f "${INSTALL_DIR}/resources/icon.png" ]; then
  cp -f "${INSTALL_DIR}/resources/icon.png" "${ICON_DIR}/mymusic.png"
fi

# ------------------------------------------------------------------------------
# Install FreeDesktop .desktop launcher
# ------------------------------------------------------------------------------
cat <<EOF > "${DESKTOP_DIR}/mymusic.desktop"
[Desktop Entry]
Name=My Music
GenericName=Music Player
Comment=Modern, lightweight local music player
Exec="${BIN_DIR}/mymusic" %U
Icon=mymusic
Terminal=false
Type=Application
StartupNotify=true
Categories=AudioVideo;Audio;Player;Music;
MimeType=audio/mpeg;audio/flac;audio/ogg;audio/wav;audio/x-wav;audio/aac;audio/mp4;audio/x-m4a;audio/webm;
StartupWMClass=mymusic
Actions=Update;

[Desktop Action Update]
Name=Check for Updates
Exec="${BIN_DIR}/mymusic" --update
EOF
chmod +x "${DESKTOP_DIR}/mymusic.desktop" 2>/dev/null || true

# ------------------------------------------------------------------------------
# Refresh desktop and icon database caches
# ------------------------------------------------------------------------------
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${DESKTOP_DIR}" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q -t -f "${XDG_DATA_HOME}/icons/hicolor" 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# Check PATH for ~/.local/bin
# ------------------------------------------------------------------------------
PATH_WARNING=""
case ":${PATH}:" in
  *:"${BIN_DIR}":*) ;;
  *)
    PATH_WARNING="true"
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
      if [ -f "$rc" ] && ! grep -q '\.local/bin' "$rc"; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$rc"
      fi
    done
    ;;
esac

echo ""
log_success "${APP_DISPLAY_NAME} v${TARGET_VERSION} successfully installed!"
echo ""
echo "  Run via terminal:     mymusic"
echo "  Check for updates:    mymusic --update"
echo "  Desktop launcher:     Available in your Applications menu"
echo "  Uninstall anytime:    ${INSTALL_DIR}/update.sh --uninstall"
echo ""

if [ -n "${PATH_WARNING}" ]; then
  log_warn "${BIN_DIR} was added to your shell profile (~/.bashrc / ~/.zshrc)."
  log_warn "Restart your terminal or run: export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
