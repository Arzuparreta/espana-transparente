#!/usr/bin/env bash
set -euo pipefail

container="${SUPABASE_DB_CONTAINER:-supabase_db_espana-transparente}"
database="${SUPABASE_ANALYTICS_DB:-_supabase}"
schema="${SUPABASE_ANALYTICS_SCHEMA:-_analytics}"
max_bytes="${SUPABASE_ANALYTICS_LOG_MAX_BYTES:-1073741824}"
keep_rows="${SUPABASE_ANALYTICS_KEEP_RECENT_ROWS:-50000}"

if [[ ! "$schema" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "Invalid schema name: $schema" >&2
  exit 2
fi

if [[ ! "$max_bytes" =~ ^[0-9]+$ || ! "$keep_rows" =~ ^[0-9]+$ ]]; then
  echo "SUPABASE_ANALYTICS_LOG_MAX_BYTES and SUPABASE_ANALYTICS_KEEP_RECENT_ROWS must be integers" >&2
  exit 2
fi

psql() {
  docker exec "$container" psql -U postgres -d "$database" -Atq "$@"
}

log_size_bytes() {
  psql -c "
    SELECT COALESCE(SUM(pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass)), 0)
    FROM pg_stat_all_tables
    WHERE schemaname = '$schema'
      AND relname LIKE 'log_events_%';
  " | tr -d '[:space:]'
}

prune_with_keep_rows() {
  local rows_to_keep="$1"

  docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE
  r record;
  rows_to_keep integer := $rows_to_keep;
  target_schema text := '$schema';
BEGIN
  FOR r IN
    SELECT schemaname, relname
    FROM pg_stat_all_tables
    WHERE schemaname = target_schema
      AND relname LIKE 'log_events_%'
    ORDER BY pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass) DESC
  LOOP
    IF rows_to_keep <= 0 THEN
      EXECUTE format('TRUNCATE TABLE %I.%I', r.schemaname, r.relname);
    ELSE
      EXECUTE format(
        'CREATE TEMP TABLE tmp_keep_log_events ON COMMIT DROP AS SELECT * FROM %I.%I ORDER BY timestamp DESC LIMIT %s',
        r.schemaname,
        r.relname,
        rows_to_keep
      );
      EXECUTE format('TRUNCATE TABLE %I.%I', r.schemaname, r.relname);
      EXECUTE format(
        'INSERT INTO %I.%I SELECT * FROM tmp_keep_log_events ORDER BY timestamp',
        r.schemaname,
        r.relname
      );
      DROP TABLE tmp_keep_log_events;
      EXECUTE format('ANALYZE %I.%I', r.schemaname, r.relname);
    END IF;
  END LOOP;
END
\$\$;
"
}

if ! docker inspect "$container" >/dev/null 2>&1; then
  echo "Container $container does not exist; skipping analytics log prune"
  exit 0
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "$container")" != "true" ]]; then
  echo "Container $container is not running; skipping analytics log prune"
  exit 0
fi

before="$(log_size_bytes)"
if (( before <= max_bytes )); then
  echo "Supabase analytics logs are below cap: ${before}/${max_bytes} bytes"
  exit 0
fi

echo "Supabase analytics logs exceed cap: ${before}/${max_bytes} bytes"

current_keep_rows="$keep_rows"
while :; do
  echo "Pruning analytics logs, keeping up to ${current_keep_rows} newest rows per log table"
  prune_with_keep_rows "$current_keep_rows"

  after="$(log_size_bytes)"
  echo "Supabase analytics logs after prune: ${after}/${max_bytes} bytes"

  if (( after <= max_bytes || current_keep_rows == 0 )); then
    break
  fi

  current_keep_rows=$(( current_keep_rows / 2 ))
  if (( current_keep_rows < 1000 )); then
    current_keep_rows=0
  fi
done
