#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AUTH_BACKUP_ENCRYPTION_PASSPHRASE:?AUTH_BACKUP_ENCRYPTION_PASSPHRASE is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
instance_name="${AUTH_INSTANCE_NAME:-espana-transparente-self-hosted}"
storage_container="${SUPABASE_STORAGE_CONTAINER:-supabase_storage_espana-transparente}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_dir="${BACKUP_OUTPUT_DIR:-./backups}"
tmp_dir="$(mktemp -d)"
verify_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir" "$verify_dir"
}
trap cleanup EXIT

mkdir -p "$output_dir" "$tmp_dir/storage"
chmod 700 "$tmp_dir" "$verify_dir"

dump_file="$tmp_dir/critical-data.dump"
state_file="$tmp_dir/critical-review-state.json"
manifest_file="$tmp_dir/manifest.json"
counts_file="$tmp_dir/counts.json"
checksums_file="$tmp_dir/SHA256SUMS"
bundle_file="$tmp_dir/critical-data-${timestamp}.tar.gz"
encrypted_file="$output_dir/critical-data-${timestamp}.tar.gz.enc"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --data-only \
  --no-owner \
  --no-privileges \
  --file="$dump_file" \
  --table='auth.*' \
  --table=public.user_profiles \
  --table=public.user_profile_settings \
  --table=public.annotations \
  --table=storage.buckets \
  --table=storage.objects

python "$script_dir/critical_backup_state.py" export "$state_file"

if docker inspect "$storage_container" >/dev/null 2>&1; then
  docker cp "${storage_container}:/mnt/stub/stub/user-avatars" "$tmp_dir/storage/"
else
  echo "Storage container not found: ${storage_container}" >&2
  exit 1
fi

psql "$DATABASE_URL" \
  --set=ON_ERROR_STOP=1 \
  --tuples-only \
  --no-align \
  --command="
SELECT jsonb_pretty(jsonb_build_object(
  'auth_users', (SELECT count(*) FROM auth.users),
  'auth_identities', (SELECT count(*) FROM auth.identities),
  'user_profiles', (SELECT count(*) FROM public.user_profiles),
  'user_profile_settings', (SELECT count(*) FROM public.user_profile_settings),
  'annotations', (SELECT count(*) FROM public.annotations),
  'storage_buckets', (SELECT count(*) FROM storage.buckets),
  'storage_objects', (SELECT count(*) FROM storage.objects),
  'user_avatar_objects', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'user-avatars'),
  'reviewed_judicial_actors', (
    SELECT count(*) FROM corruption_case_actors WHERE review_status IN ('reviewed', 'rejected')
  ),
  'reviewed_judicial_links', (
    SELECT count(*) FROM corruption_contract_links WHERE review_status IN ('reviewed', 'rejected')
  ),
  'reviewed_lobbying_links', (
    SELECT count(*) FROM lobbying_organization_links WHERE review_status IN ('reviewed', 'rejected')
  ),
  'reviewed_borme_matches', (
    SELECT count(*) FROM borme_politician_matches WHERE review_status IN ('reviewed', 'rejected')
  )
))::text;
" > "$counts_file"

cat > "$manifest_file" <<EOF
{
  "created_at": "${timestamp}",
  "supabase_instance": "${instance_name}",
  "format": "critical pg_dump plus natural-key review state and encrypted storage files",
  "database_scope": [
    "auth schema data",
    "public.user_profiles",
    "public.user_profile_settings",
    "public.annotations",
    "storage.buckets",
    "storage.objects"
  ],
  "storage_scope": ["user-avatars"],
  "review_state_version": 1
}
EOF

(
  cd "$tmp_dir"
  find critical-data.dump critical-review-state.json counts.json manifest.json storage \
    -type f -print0 | sort -z | xargs -0 sha256sum > "$(basename "$checksums_file")"
)

tar -czf "$bundle_file" -C "$tmp_dir" \
  "$(basename "$dump_file")" \
  "$(basename "$state_file")" \
  "$(basename "$counts_file")" \
  "$(basename "$manifest_file")" \
  "$(basename "$checksums_file")" \
  storage

openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "$bundle_file" \
  -out "$encrypted_file" \
  -pass "env:AUTH_BACKUP_ENCRYPTION_PASSPHRASE"

openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "$encrypted_file" \
  -out "$verify_dir/critical-data.tar.gz" \
  -pass "env:AUTH_BACKUP_ENCRYPTION_PASSPHRASE"
tar -xzf "$verify_dir/critical-data.tar.gz" -C "$verify_dir"
(
  cd "$verify_dir"
  sha256sum --check SHA256SUMS
)
pg_restore --list "$verify_dir/critical-data.dump" >/dev/null

chmod 600 "$encrypted_file"
echo "$encrypted_file"
