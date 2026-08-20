#!/usr/bin/env bash
# Provision swap on the VPS so a memory spike degrades instead of killing.
#
# The box has 11 GB of RAM shared by Postgres, the Next.js server and the
# GitHub Actions runner, and originally had no swap at all. On 2026-08-20 the
# OCR pipeline peaked at ~7 GB and the global OOM killer took down the runner
# service mid-batch, truncating the daily ETL run. Swap gives the kernel
# somewhere to spill to first; the low swappiness keeps it out of the hot path
# during normal operation.
#
# Idempotent: safe to re-run.
set -euo pipefail

SWAPFILE=/swapfile
SWAPSIZE_GB=8

if swapon --show --noheadings | grep -q .; then
  echo "swap already active:"
  swapon --show
else
  if [ ! -f "$SWAPFILE" ]; then
    echo "creating ${SWAPSIZE_GB}G swapfile at ${SWAPFILE}…"
    fallocate -l "${SWAPSIZE_GB}G" "$SWAPFILE"
    chmod 600 "$SWAPFILE"
    mkswap "$SWAPFILE"
  fi
  swapon "$SWAPFILE"
  echo "swap enabled."
fi

if ! grep -q "^${SWAPFILE}[[:space:]]" /etc/fstab; then
  echo "${SWAPFILE} none swap sw 0 0" >> /etc/fstab
  echo "added ${SWAPFILE} to /etc/fstab"
fi

# Prefer reclaiming page cache over swapping; swap is the safety net, not the
# steady state.
sysctl -w vm.swappiness=10 >/dev/null
printf 'vm.swappiness=10\n' > /etc/sysctl.d/99-espana-transparente-swap.conf

free -h
