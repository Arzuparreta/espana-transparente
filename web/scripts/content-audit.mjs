import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = join(process.cwd(), "src")

const FORBIDDEN = [
  { name: "austriac*",          pattern: /austriac/i },
  { name: "libertari*",         pattern: /libertari/i },
  { name: "anarcocap*",         pattern: /anarcocap/i },
  { name: "coerción",           pattern: /coerci(?:ó|o)n/i },
  { name: "expolio/expoliar",   pattern: /expoli/i },
  { name: "Huerta de Soto",     pattern: /huerta\s+de\s+soto/i },
  { name: "Mises",              pattern: /\bmises\b/i },
  { name: "Hayek",              pattern: /\bhayek\b/i },
  { name: "Rothbard",           pattern: /\brothbard\b/i },
  { name: "fatal arrogancia",   pattern: /fatal\s+arrogancia/i },
  { name: "robo del estado",    pattern: /robo\s+del\s+estado/i },
  { name: "robar al",           pattern: /robar\s+al\b/i },
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
    if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
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
    `\n${violations.length} violación(es). El marco interno del proyecto no debe filtrarse a la UI.`,
  )
  process.exit(1)
}

console.log(`Content audit passed for ${targets.length} source files.`)
