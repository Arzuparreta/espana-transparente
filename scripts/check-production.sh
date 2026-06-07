#!/usr/bin/env bash
# Production health probe — distinguishes "DB outage" from "code bug".
#
# Checks, in order, the layers behind the live site:
#   1. Cloudflare edge        (DNS + CDN reachable)
#   2. App /api/health        (Next.js → DB liveness as the app sees it)
#   3. Supabase REST          (PostgREST → Postgres, trivial select)
#   4. Supabase Auth          (GoTrue → Postgres)
#   5. Postgres pooler :5432  (direct connection, if DATABASE_URL + psql present)
#
# A green edge + red REST/Auth/pooler == the database is down or paused, NOT a
# code bug. That is exactly the state that makes CI's "Deployment health" and
# "Data health" jobs fail while Vercel still serves the frontend.
#
# Usage:
#   ./scripts/check-production.sh
#   PRODUCTION_URL=https://… ./scripts/check-production.sh
#
# Env (auto-loaded from web/.env.local and etl/.env when present):
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  (public, required)
#   DATABASE_URL                                             (optional pooler probe)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRODUCTION_URL="${PRODUCTION_URL:-https://xn--espaatransparente-ixb.site}"

# Load public env without clobbering anything already exported.
load_env() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line; do
    line="${line%%$'\r'}"
    [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
    local k="${line%%=*}" v="${line#*=}"
    v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
    [[ -z "${!k:-}" ]] && export "$k=$v"
  done < "$file"
}
load_env "$ROOT/web/.env.local"
load_env "$ROOT/etl/.env"

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

pass=0; fail=0
ok()   { printf '  \033[32mPASS\033[0m  %-22s %s\n' "$1" "$2"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %-22s %s\n' "$1" "$2"; fail=$((fail+1)); }
note() { printf '  \033[33mSKIP\033[0m  %-22s %s\n' "$1" "$2"; }

echo "Production health — $PRODUCTION_URL"
echo "Supabase         — ${SUPABASE_URL:-<unset>}"
echo

# 1. Cloudflare edge: any fast HTTP response (even 404) means DNS+CDN are up.
read -r code t < <(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 15 "$PRODUCTION_URL/" || echo "000 0")
if [[ "$code" != "000" ]]; then ok "edge (Cloudflare)" "HTTP $code in ${t}s"
else bad "edge (Cloudflare)" "no response — DNS/CDN problem, not the DB"; fi

# 2. App health endpoint.
read -r code t < <(curl -s -o /tmp/_health.$$ -w '%{http_code} %{time_total}' --max-time 30 "$PRODUCTION_URL/api/health" || echo "000 0")
body="$(tr -d '\n' < /tmp/_health.$$ 2>/dev/null | cut -c1-120)"; rm -f /tmp/_health.$$
if [[ "$code" == "200" ]]; then ok "app /api/health" "HTTP 200 in ${t}s — $body"
else bad "app /api/health" "HTTP $code in ${t}s — $body"; fi

# 3 & 4 need the public Supabase URL + anon key.
if [[ -n "$SUPABASE_URL" && -n "$ANON_KEY" ]]; then
  read -r code t < <(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 25 \
    "$SUPABASE_URL/rest/v1/search_documents?select=entity_type&limit=1" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" || echo "000 0")
  if [[ "$code" == "200" ]]; then ok "Supabase REST" "HTTP 200 in ${t}s"
  elif [[ "$code" == "522" || "$code" == "000" ]]; then bad "Supabase REST" "HTTP $code in ${t}s — Postgres unreachable (paused / out of resources)"
  else bad "Supabase REST" "HTTP $code in ${t}s"; fi

  read -r code t < <(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 20 \
    "$SUPABASE_URL/auth/v1/health" -H "apikey: $ANON_KEY" || echo "000 0")
  if [[ "$code" == "200" ]]; then ok "Supabase Auth" "HTTP 200 in ${t}s"
  else bad "Supabase Auth" "HTTP $code in ${t}s — GoTrue cannot reach Postgres"; fi
else
  note "Supabase REST/Auth" "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY not set"
fi

# 5. Direct pooler connection (optional, needs DATABASE_URL + psql).
if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  if out="$(PGCONNECT_TIMEOUT=8 psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 \
        -c "SET statement_timeout='5s'; SELECT (SELECT count(*) FROM pg_stat_activity) || ' conns, ' || pg_size_pretty(pg_database_size(current_database())) || ' db';" 2>&1)"; then
    ok "Postgres pooler :5432" "$out"
  else
    bad "Postgres pooler :5432" "$(echo "$out" | head -1 | cut -c1-90)"
  fi
else
  note "Postgres pooler :5432" "DATABASE_URL or psql unavailable"
fi

echo
if [[ $fail -eq 0 ]]; then
  echo "✅ Production healthy ($pass checks passed)."
  exit 0
fi
echo "❌ $fail check(s) failed."
echo "   Edge up + DB checks down  → Supabase project is paused / out of resources."
echo "   Fix on the Supabase dashboard (project ${SUPABASE_URL##*//}); this is not a repo bug."
exit 1
