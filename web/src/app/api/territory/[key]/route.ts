import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/client"
import {
  parseTerritoryDataset,
} from "@/lib/territory-catalog"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ key: string }>
}

function parseYear(value: string | null) {
  if (!value || value === "all") return null
  const year = Number.parseInt(value, 10)
  return Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null
}

async function getContracts(key: string, province: string | null, year: number | null) {
  let query = supabase
    .from("contracts")
    .select("id, title, awarding_body, contractor, amount, date, source_url, region")
    .eq("ccaa_key", key)
    .order("amount", { ascending: false, nullsFirst: false })
    .limit(6)
  if (province) query = query.eq("province_key", province)
  if (year) {
    query = query.gte("date", `${year}-01-01`).lt("date", `${year + 1}-01-01`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => ({
    dataset: "contracts" as const,
    id: row.id,
    title: row.title || "Contrato sin título",
    counterparty: row.contractor,
    body: row.awarding_body,
    amount: Number(row.amount ?? 0),
    date: row.date,
    sourceUrl: row.source_url,
    territory: row.region,
    href: `/contratos/${row.id}`,
  }))
}

async function getSubsidies(key: string, year: number | null) {
  let query = supabase
    .from("subsidies")
    .select("id, convocatoria, beneficiario, nivel3, importe, fecha_concesion, source_url, nivel2")
    .eq("ccaa_key", key)
    .order("importe", { ascending: false, nullsFirst: false })
    .limit(6)
  if (year) {
    query = query
      .gte("fecha_concesion", `${year}-01-01`)
      .lt("fecha_concesion", `${year + 1}-01-01`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => ({
    dataset: "subsidies" as const,
    id: row.id,
    title: row.convocatoria || row.beneficiario || "Subvención",
    counterparty: row.beneficiario,
    body: row.nivel3,
    amount: Number(row.importe ?? 0),
    date: row.fecha_concesion,
    sourceUrl: row.source_url,
    territory: row.nivel2,
    href: `/subvenciones/${row.id}`,
  }))
}

export async function GET(request: Request, { params }: RouteContext) {
  const { key } = await params
  const url = new URL(request.url)
  const dataset = parseTerritoryDataset(url.searchParams.get("source") ?? undefined)
  const year = parseYear(url.searchParams.get("year"))
  const province = url.searchParams.get("province")

  try {
    const requests: Promise<Awaited<ReturnType<typeof getContracts>> | Awaited<ReturnType<typeof getSubsidies>>>[] = []
    if (dataset !== "subsidies") requests.push(getContracts(key, province, year))
    if (dataset !== "contracts" && !province) requests.push(getSubsidies(key, year))
    const groups = await Promise.all(requests)
    const records = groups
      .flat()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)

    return NextResponse.json({
      key,
      province,
      dataset,
      year,
      records,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el detalle territorial" },
      { status: 500 }
    )
  }
}
