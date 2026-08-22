#!/usr/bin/env bash
# Fetch the Kohesio payload from a machine that can reach the EC, and hand it
# to the VPS.
#
# Why this exists: kohesio.ec.europa.eu 403s datacenter networks, so neither the
# VPS runner nor GitHub's runners can fetch it (verified 2026-08-20). The same
# requests succeed from a residential connection. Switching to a source the VPS
# *can* reach was investigated and rejected: cohesiondata's Spanish rows carry no
# beneficiary at all, and its beneficiary dataset pseudonymises the names — see
# CLAUDE.md. So the fetch runs here and the result is pushed over Tailscale.
#
# The payload carries a fetched_at stamp; the ingest refuses anything older than
# its --payload-max-age-days, so if this stops running the weekly ETL fails
# loudly instead of re-ingesting frozen data.
#
# Idempotent: safe to re-run. Intended to be driven by a timer.
set -euo pipefail

REPO="${ET_REPO:-/mnt/storage/Git-projects-storage/espana-transparente}"
VPS="${ET_VPS:-root@spaintransparencia.info}"
REMOTE_PATH="${ET_KOHESIO_REMOTE:-/root/kohesio-beneficiaries.json}"
PYTHON="${ET_PYTHON:-python3}"

tmp="$(mktemp -t kohesio-payload-XXXXXX.json)"
trap 'rm -f "$tmp"' EXIT

cd "$REPO/etl"
echo "[kohesio] fetching…"
PYTHONPATH=src "$PYTHON" -m src.kohesio.fondos_ue --fetch-only "$tmp"

# Only replace the remote copy once we have a payload worth replacing it with.
count="$("$PYTHON" -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["list"]))' "$tmp")"
if [ "$count" -lt 1000 ]; then
  echo "[kohesio] only ${count} records — refusing to overwrite the VPS copy" >&2
  exit 1
fi

echo "[kohesio] pushing ${count} records to ${VPS}:${REMOTE_PATH}"
scp -q -o BatchMode=yes "$tmp" "${VPS}:${REMOTE_PATH}.tmp"
ssh -o BatchMode=yes "$VPS" "mv ${REMOTE_PATH}.tmp ${REMOTE_PATH}"
echo "[kohesio] done."
