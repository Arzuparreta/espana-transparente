import nextEnv from "@next/env"
nextEnv.loadEnvConfig(process.cwd())
const internal = process.env.SUPABASE_INTERNAL_URL
const external = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!internal || !external) throw new Error("Both Supabase endpoints are required for the VPS deployment")
const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
const path = "/rest/v1/voting_sessions?select=id&order=id&limit=1"
async function read(origin) {
  const response = await fetch(origin + path, { headers, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Supabase endpoint returned ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data) || data.length !== 1) throw new Error("Missing database identity sample")
  return data[0].id
}
const [local, publicId] = await Promise.all([read(internal), read(external)])
if (local !== publicId) throw new Error("Internal and public Supabase endpoints do not match")
console.log("Internal Supabase endpoint verified against the public database")
