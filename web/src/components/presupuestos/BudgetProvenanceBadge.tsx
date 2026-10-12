import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BudgetSourceKind } from "@/lib/data"

interface BudgetProvenanceBadgeProps {
  sourceKind: BudgetSourceKind | string | null | undefined
  sourceYear?: number | null
  inForceYear?: number | null
  className?: string
}

export function BudgetProvenanceBadge({
  sourceKind,
  sourceYear,
  inForceYear,
  className,
}: BudgetProvenanceBadgeProps) {
  if (!sourceKind || sourceKind === "published") return null

  const isCarriedForward = sourceKind === "carried_forward"
  const isPublishedProrroga = sourceKind === "published_prorroga"

  if (!isCarriedForward && !isPublishedProrroga) return null

  const label = isCarriedForward
    ? `Referencia de ${sourceYear ?? "otro ejercicio"}`
    : `Prórroga ${sourceYear ?? "publicada"} · base ${inForceYear ?? "no acreditada"}`

  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
        className
      )}
    >
      {label}
    </Badge>
  )
}

interface BudgetProvenanceNoteProps {
  sourceKind: BudgetSourceKind | string | null | undefined
  className?: string
}

export function BudgetProvenanceNote({ sourceKind, className }: BudgetProvenanceNoteProps) {
  if (sourceKind !== "carried_forward") return null

  return (
    <p className={cn("text-xs leading-5 text-amber-700 dark:text-amber-400", className)}>
      Importe del presupuesto aprobado de 2023 reutilizado como referencia.
      No acredita el crédito inicial actualizado de este ejercicio ni su ejecución o pago.
      Se excluye del total de créditos publicados para la prórroga.
    </p>
  )
}
