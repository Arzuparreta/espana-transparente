export interface PurposeGroup {
  finalidad: string | null
  classification: "classified" | "pending" | "not_published"
  instrumento: string | null
  grant_count: number
  call_count: number
  known_amount: number | null
  unknown_amount_count: number
  negative_amount_count: number
  last_checked: string | null
}
export interface BdnsCall {
  numero_convocatoria: string
  title: string
  finalidad: string | null
  tipo_convocatoria: string | null
  source_url: string
  checked_at: string
}
export const BDNS_SOURCE =
  "https://www.infosubvenciones.es/bdnstrans/GE/es/concesiones"
export function purposeYear(
  requested: string | string[] | undefined,
  current: number,
) {
  if (requested === undefined) return current
  return typeof requested === "string" &&
    /^\d{4}$/.test(requested) &&
    Number(requested) >= 2014 &&
    Number(requested) <= 2100
    ? Number(requested)
    : null
}
export function decodePurposeGroups(
  rows: Record<string, unknown>[],
): PurposeGroup[] {
  return rows.map((row) => {
    const numeric = (value: unknown) => {
      if (
        (typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && !value.trim())
      )
        throw new Error("Invalid BDNS number")
      return Number(value)
    }
    const integer = (key: string) => {
      const value = numeric(row[key])
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error("Invalid BDNS count")
      return value
    }
    const count = integer("grant_count"),
      calls = integer("call_count")
    const unknown = integer("unknown_amount_count"),
      negative = integer("negative_amount_count")
    const amount = row.known_amount == null ? null : numeric(row.known_amount)
    const classification = row.classification
    if (
      !["classified", "pending", "not_published"].includes(
        String(classification),
      ) ||
      !count ||
      calls > count ||
      unknown + negative > count ||
      (amount !== null && (!Number.isFinite(amount) || amount < 0)) ||
      (amount === null && unknown + negative !== count) ||
      (row.finalidad !== null && typeof row.finalidad !== "string") ||
      (classification === "classified" && !row.finalidad) ||
      (classification !== "classified" && row.finalidad !== null) ||
      (row.instrumento !== null && typeof row.instrumento !== "string")
    )
      throw new Error("Invalid BDNS purpose aggregate")
    return {
      finalidad: row.finalidad as string | null,
      classification: classification as PurposeGroup["classification"],
      instrumento: row.instrumento as string | null,
      grant_count: count,
      call_count: calls,
      known_amount: amount,
      unknown_amount_count: unknown,
      negative_amount_count: negative,
      last_checked:
        typeof row.last_checked === "string" ? row.last_checked : null,
    }
  })
}
