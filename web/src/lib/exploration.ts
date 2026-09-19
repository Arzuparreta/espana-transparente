export const MONEY_FILTER_KEYS = [
  "type",
  "nivel",
  "ministry",
  "level",
  "territory",
  "year",
  "province",
  "municipio",
  "flow",
  "organization",
  "role",
  "page",
] as const
export function collectionHref(
  path: string,
  current: string,
  changes: Record<string, string | number | null | undefined>,
) {
  const input = new URLSearchParams(current)
  const params = new URLSearchParams()
  for (const key of MONEY_FILTER_KEYS) {
    const value = input.get(key)
    if (value) params.set(key, value)
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value == null || value === "all" || (key === "page" && value === 1))
      params.delete(key)
    else params.set(key, String(value))
  }
  return `${path}${params.size ? `?${params}` : ""}`
}
export function isLocalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")
}
