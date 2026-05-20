export const SIN_VERIFICAR = "Sin verificar"

export function formatSourceDate(value: string | null | undefined): string {
  if (!value) return SIN_VERIFICAR
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return SIN_VERIFICAR
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

export function formatCoveragePercent(value: number): string {
  const clamped = clampPercent(value)
  const fixed = Number.isInteger(clamped) ? clamped.toString() : clamped.toFixed(1)
  return `${fixed}%`
}
