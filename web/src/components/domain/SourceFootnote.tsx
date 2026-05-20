import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

export interface SourceFootnoteProps {
  sourceLabel: string
  sourceHref?: string
  lastChecked?: string | null
  latestRecordDate?: string | null
  coverageLabel?: string | null
  coverageValue?: number | null
  statusHref?: string | null
  className?: string
}

const SIN_VERIFICAR = "Sin verificar"

function formatDate(value: string | null | undefined): string {
  if (!value) return SIN_VERIFICAR
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return SIN_VERIFICAR
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

function formatPercent(value: number): string {
  const clamped = clampPercent(value)
  const fixed = Number.isInteger(clamped) ? clamped.toString() : clamped.toFixed(1)
  return `${fixed}%`
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
        {label}
      </span>
      <span className="min-w-0 truncate text-foreground">{children}</span>
    </div>
  )
}

export function SourceFootnote({
  sourceLabel,
  sourceHref,
  lastChecked,
  latestRecordDate,
  coverageLabel,
  coverageValue,
  statusHref = "/estado-datos",
  className,
}: SourceFootnoteProps) {
  const hasCoverage =
    (coverageLabel && coverageLabel.trim().length > 0) ||
    (coverageValue != null && Number.isFinite(coverageValue))

  return (
    <aside
      aria-label="Fuente y frescura"
      className={cn(
        "rounded-[2px] border border-border/70 bg-card/55 px-4 py-3 text-sm leading-6",
        className
      )}
    >
      <div className="flex flex-col gap-y-1.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-5 sm:gap-y-1">
        <Field label="Fuente oficial">
          {sourceHref ? (
            <a
              href={sourceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {sourceLabel}
            </a>
          ) : (
            sourceLabel
          )}
        </Field>

        <Field label="Última verificación">
          <span className="font-mono tabular-nums">{formatDate(lastChecked)}</span>
        </Field>

        {latestRecordDate !== undefined ? (
          <Field label="Último dato">
            <span className="font-mono tabular-nums">{formatDate(latestRecordDate)}</span>
          </Field>
        ) : null}

        {hasCoverage ? (
          <Field label="Cobertura">
            <span>
              {coverageLabel ? <span>{coverageLabel}</span> : null}
              {coverageLabel && coverageValue != null ? (
                <span className="mx-1 text-muted-foreground/60">·</span>
              ) : null}
              {coverageValue != null && Number.isFinite(coverageValue) ? (
                <span className="font-mono tabular-nums">{formatPercent(coverageValue)}</span>
              ) : null}
            </span>
          </Field>
        ) : null}

        {statusHref ? (
          <ResponsiveLink
            href={statusHref}
            className="sm:ml-auto inline-flex shrink-0 items-baseline font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver estado de los datos →
          </ResponsiveLink>
        ) : null}
      </div>
    </aside>
  )
}
