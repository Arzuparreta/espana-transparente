/**
 * Search regression checks against live Supabase (REST RPC, same path as the web app).
 *
 * Env (from web/.env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SEARCH_PM_ENTITY_ID  — optional override for PM politician row
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(process.cwd())
const envPath = join(root, ".env.local")
const etlEnvPath = join(root, "..", "etl", ".env")

function loadEnvFile(path, overwrite = false) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (overwrite || !(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(envPath)
loadEnvFile(etlEnvPath, true)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  )
  process.exit(1)
}

const PM_ENTITY_ID = process.env.SEARCH_PM_ENTITY_ID ?? null
const PERSON_TYPES = new Set(["politician", "senator", "government_position", "institution"])

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function isPmRow(row) {
  if (PM_ENTITY_ID && row.id === PM_ENTITY_ID && row.entity_type === "politician") return true
  const title = normalize(row.title ?? "")
  const meta = row.metadata ?? {}
  const official = normalize(String(meta.official_name ?? ""))
  return (
    (title.includes("perez-castejon") || official.includes("perez-castejon")) &&
    (title.includes("pedro") || official.includes("pedro"))
  )
}

function personPmRank(rows, limit) {
  const slice = rows.slice(0, limit)
  const idx = slice.findIndex((r) => PERSON_TYPES.has(r.entity_type) && isPmRow(r))
  return idx === -1 ? null : idx + 1
}

async function rpc(name, args) {
  const started = performance.now()
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  })
  const ms = performance.now() - started
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${name}: HTTP ${response.status} ${body}`)
  }
  return { rows: await response.json(), ms }
}

const checks = []

function check(name, ok, detail) {
  checks.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
}

// Routes that are valid as section indexes but must NEVER be the destination of
// a search result — every entity needs a deeper URL.
const BASE_ROUTE_BLOCKLIST = [
  "/diputados",
  "/partidos",
  "/votaciones",
  "/contratos",
  "/subvenciones",
  "/iniciativas",
  "/organizaciones",
  "/indicadores",
  "/presupuestos",
  "/fondos-ue",
  "/puertas-giratorias",
  "/gobierno",
  "/ministerios",
  "/instituciones",
]

async function restSelect(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`REST ${path}: HTTP ${response.status} ${body}`)
  }
  return response.json()
}

async function auditRoutes() {
  // 1. Bare base routes: any row whose route equals a known section index.
  const inList = `(${BASE_ROUTE_BLOCKLIST.map((p) => `"${p}"`).join(",")})`
  const bare = await restSelect(
    `search_documents?select=entity_type,entity_id,route&route=in.${encodeURIComponent(inList)}&limit=50`
  )
  check(
    "no search rows point to bare section index",
    bare.length === 0,
    bare.length === 0
      ? "0 offenders"
      : `${bare.length} offenders: ${bare
          .slice(0, 5)
          .map((r) => `${r.entity_type}→${r.route}`)
          .join("; ")}`
  )

  // 2. NULL/empty routes.
  const nullRoutes = await restSelect(
    `search_documents?select=entity_type,entity_id&route=is.null&limit=20`
  )
  check(
    "no search rows have NULL route",
    nullRoutes.length === 0,
    nullRoutes.length === 0
      ? "0 offenders"
      : `${nullRoutes.length} offenders (first: ${nullRoutes
          .slice(0, 3)
          .map((r) => r.entity_type)
          .join(", ")})`
  )
}

const args = new Set(process.argv.slice(2))

async function main() {
  console.log(`Supabase: ${url}\n`)

  await auditRoutes()
  if (args.has("--routes-only")) {
    const passed = checks.filter((c) => c.ok).length
    const failed = checks.length - passed
    console.log(`\n${passed}/${checks.length} passed, ${failed} failed`)
    process.exit(failed > 0 ? 1 : 0)
    return
  }

  const pedroSuggest = await rpc("search_suggestions", { query_text: "Pedro", limit_count: 50 })
  const pedroTop12Pm = personPmRank(pedroSuggest.rows, 12)
  check(
    "Pedro suggest top 12 includes PM",
    pedroTop12Pm !== null,
    pedroTop12Pm ? `rank #${pedroTop12Pm}` : `top: ${pedroSuggest.rows.slice(0, 3).map((r) => r.entity_type).join(", ")}`
  )

  const pedroFullSuggest = await rpc("search_suggestions", {
    query_text: "Pedro Sanchez",
    limit_count: 12,
  })
  const top5 = pedroFullSuggest.rows.slice(0, 5)
  const pmIdx = top5.findIndex((r) => isPmRow(r))
  const euBeforePm = top5.slice(0, pmIdx === -1 ? 5 : pmIdx).filter((r) => r.entity_type === "eu_fund").length
  check(
    "Pedro Sanchez suggest top 5: PM above eu_fund noise",
    pmIdx !== -1 && pmIdx < 3 && euBeforePm === 0,
    pmIdx === -1 ? "PM not in top 5" : `PM #${pmIdx + 1}, ${euBeforePm} eu_fund before PM`
  )

  const pedroFull = await rpc("search_documents", {
    query_text: "Pedro Sanchez",
    entity_types: null,
    filters: {},
    limit_count: 24,
  })
  check(
    "search_documents('Pedro Sanchez') < 5s",
    pedroFull.ms < 5000,
    `${(pedroFull.ms / 1000).toFixed(2)}s`
  )
  const pedroFullPm = pedroFull.rows.findIndex((r) => isPmRow(r))
  check(
    "Pedro Sanchez full: PM in top 3",
    pedroFullPm !== -1 && pedroFullPm < 3,
    pedroFullPm === -1 ? "not found" : `rank #${pedroFullPm + 1}`
  )

  const sanchezFull = await rpc("search_documents", {
    query_text: "Sanchez",
    entity_types: null,
    filters: {},
    limit_count: 24,
  })
  const sanchezTop5Pm = personPmRank(sanchezFull.rows, 5)
  check(
    "Sanchez full top 5 includes PM",
    sanchezTop5Pm !== null,
    sanchezTop5Pm ? `rank #${sanchezTop5Pm}` : "not in top 5"
  )

  const fiscal = await rpc("search_documents", {
    query_text: "contrato sanidad",
    entity_types: null,
    filters: {},
    limit_count: 12,
  })
  const fiscalTop = fiscal.rows.slice(0, 5)
  const contractCount = fiscalTop.filter((r) => r.entity_type === "contract").length
  const personCount = fiscalTop.filter((r) => PERSON_TYPES.has(r.entity_type)).length
  const fiscalCount = fiscalTop.filter((r) =>
    ["contract", "subsidy", "budget", "budget_program"].includes(r.entity_type)
  ).length
  check(
    "contrato sanidad favors fiscal results",
    fiscalCount >= 2 && personCount === 0,
    `${fiscalCount} fiscal rows, ${personCount} person rows in top 5`
  )

  const psoe = await rpc("search_suggestions", { query_text: "PSOE", limit_count: 12 })
  const hasParty = psoe.rows.some((r) => r.entity_type === "party")
  check("PSOE returns party", hasParty, hasParty ? "party found" : psoe.rows.slice(0, 3).map((r) => r.entity_type).join(", "))

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.length - passed
  console.log(`\n${passed}/${checks.length} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
