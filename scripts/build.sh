#!/usr/bin/env bash
# AveBrowser — build script
# Compiles Go proxy + Rust fuzzer and places binaries in bin/
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}${BOLD}[BUILD]${NC} $*"; }
ok()      { echo -e "${GREEN}${BOLD}[OK]${NC}   $*"; }
err()     { echo -e "${RED}${BOLD}[ERR]${NC}  $*" >&2; exit 1; }
warn()    { echo -e "${YELLOW}${BOLD}[WARN]${NC} $*"; }
step()    { echo -e "\n${BOLD}━━━ $* ━━━${NC}"; }
elapsed() { echo -e "${GREEN}Done in ${SECONDS}s${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN="$ROOT/bin"
SECONDS=0

mkdir -p "$BIN"

echo -e "${CYAN}${BOLD}"
cat <<'BANNER'
  ╔══════════════════════════════════════════╗
  ║  AveBrowser v2.0 — Build                ║
  ╚══════════════════════════════════════════╝
BANNER
echo -e "${NC}"

# ─── Go Proxy ─────────────────────────────────────────────────────────────────
step "Go MITM Proxy"
if ! command -v go &>/dev/null; then
    export PATH="$PATH:/usr/local/go/bin"
fi
if ! command -v go &>/dev/null; then
    err "Go not found. Run scripts/setup.sh first."
fi

info "Go version: $(go version)"
info "Building proxy binary..."
cd "$ROOT/proxy"
go mod tidy -e
CGO_ENABLED=0 go build -ldflags="-s -w -X main.version=2.0.0" -trimpath -o "$BIN/ave-proxy" .
ok "ave-proxy → $BIN/ave-proxy  ($(du -sh "$BIN/ave-proxy" | cut -f1))"

# ─── Rust Fuzzer ──────────────────────────────────────────────────────────────
step "Rust Fuzzer"
source "$HOME/.cargo/env" 2>/dev/null || true
if ! command -v cargo &>/dev/null; then
    warn "Rust/cargo not found — skipping fuzzer build (run scripts/setup.sh)"
else
    info "Rust version: $(rustc --version)"
    info "Building fuzzer (release mode)..."
    cd "$ROOT/fuzzer"
    cargo build --release 2>&1 | tail -5
    cp "$ROOT/fuzzer/target/release/avefuzz" "$BIN/avefuzz"
    ok "avefuzz → $BIN/avefuzz  ($(du -sh "$BIN/avefuzz" | cut -f1))"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
step "Build Summary"
echo ""
ls -lh "$BIN/" | grep -v '^total'
echo ""
elapsed
info "Launch: ./scripts/run.sh"
