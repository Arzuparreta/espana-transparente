import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, relative, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(process.cwd(), "src")

// ── Indicator explanation coverage ───────────────────────────────────────────
// Every indicator_code defined in the ETL must have a corresponding entry
// in indicator-explanations.ts. Prevents silent gaps when ETL adds indicators.

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

/** @returns {string[]} */
function extractEtlIndicatorCodes() {
  const files = [
    join(projectRoot, "..", "etl", "src", "ine", "indicadores.py"),
    join(projectRoot, "..", "etl", "src", "ine", "indicadores_ampliados.py"),
    join(projectRoot, "..", "etl", "src", "ine", "bde.py"),
    join(projectRoot, "..", "etl", "src", "ine", "ipc_subgrupos.py"),
  ]
  const codes = []
  for (const etlPath of files) {
    if (!existsSync(etlPath)) continue
    const source = readFileSync(etlPath, "utf8")
    // Extract the "code" values from INDICATORS dicts, e.g.: "code": "IPC"
    const matches = source.matchAll(/"code":\s*"([^"]+)"/g)
    for (const m of matches) codes.push(m[1])
  }
  if (codes.length === 0) {
    console.warn("content-audit: no ETL indicator files found, skipping indicator coverage check.")
  }
  return codes
}

/** @returns {string[]} */
function extractExplainedCodes() {
  const explanationsPath = join(projectRoot, "src", "lib", "indicator-explanations.ts")
  if (!existsSync(explanationsPath)) {
    console.warn("content-audit: indicator-explanations.ts not found, skipping indicator coverage check.")
    return []
  }
  const source = readFileSync(explanationsPath, "utf8")
  // Extract keys from the EXPLANATIONS record:  IPC: { ...
  const matches = source.matchAll(/^\s{2}([A-Z_][A-Z0-9_]*):\s*\{/gm)
  return [...matches].map((m) => m[1])
}

// Política D5 (2026-06-10, docs/designs/2026-06-10-la-cadena.md): la lista
// ideológica fue retirada — la tesis puede ser explícita. Estos términos
// permanecen por RIESGO LEGAL: aplicados a personas sin condena firme son
// calumnia/difamación.
const FORBIDDEN = [
  { name: "corrupto/corrupta",   pattern: /\bcorrupt[oa]s?\b/i },
  { name: "culpable",            pattern: /\bculpables?\b/i },
  { name: "delincuente",         pattern: /\bdelincuentes?\b/i },
]

const targets = []

function collect(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      collect(fullPath)
      continue
    }
    if ((fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) && !fullPath.endsWith(".test.ts") && !fullPath.endsWith(".test.tsx")) {
      targets.push(fullPath)
    }
  }
}

function stripComments(source) {
  // remove /* ... */ blocks (incl. multi-line)
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) || []).length))
  // remove // line comments (keep the newline so line numbers stay aligned)
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, (_, prefix) => prefix)
  // remove {/* ... */} JSX comments (covered by /* */ pass above)
  return out
}

collect(root)

const violations = []

for (const file of targets) {
  const rel = relative(process.cwd(), file)
  const raw = readFileSync(file, "utf8")
  const scanned = stripComments(raw)
  const lines = scanned.split("\n")

  lines.forEach((line, i) => {
    for (const { name, pattern } of FORBIDDEN) {
      if (pattern.test(line)) {
        violations.push(`${rel}:${i + 1}: término prohibido "${name}" → ${line.trim()}`)
      }
    }
  })
}

if (violations.length > 0) {
  console.error("Content audit failed:\n")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  console.error(
    `\n${violations.length} violación(es). Términos de riesgo legal: no aplicables a personas sin condena firme.`,
  )
  process.exit(1)
}

// ── Indicator explanation coverage check ─────────────────────────────────────
const etlCodes = extractEtlIndicatorCodes()
if (etlCodes.length > 0) {
  const explainedCodes = new Set(extractExplainedCodes())
  const uncovered = etlCodes.filter((code) => !explainedCodes.has(code))
  if (uncovered.length > 0) {
    console.error("Content audit failed: indicator explanation coverage gap:\n")
    for (const code of uncovered) {
      console.error(`- ${code}: defined in etl/src/ine/indicadores.py but missing from web/src/lib/indicator-explanations.ts`)
    }
    console.error(
      `\n${uncovered.length} código(s) sin explicación. Añade una entrada en indicator-explanations.ts.`,
    )
    process.exit(1)
  }
  console.log(`Indicator explanation coverage: ${etlCodes.length}/${etlCodes.length} codes covered.`)
}

console.log(`Content audit passed for ${targets.length} source files.`)
