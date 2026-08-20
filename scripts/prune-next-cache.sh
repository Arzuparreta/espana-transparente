#!/usr/bin/env bash
# Keep the Next.js build cache from filling the VPS disk.
#
# `.next/cache` holds the webpack cache plus the App Router Data Cache, and the
# Data Cache grows without bound as the server caches fetch results at runtime.
# On 2026-08-20 it had reached 25 GB on a 193 GB disk shared with Postgres and
# the Supabase stack — clearing it returned ~15 GB. A full disk here takes down
# the database and the site together, so this trims the cache once it crosses a
# threshold rather than waiting for that.
#
# Deleting the cache only costs a slower next build; nothing durable lives here.
# Idempotent: safe to re-run.
set -euo pipefail

cache_dir="${NEXT_CACHE_DIR:-/root/Proyectos/espana-transparente/web/.next/cache}"
max_bytes="${NEXT_CACHE_MAX_BYTES:-5368709120}"  # 5 GiB

if [[ ! "$max_bytes" =~ ^[0-9]+$ ]]; then
  echo "NEXT_CACHE_MAX_BYTES must be an integer" >&2
  exit 2
fi

if [[ ! -d "$cache_dir" ]]; then
  echo "No Next.js cache at ${cache_dir}; nothing to prune."
  exit 0
fi

size_bytes="$(du -sb "$cache_dir" | cut -f1)"
printf 'Next.js cache: %s bytes (limit %s)\n' "$size_bytes" "$max_bytes"

if (( size_bytes <= max_bytes )); then
  echo "Under the limit; leaving it alone."
  exit 0
fi

# Drop the Data Cache first — it is the part that grows at runtime, and losing
# it only means the next render refetches. Keep the webpack/swc caches so
# rebuilds stay fast unless they are themselves the problem.
for sub in fetch-cache images; do
  if [[ -d "${cache_dir}/${sub}" ]]; then
    echo "Pruning ${sub}…"
    rm -rf "${cache_dir:?}/${sub}"
  fi
done

size_after="$(du -sb "$cache_dir" | cut -f1)"
if (( size_after > max_bytes )); then
  echo "Still over the limit; clearing the whole cache."
  rm -rf "${cache_dir:?}"
  size_after=0
fi

printf 'Next.js cache now: %s bytes\n' "$size_after"
