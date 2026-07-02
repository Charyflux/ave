#!/usr/bin/env bash
# AveBrowser — setup script
# Installs Go, Rust, Node.js/npm and all project dependencies
# Supports: Ubuntu/Debian, Arch, macOS (Homebrew)
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}${BOLD}[AVE]${NC} $*"; }
ok()    { echo -e "${GREEN}${BOLD}[OK]${NC}  $*"; }
err()   { echo -e "${RED}${BOLD}[ERR]${NC} $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${CYAN}${BOLD}"
cat <<'BANNER'
  ╔══════════════════════════════════════════╗
  ║  AveBrowser v2.0 — Setup                ║
  ║  Go + Rust + Node.js multi-lang stack   ║
  ╚══════════════════════════════════════════╝
BANNER
echo -e "${NC}"

# ─── OS detection ─────────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
info "Detected: $OS / $ARCH"

install_pkg() {
    if command -v apt-get &>/dev/null; then
        sudo apt-get install -y "$@"
    elif command -v pacman &>/dev/null; then
        sudo pacman -S --noconfirm "$@"
    elif command -v brew &>/dev/null; then
        brew install "$@"
    else
        err "Package manager not found. Install manually: $*"
    fi
}

# ─── Go ───────────────────────────────────────────────────────────────────────
if command -v go &>/dev/null && [[ "$(go version | grep -oP '1\.\K\d+')" -ge 21 ]]; then
    ok "Go $(go version | awk '{print $3}') already installed"
else
    info "Installing Go 1.22..."
    GO_VERSION="1.22.5"
    case "$OS/$ARCH" in
        Linux/x86_64)  GO_TAR="go${GO_VERSION}.linux-amd64.tar.gz" ;;
        Linux/aarch64) GO_TAR="go${GO_VERSION}.linux-arm64.tar.gz" ;;
        Darwin/x86_64) GO_TAR="go${GO_VERSION}.darwin-amd64.tar.gz" ;;
        Darwin/arm64)  GO_TAR="go${GO_VERSION}.darwin-arm64.tar.gz" ;;
        *) err "Unsupported platform: $OS/$ARCH" ;;
    esac
    curl -fsSL "https://go.dev/dl/$GO_TAR" -o "/tmp/$GO_TAR"
    sudo rm -rf /usr/local/go
    sudo tar -C /usr/local -xzf "/tmp/$GO_TAR"
    export PATH="$PATH:/usr/local/go/bin"
    echo 'export PATH=$PATH:/usr/local/go/bin' >> "$HOME/.bashrc" 2>/dev/null || true
    echo 'export PATH=$PATH:/usr/local/go/bin' >> "$HOME/.zshrc"  2>/dev/null || true
    ok "Go ${GO_VERSION} installed"
fi

# ─── Rust ─────────────────────────────────────────────────────────────────────
if command -v rustc &>/dev/null; then
    ok "Rust $(rustc --version) already installed"
else
    info "Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    source "$HOME/.cargo/env"
    ok "Rust installed"
fi
source "$HOME/.cargo/env" 2>/dev/null || true

# ─── Node.js / npm ───────────────────────────────────────────────────────────
if command -v node &>/dev/null && [[ "$(node -e 'process.stdout.write(process.version.slice(1).split(".")[0])')" -ge 18 ]]; then
    ok "Node.js $(node --version) already installed"
else
    info "Installing Node.js via nvm..."
    if ! command -v nvm &>/dev/null; then
        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        # shellcheck disable=SC1090
        [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    fi
    nvm install 20 && nvm use 20
    ok "Node.js $(node --version) installed"
fi

# ─── TOR (optional) ───────────────────────────────────────────────────────────
if command -v tor &>/dev/null; then
    ok "TOR already installed"
else
    info "Installing TOR (optional, skip with Ctrl+C)..."
    install_pkg tor || info "TOR install failed — skipping (not required)"
fi

# ─── Project dependencies ─────────────────────────────────────────────────────
info "Installing Node.js dependencies..."
cd "$ROOT"
npm install
ok "npm install complete"

info "Fetching Go dependencies..."
cd "$ROOT/proxy"
go mod tidy
ok "Go deps ready"

ok "Setup complete! Run './scripts/build.sh' to compile, then './scripts/run.sh' to launch."
