import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"

const root = join(process.cwd(), "src")
const targets = []

function collect(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      collect(fullPath)
      continue
    }
    if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
      targets.push(fullPath)
    }
  }
}

collect(root)

const violations = []
const pageFiles = []

for (const file of targets) {
  const source = readFileSync(file, "utf8")
  const rel = relative(process.cwd(), file)

  if (rel.startsWith("src/app/") && rel.endsWith("/page.tsx")) {
    pageFiles.push(file)
  }

  if (/[^:\w-]grid-cols-3[^:\w-]/.test(source) && !/(sm:|md:|lg:|xl:|2xl:)grid-cols-3/.test(source)) {
    violations.push(`${rel}: usa "grid-cols-3" sin una variante responsive explícita.`)
  }

  if (source.includes("flex items-center justify-between") && !source.includes("min-w-0")) {
    violations.push(`${rel}: usa "justify-between" sin protección visible de contracción ("min-w-0").`)
  }

  if (
    rel !== "src/lib/domain-style.ts" &&
    /const\s+(VC|PC|PARTY_COLORS|VOTE_COLORS)\s*:\s*Record<string,\s*string>/.test(source)
  ) {
    violations.push(`${rel}: redefine mapas de color en vez de reutilizar utilidades de dominio.`)
  }

  if (
    source.includes("border-b border-border overflow-x-auto") &&
    !rel.includes("components/domain/SectionTabs.tsx")
  ) {
    violations.push(`${rel}: implementa tabs personalizadas fuera de SectionTabs.`)
  }

  if (
    source.includes("inline-flex min-w-full gap-2 border-b") &&
    !rel.includes("components/domain/LinkTabs.tsx") &&
    !rel.includes("components/domain/SectionTabs.tsx")
  ) {
    violations.push(`${rel}: implementa tabs inline; usar LinkTabs o SectionTabs.`)
  }

  if (
    source.includes("Página {page} de {totalPages}") &&
    !rel.includes("components/domain/Pagination.tsx")
  ) {
    violations.push(`${rel}: implementa paginación inline; usar Pagination.`)
  }

  if (/max-w-\[\d+px\]/.test(source)) {
    violations.push(`${rel}: fija anchuras máximas arbitrarias; usar layout fluido o primitives compartidas.`)
  }
}

for (const file of pageFiles) {
  const loadingFile = join(dirname(file), "loading.tsx")
  if (!existsSync(loadingFile)) {
    violations.push(`${relative(process.cwd(), file)}: falta loading.tsx junto a la página.`)
  }
}

if (violations.length > 0) {
  console.error("UI audit failed:\n")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log(`UI audit passed for ${targets.length} source files.`)
