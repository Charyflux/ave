#!/usr/bin/env bash
# AveBrowser — launcher
# Starts the Go MITM proxy then launches the Electron browser
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info() { echo -e "${CYAN}${BOLD}[AVE]${NC} $*"; }
ok()   { echo -e "${GREEN}${BOLD}[OK]${NC}  $*"; }
err()  { echo -e "${RED}${BOLD}[ERR]${NC} $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN="$ROOT/bin"
PROXY="$BIN/ave-proxy"
PROXY_PORT="${AVE_PROXY_PORT:-7777}"
CONTROL_PORT="${AVE_CONTROL_PORT:-7778}"

# ─── Build if needed ──────────────────────────────────────────────────────────
if [[ ! -f "$PROXY" ]]; then
    info "Proxy binary not found — building first..."
    bash "$SCRIPT_DIR/build.sh"
fi

# ─── Kill old proxy if running ────────────────────────────────────────────────
if lsof -ti ":$PROXY_PORT" &>/dev/null; then
    info "Killing old proxy on :$PROXY_PORT"
    kill "$(lsof -ti ":$PROXY_PORT")" 2>/dev/null || true
    sleep 0.5
fi

# ─── Start Go proxy ───────────────────────────────────────────────────────────
info "Starting MITM proxy on :$PROXY_PORT  (control: :$CONTROL_PORT)"
AVE_PROXY_PORT="$PROXY_PORT" AVE_CONTROL_PORT="$CONTROL_PORT" \
    "$PROXY" &>"$ROOT/proxy.log" &
PROXY_PID=$!

# Wait for proxy to be ready
for i in $(seq 1 20); do
    if curl -sf "http://127.0.0.1:$CONTROL_PORT/api/stats" &>/dev/null; then
        ok "Proxy ready (PID $PROXY_PID)"
        break
    fi
    sleep 0.25
    if [[ $i -eq 20 ]]; then
        err "Proxy failed to start. Check proxy.log"
    fi
done

# ─── Cleanup on exit ─────────────────────────────────────────────────────────
cleanup() {
    info "Shutting down proxy (PID $PROXY_PID)..."
    kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ─── Launch Electron ─────────────────────────────────────────────────────────
info "Launching AveBrowser..."
cd "$ROOT"
export AVE_PROXY_PORT="$PROXY_PORT"
export AVE_CONTROL_PORT="$CONTROL_PORT"
npx electron . "$@"
