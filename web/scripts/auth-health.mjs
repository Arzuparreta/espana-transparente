#!/usr/bin/env node

import { spawnSync } from "node:child_process"

const EXPECTED_REF = process.env.AUTH_EXPECTED_SUPABASE_REF ?? "zktpodkvlgciluhbulwr"
const MIN_USERS = Number.parseInt(process.env.AUTH_MIN_USERS ?? "1", 10)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  fail("DATABASE_URL is required")
}

const sql = `
WITH auth_counts AS (
  SELECT
    (SELECT count(*) FROM auth.users)::int AS auth_users,
    (SELECT count(*) FROM auth.identities)::int AS auth_identities,
    (SELECT count(*) FROM public.user_profiles)::int AS user_profiles,
    (SELECT count(*) FROM public.user_profile_settings)::int AS user_profile_settings,
    (SELECT count(*) FROM public.annotations)::int AS annotations
),
missing_profiles AS (
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) AS ids
  FROM (
    SELECT u.id::text AS id
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id = u.id
    WHERE p.id IS NULL
    ORDER BY u.created_at DESC
    LIMIT 10
  ) s
),
missing_settings AS (
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) AS ids
  FROM (
    SELECT u.id::text AS id
    FROM auth.users u
    LEFT JOIN public.user_profile_settings s ON s.user_id = u.id
    WHERE s.user_id IS NULL
    ORDER BY u.created_at DESC
    LIMIT 10
  ) s
),
orphan_profiles AS (
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) AS ids
  FROM (
    SELECT p.id::text AS id
    FROM public.user_profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE u.id IS NULL
    LIMIT 10
  ) s
),
orphan_settings AS (
  SELECT coalesce(jsonb_agg(user_id), '[]'::jsonb) AS ids
  FROM (
    SELECT s.user_id::text AS user_id
    FROM public.user_profile_settings s
    LEFT JOIN auth.users u ON u.id = s.user_id
    WHERE u.id IS NULL
    LIMIT 10
  ) s
)
SELECT jsonb_pretty(jsonb_build_object(
  'tables', jsonb_build_object(
    'auth.users', to_regclass('auth.users') IS NOT NULL,
    'auth.identities', to_regclass('auth.identities') IS NOT NULL,
    'public.user_profiles', to_regclass('public.user_profiles') IS NOT NULL,
    'public.user_profile_settings', to_regclass('public.user_profile_settings') IS NOT NULL,
    'public.annotations', to_regclass('public.annotations') IS NOT NULL,
    'storage.buckets', to_regclass('storage.buckets') IS NOT NULL,
    'storage.objects', to_regclass('storage.objects') IS NOT NULL
  ),
  'triggers', jsonb_build_object(
    'auth.users.on_auth_user_created_profile', EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'auth'
        AND c.relname = 'users'
        AND t.tgname = 'on_auth_user_created_profile'
        AND NOT t.tgisinternal
    )
  ),
  'counts', (SELECT to_jsonb(auth_counts) FROM auth_counts),
  'mismatches', jsonb_build_object(
    'auth_users_without_profile', (SELECT ids FROM missing_profiles),
    'auth_users_without_settings', (SELECT ids FROM missing_settings),
    'profiles_without_auth_user', (SELECT ids FROM orphan_profiles),
    'settings_without_auth_user', (SELECT ids FROM orphan_settings)
  )
))::text;
`

const result = spawnSync(
  "psql",
  [DATABASE_URL, "--set=ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--command", sql],
  { encoding: "utf8", maxBuffer: 1024 * 1024 }
)

if (result.error) {
  fail(`Unable to run psql: ${result.error.message}`)
}

if (result.status !== 0) {
  fail(result.stderr.trim() || "psql failed")
}

const health = JSON.parse(result.stdout.trim())
const failures = []
const authSettings = await getAuthSettings()
const projectRefFromUrl = getProjectRef(SUPABASE_URL)

if (projectRefFromUrl && projectRefFromUrl !== EXPECTED_REF) {
  failures.push(`NEXT_PUBLIC_SUPABASE_URL points to ${projectRefFromUrl}, expected ${EXPECTED_REF}`)
} else if (!projectRefFromUrl && !DATABASE_URL.includes(EXPECTED_REF)) {
  failures.push(`Could not confirm expected Supabase ref ${EXPECTED_REF} from env`)
}

for (const [table, present] of Object.entries(health.tables)) {
  if (!present) failures.push(`Missing table: ${table}`)
}

if (!health.triggers["auth.users.on_auth_user_created_profile"]) {
  failures.push("Missing trigger: auth.users.on_auth_user_created_profile")
}

if (health.counts.auth_users < MIN_USERS) {
  failures.push(`auth.users has ${health.counts.auth_users} users, expected at least ${MIN_USERS}`)
}

if (
  health.counts.auth_users !== health.counts.user_profiles ||
  health.counts.auth_users !== health.counts.user_profile_settings
) {
  failures.push(
    `Profile counts are not coherent: auth.users=${health.counts.auth_users}, user_profiles=${health.counts.user_profiles}, user_profile_settings=${health.counts.user_profile_settings}`
  )
}

for (const [name, ids] of Object.entries(health.mismatches)) {
  if (ids.length > 0) failures.push(`${name}: ${ids.join(", ")}`)
}

if (authSettings) {
  if (authSettings.external?.email !== true) failures.push("Email signup provider is disabled")
  if (authSettings.disable_signup !== false) failures.push("Auth signup is disabled")
  if (authSettings.mailer_autoconfirm !== true) {
    failures.push("Email confirmation is enabled; expected mailer_autoconfirm=true")
  }
}

console.log("Auth health")
console.log(`project_ref=${projectRefFromUrl || "unknown"} expected=${EXPECTED_REF}`)
console.log(`auth.users=${health.counts.auth_users}`)
console.log(`auth.identities=${health.counts.auth_identities}`)
console.log(`user_profiles=${health.counts.user_profiles}`)
console.log(`user_profile_settings=${health.counts.user_profile_settings}`)
console.log(`annotations=${health.counts.annotations}`)
console.log(`trigger=${health.triggers["auth.users.on_auth_user_created_profile"] ? "present" : "missing"}`)
if (authSettings) {
  console.log(`email_signup=${authSettings.external?.email ? "enabled" : "disabled"}`)
  console.log(`signup=${authSettings.disable_signup ? "disabled" : "enabled"}`)
  console.log(`mailer_autoconfirm=${authSettings.mailer_autoconfirm ? "true" : "false"}`)
}

if (failures.length > 0) {
  console.error("\nFailures:")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("\nOK")

function getProjectRef(value) {
  if (!value) return null
  try {
    const host = new URL(value).hostname
    const [ref] = host.split(".")
    return ref || null
  } catch {
    return null
  }
}

async function getAuthSettings() {
  if (!SUPABASE_URL || (!ANON_KEY && !SERVICE_ROLE_KEY)) return null
  let response = await fetchAuthSettings(ANON_KEY || SERVICE_ROLE_KEY)
  if (response.status === 401 && SERVICE_ROLE_KEY && SERVICE_ROLE_KEY !== ANON_KEY) {
    response = await fetchAuthSettings(SERVICE_ROLE_KEY)
  }

  if (!response.ok) {
    failures.push(`Could not read Auth settings: HTTP ${response.status}`)
    return null
  }

  return response.json()
}

function fetchAuthSettings(key) {
  return fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: {
      apikey: key,
    },
  })
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
