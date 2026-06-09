/**
 * Search regression checks against live Supabase (REST RPC, same path as the web app).
 *
 * Env (from web/.env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SEARCH_PM_ENTITY_ID  — optional override for PM politician row
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
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
loadEnvFile(etlEnvPath)

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

async function rpc(name, args, { attempts = 2 } = {}) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = performance.now()
    try {
      const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        // A cold Supabase (free tier) can take ~20s to answer the first query;
        // 30s tolerates that cold start without masking a genuine outage.
        signal: AbortSignal.timeout(30_000),
      })
      const ms = performance.now() - started
      if (!response.ok) {
        const body = await response.text()
        const detail = body.replace(/\s+/g, " ").slice(0, 240)
        throw new Error(`${name}: HTTP ${response.status} ${detail}`)
      }
      return { rows: await response.json(), ms }
    } catch (error) {
      lastError = error
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5_000))
    }
  }
  throw lastError
}

const checks = []

function check(name, ok, detail) {
  checks.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
}

// Routes that are valid as section indexes but must NEVER be the destination of
// a search result without a deeper suffix.
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

// Static check: grep the corpus migration SQL for hardcoded bare routes.
// This catches bugs before they reach the DB and requires no DB query.
function auditRoutesStatic() {
  const migrationsDir = join(root, "..", "supabase", "migrations")
  if (!existsSync(migrationsDir)) {
    check("search routes static audit (skipped — migrations dir not found)", true, "skipped")
    return
  }
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
  // Find the most recent migration that defines refresh_search_documents
  const corpusFile = files.find((f) => {
    const content = readFileSync(join(migrationsDir, f), "utf8")
    return content.includes("refresh_search_documents") && content.includes("UNION ALL")
  })
  if (!corpusFile) {
    check("search routes static audit (skipped — corpus migration not found)", true, "skipped")
    return
  }
  const sql = readFileSync(join(migrationsDir, corpusFile), "utf8")
  // Look for route expressions that are bare base paths:
  // A match is: a SQL quoted string like '/fondos-ue' or '/puertas-giratorias'
  // followed only by whitespace, comma, newline — NOT '||' (concatenation).
  const offenders = []
  for (const basePath of BASE_ROUTE_BLOCKLIST) {
    // Pattern: 'basePath' NOT followed by optional whitespace + ||
    const escaped = basePath.replace(/[-/]/g, "\\$&")
    const re = new RegExp(`'${escaped}'(?!\\s*\\|\\|)`, "g")
    const matches = sql.match(re)
    if (matches?.length) {
      offenders.push(`${basePath} (${matches.length}× in ${corpusFile})`)
    }
  }
  check(
    "search corpus SQL: no bare base routes",
    offenders.length === 0,
    offenders.length === 0 ? `0 offenders in ${corpusFile}` : offenders.join("; ")
  )
}

// RPC-based sampling: verify that formerly-broken entity types now return
// deep routes. Uses the indexed search_documents RPC (no full-table scan).
async function auditRoutesRpc() {
  const samples = [
    // 4+ tokens → general intent → eu_fund included in candidates
    { query: "fondo europeo inversiones fei", types: ["eu_fund"], prefix: "/fondos-ue/", label: "eu_fund routes" },
    // fiscal intent → budget_program included; 3 tokens + digit bypass person guard
    { query: "programa 911M jefatura estado", types: ["budget_program"], prefix: "/presupuestos/", minSegments: 3, label: "budget_program routes" },
    // person types always included
    { query: "ministerio hacienda", types: ["government_position"], prefix: "/ministerios/", label: "government_position routes" },
  ]
  for (const { query, types, prefix, minSegments, label } of samples) {
    let rows
    try {
      const result = await rpc("search_documents", {
        query_text: query,
        entity_types: types,
        filters: {},
        limit_count: 5,
      })
      rows = result.rows
    } catch (error) {
      check(
        `route sample: ${label}`,
        false,
        `RPC unavailable: ${error instanceof Error ? error.message : String(error)}`
      )
      continue
    }
    if (rows.length === 0) {
      check(`route sample: ${label}`, false, "0 results")
      continue
    }
    const bad = rows.filter((r) => {
      if (!r.url || !r.url.startsWith(prefix)) return true
      if (minSegments) {
        const segments = r.url.split("/").filter(Boolean)
        if (segments.length < minSegments) return true
      }
      return false
    })
    check(
      `route sample: ${label}`,
      bad.length === 0,
      bad.length === 0
        ? `${rows.length} rows, all deep (e.g. ${rows[0]?.url})`
        : `bad: ${bad.map((r) => r.url).join(", ")}`
    )
  }
}

async function auditRoutes() {
  auditRoutesStatic()
  await auditRoutesRpc()
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

  const pensions = await rpc("search_documents", {
    query_text: "pensiones",
    entity_types: ["budget", "budget_program"],
    filters: {},
    limit_count: 12,
  })
  const pensionTop = pensions.rows[0]
  check(
    "pensiones favors Seguridad Social budget program",
    pensionTop?.entity_type === "budget_program" &&
      normalize(pensionTop.title ?? "").includes("pensiones contributivas") &&
      normalize(pensionTop.subtitle ?? "").includes("seguridad social"),
    pensionTop ? `${pensionTop.title} — ${pensionTop.subtitle}` : "0 results"
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
