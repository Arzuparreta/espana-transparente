import { NextResponse } from "next/server"
import { checkDatabaseHealth } from "@/lib/data/database-health"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await checkDatabaseHealth()
  } catch (error) {
    console.error(
      "health database check failed:",
      error instanceof Error ? error.message : String(error)
    )
    return NextResponse.json(
      { status: "degraded", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.json(
    { status: "ok", database: "ok" },
    { headers: { "Cache-Control": "no-store" } }
  )
}
