const ALL_CAPS_THRESHOLD = 0.8

const LOWERCASE_CONNECTORS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "en",
  "por",
  "para",
  "con",
  "al",
  "a",
  "i",
  "da",
  "do",
  "das",
  "dos",
  "des",
])

const ALWAYS_UPPER_TOKENS = new Set([
  "PP",
  "PSOE",
  "VOX",
  "SUMAR",
  "ERC",
  "BNG",
  "UPN",
  "EAJ-PNV",
  "PNV",
  "CGPJ",
  "TC",
  "RTVE",
  "SEPI",
  "BORME",
  "PCSP",
  "INE",
  "BDNS",
  "ESIF",
  "DGAM",
  "JP",
])

function capitalizeWord(word: string, isFirst: boolean): string {
  if (!word) return word
  if (ALWAYS_UPPER_TOKENS.has(word)) return word

  const parts = word.split("-")
  if (parts.length > 1) {
    return parts.map((p, idx) => capitalizeWord(p, idx === 0)).join("-")
  }
  if (word.includes("/")) {
    return word
      .split("/")
      .map((p, idx) => capitalizeWord(p, idx === 0))
      .join("/")
  }

  const lower = word.toLowerCase()
  if (!isFirst && LOWERCASE_CONNECTORS.has(lower)) return lower
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** Heurística: si el ratio de mayúsculas (sobre letras) supera 80%, lo trata como "gritando" y lo pasa a Title Case. */
export function toTitleCaseIfShouting(input: string): string {
  if (!input) return input
  const letters = input.match(/[A-Za-zÀ-ÖØ-öø-ÿÑñ]/g)
  if (!letters || letters.length === 0) return input
  const upper = input.match(/[A-ZÀ-ÖØ-ÞÑ]/g) ?? []
  if (upper.length / letters.length < ALL_CAPS_THRESHOLD) return input

  return input
    .split(/(\s+|,)/)
    .map((token, idx) => {
      if (/^\s+$/.test(token) || token === ",") return token
      const isFirst = idx === 0
      return capitalizeWord(token, isFirst)
    })
    .join("")
}

/** Formatea importes grandes en castellano, sin usar "B" (que en inglés es 10^9 pero en español es 10^12). */
export function formatBigEuros(amount: number): string {
  if (!Number.isFinite(amount)) return "—"
  if (amount >= 1_000_000_000) {
    const value = (amount / 1_000_000_000).toFixed(1).replace(".", ",")
    return `${value} mil M €`
  }
  if (amount >= 1_000_000) {
    const value = (amount / 1_000_000).toFixed(0)
    return `${value} M €`
  }
  if (amount >= 1_000) {
    const value = (amount / 1_000).toFixed(0)
    return `${value} K €`
  }
  return `${Math.round(amount)} €`
}
