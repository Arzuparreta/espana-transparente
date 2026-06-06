import { dataQuerySignal } from "./shared"

export async function checkDatabaseHealth() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase environment is not configured")
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/v_etl_pipeline_status?select=pipeline&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
      signal: dataQuerySignal(),
    }
  )

  if (!response.ok) {
    throw new Error(`Supabase REST returned ${response.status}`)
  }

  const body = await response.json()
  if (!Array.isArray(body)) {
    throw new Error("Supabase REST returned an invalid response")
  }
}
