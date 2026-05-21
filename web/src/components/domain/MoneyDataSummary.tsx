import { ResponsiveLink } from "@/components/navigation/NavigationProgress"

type CoverageRow = {
  administration_level: string
  total_rows: number
  resolved_rows: number
  unresolved_rows: number
  conflict_rows: number
  coverage_start_date: string | null
  latest_record_date: string | null
}

interface MoneyDataSummaryProps {
  datasetHref: string
  rows: CoverageRow[]
  total: {
    total_rows: number
    resolved_rows: number
    unresolved_rows: number
    conflict_rows: number
    coverage_start_date: string | null
    latest_record_date: string | null
  }
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function levelLabel(value: string) {
  switch (value) {
    case "state":
      return "Estado"
    case "autonomic":
      return "CCAA"
    case "municipal":
      return "Municipios"
    default:
      return "Sin clasificar"
  }
}

export function MoneyDataSummary({ datasetHref, rows, total }: MoneyDataSummaryProps) {
  const resolvedPct =
    total.total_rows > 0 ? Math.round((total.resolved_rows / total.total_rows) * 100) : 0

  return (
    <section className="rounded-[2px] border border-border/70 bg-card/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium">Estado de datos</div>
          <p className="text-sm text-muted-foreground">
            {resolvedPct}% con responsable resuelto · última actualización {formatDate(total.latest_record_date)} ·
            cobertura desde {formatDate(total.coverage_start_date)}
          </p>
        </div>
        <ResponsiveLink
          href="/estado-datos"
          className="text-sm font-medium underline-offset-2 hover:underline"
        >
          Ver detalle →
        </ResponsiveLink>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={`${datasetHref}-${row.administration_level}`} className="rounded-[2px] border border-border/60 bg-background/70 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {levelLabel(row.administration_level)}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{row.resolved_rows}/{row.total_rows}</div>
            <div className="text-xs text-muted-foreground">
              {row.unresolved_rows} sin resolver · {row.conflict_rows} conflictos
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
