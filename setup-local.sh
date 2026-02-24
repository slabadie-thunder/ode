#!/usr/bin/env bash
# setup-local.sh — Install Ode locally from source (no install.sh / no remote download)
#
# This script:
#   1. Installs dependencies via Bun
#   2. Links the `ode` binary globally via `bun link`
#   3. Creates a .env file from .env.example if one doesn't exist yet
#   4. Prints next-step instructions
#
# Requirements: Bun >= 1.0 must already be installed.
#   Install Bun: https://bun.sh/docs/installation
#   Or:  curl -fsSL https://bun.sh/install | bash
#
# Usage:
#   chmod +x setup-local.sh
#   ./setup-local.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Ode local setup"
echo "    Repo: $REPO_DIR"
echo ""

# ── 1. Check Bun ──────────────────────────────────────────────────────────────
if ! command -v bun &>/dev/null; then
  echo "ERROR: Bun is not installed."
  echo "  Install it with: curl -fsSL https://bun.sh/install | bash"
  echo "  Then re-run this script."
  exit 1
fi

BUN_VERSION=$(bun --version)
echo "==> Bun $BUN_VERSION found"

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo ""
echo "==> Installing dependencies..."
cd "$REPO_DIR"
bun install

# ── 3. Register the global `ode` CLI via bun link ────────────────────────────
echo ""
echo "==> Linking 'ode' binary globally..."
bun link

echo "    'ode' is now available as a global command."
echo "    It points to: $REPO_DIR/packages/core/cli.ts"
echo "    Any changes you make to the source take effect immediately (no rebuild needed)."

# ── 4. Create .env if missing ─────────────────────────────────────────────────
echo ""
if [ ! -f "$REPO_DIR/.env" ]; then
  if [ -f "$REPO_DIR/.env.example" ]; then
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    echo "==> Created .env from .env.example"
    echo "    Edit $REPO_DIR/.env and fill in your Slack / Discord / Lark tokens."
  else
    echo "==> No .env.example found — skipping .env creation."
    echo "    Create $REPO_DIR/.env manually with your tokens."
  fi
else
  echo "==> .env already exists — skipping."
fi

# ── 5. Done ───────────────────────────────────────────────────────────────────
echo ""
echo "Setup complete. Next steps:"
echo ""
echo "  1. Edit .env (or run the onboarding wizard):"
echo "     ode onboard"
echo ""
echo "  2. Run Ode in production mode (foreground):"
echo "     bun run start"
echo "     # or, using the global binary:"
echo "     ode --foreground"
echo ""
echo "  3. Run Ode as a background daemon:"
echo "     ode"
echo "     # Check status:  ode status"
echo "     # Restart:       ode restart"
echo "     # Stop:          ode stop"
echo ""
echo "  4. Run in dev/watch mode (hot-reloads on file changes):"
echo "     bun run dev"
echo ""
echo "  Logs:   ~/.config/ode/daemon/ode.log"
echo "  Config: ~/.config/ode/ode.json"
