import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BudgetType } from "@/lib/data"

interface BudgetStatusBannerProps {
  year: number
  label: string
  note: string
  budgetType: BudgetType
}

const toneClasses: Record<BudgetType, string> = {
  ley: "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-50",
  prorroga:
    "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-50",
  proyecto:
    "border-slate-300 bg-slate-50/80 text-slate-950 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-50",
}

const badgeClasses: Record<BudgetType, string> = {
  ley: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100",
  prorroga:
    "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  proyecto:
    "border-slate-300 bg-slate-200 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
}

const titles: Record<BudgetType, string> = {
  ley: "Presupuesto aprobado",
  prorroga: "Presupuesto en vigor por prórroga",
  proyecto: "Proyecto no aprobado",
}

export function BudgetStatusBanner({
  year,
  label,
  note,
  budgetType,
}: BudgetStatusBannerProps) {
  return (
    <section className={cn("rounded-[2px] border px-4 py-4 sm:px-5", toneClasses[budgetType])}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-semibold">{titles[budgetType]} · {year}</div>
          <p className="text-sm leading-6 opacity-90">{note}</p>
        </div>
        <Badge variant="outline" className={cn("shrink-0", badgeClasses[budgetType])}>
          {label}
        </Badge>
      </div>
    </section>
  )
}
