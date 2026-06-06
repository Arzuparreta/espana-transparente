import { dataQuerySignal } from "./shared"

const HEALTH_PROBES = [
  "v_etl_pipeline_status?select=pipeline&limit=1",
  "v_attendance_ranking?select=politician_id&limit=1",
]

export async function checkDatabaseHealth() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase environment is not configured")
  }

  await Promise.all(HEALTH_PROBES.map(async (probe) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/${probe}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
      signal: dataQuerySignal(),
    })

    if (!response.ok) {
      throw new Error(`Supabase REST probe ${probe} returned ${response.status}`)
    }

    const body = await response.json()
    if (!Array.isArray(body)) {
      throw new Error(`Supabase REST probe ${probe} returned an invalid response`)
    }
  }))
}
