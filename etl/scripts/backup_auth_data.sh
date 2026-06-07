#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AUTH_BACKUP_ENCRYPTION_PASSPHRASE:?AUTH_BACKUP_ENCRYPTION_PASSPHRASE is required}"

instance_name="${AUTH_INSTANCE_NAME:-espana-transparente-self-hosted}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_dir="${BACKUP_OUTPUT_DIR:-./backups}"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

mkdir -p "$output_dir"
chmod 700 "$tmp_dir"

dump_file="$tmp_dir/auth-data.dump"
manifest_file="$tmp_dir/manifest.json"
counts_file="$tmp_dir/counts.json"
bundle_file="$tmp_dir/auth-data-${timestamp}.tar.gz"
encrypted_file="$output_dir/auth-data-${timestamp}.tar.gz.enc"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$dump_file" \
  --table=auth.users \
  --table=auth.identities \
  --table=public.user_profiles \
  --table=public.user_profile_settings \
  --table=public.annotations \
  --table=storage.buckets \
  --table=storage.objects

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
  'storage_objects', (SELECT count(*) FROM storage.objects)
))::text;
" > "$counts_file"

cat > "$manifest_file" <<EOF
{
  "created_at": "${timestamp}",
  "supabase_instance": "${instance_name}",
  "format": "pg_dump custom archive inside encrypted tar.gz",
  "tables": [
    "auth.users",
    "auth.identities",
    "public.user_profiles",
    "public.user_profile_settings",
    "public.annotations",
    "storage.buckets",
    "storage.objects"
  ]
}
EOF

tar -czf "$bundle_file" -C "$tmp_dir" "$(basename "$dump_file")" "$(basename "$counts_file")" "$(basename "$manifest_file")"

openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "$bundle_file" \
  -out "$encrypted_file" \
  -pass "env:AUTH_BACKUP_ENCRYPTION_PASSPHRASE"

chmod 600 "$encrypted_file"
echo "$encrypted_file"
