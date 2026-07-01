#!/usr/bin/env bash
#
# Canonical production deploy for the España Transparente web app.
# Resets the checkout to origin/main, rebuilds, and restarts PM2.
#
# Used by:
#   - CI: .github/workflows/ci.yml -> deploy-web (runs this detached over SSH)
#   - Manual: ssh <vps> 'bash /root/Proyectos/espana-transparente/scripts/deploy-vps.sh'
#
# set -e ensures a non-zero exit on any failure so callers (CI marker / operator)
# see the real result.
set -euo pipefail

REPO="${ET_REPO:-/root/Proyectos/espana-transparente}"
cd "$REPO"

echo "[deploy] fetching origin/main…"
git fetch origin main
git reset --hard origin/main
echo "[deploy] now at $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

cd web
echo "[deploy] npm ci…"
npm ci
echo "[deploy] next build…"
npm run build
echo "[deploy] restarting PM2 process…"
pm2 restart espana-transparente-web
echo "[deploy] done."
