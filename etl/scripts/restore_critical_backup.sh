#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AUTH_BACKUP_ENCRYPTION_PASSPHRASE:?AUTH_BACKUP_ENCRYPTION_PASSPHRASE is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backup_file="${1:?Usage: restore_critical_backup.sh BACKUP_FILE [--apply]}"
mode="${2:---dry-run}"
storage_container="${SUPABASE_STORAGE_CONTAINER:-supabase_storage_espana-transparente}"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "$backup_file" \
  -out "$tmp_dir/critical-data.tar.gz" \
  -pass "env:AUTH_BACKUP_ENCRYPTION_PASSPHRASE"
tar -xzf "$tmp_dir/critical-data.tar.gz" -C "$tmp_dir"

(
  cd "$tmp_dir"
  sha256sum --check SHA256SUMS
)
pg_restore --list "$tmp_dir/critical-data.dump" >/dev/null
python "$script_dir/critical_backup_state.py" restore "$tmp_dir/critical-review-state.json"

if [[ "$mode" != "--apply" ]]; then
  echo "Critical backup dry-run passed. No data changed."
  exit 0
fi

if [[ "${RESTORE_CRITICAL_CONFIRMATION:-}" != "RESTORE_CRITICAL" ]]; then
  echo "RESTORE_CRITICAL_CONFIRMATION must equal RESTORE_CRITICAL" >&2
  exit 2
fi

psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  relation record;
BEGIN
  FOR relation IN
    SELECT format('%I.%I', schemaname, tablename) AS qualified_name
    FROM pg_tables
    WHERE schemaname = 'auth'
  LOOP
    EXECUTE 'TRUNCATE TABLE ' || relation.qualified_name || ' CASCADE';
  END LOOP;
END
$$;

TRUNCATE TABLE
  public.annotations,
  public.user_profile_settings,
  public.user_profiles,
  storage.objects,
  storage.buckets
CASCADE;
SQL

pg_restore \
  --data-only \
  --disable-triggers \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  "$tmp_dir/critical-data.dump"

docker inspect "$storage_container" >/dev/null
docker exec "$storage_container" rm -rf /mnt/stub/stub/user-avatars
if [[ -d "$tmp_dir/storage/user-avatars" ]]; then
  docker cp "$tmp_dir/storage/user-avatars" "${storage_container}:/mnt/stub/stub/"
fi

python "$script_dir/critical_backup_state.py" restore "$tmp_dir/critical-review-state.json" --apply
echo "Critical backup restored successfully."
