#!/usr/bin/env node

const SUPABASE_ACCESS_TOKEN = required("SUPABASE_ACCESS_TOKEN")
const EXPECTED_REF = process.env.AUTH_EXPECTED_SUPABASE_REF ?? "zktpodkvlgciluhbulwr"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? `https://${EXPECTED_REF}.supabase.co`
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

const response = await fetch(`https://api.supabase.com/v1/projects/${EXPECTED_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    disable_signup: false,
    mailer_autoconfirm: true,
  }),
})

if (!response.ok) {
  const body = await response.text()
  throw new Error(`Supabase Management API failed: HTTP ${response.status} ${body}`)
}

console.log(`Auth config updated for ${EXPECTED_REF}: disable_signup=false, mailer_autoconfirm=true`)

if (ANON_KEY) {
  const settings = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: ANON_KEY },
  }).then((res) => res.json())

  console.log(`email_signup=${settings.external?.email ? "enabled" : "disabled"}`)
  console.log(`signup=${settings.disable_signup ? "disabled" : "enabled"}`)
  console.log(`mailer_autoconfirm=${settings.mailer_autoconfirm ? "true" : "false"}`)
}

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}
