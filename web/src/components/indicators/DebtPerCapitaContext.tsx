import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IndicatorSparkline } from "@/components/indicators/IndicatorSparkline"
import type { DebtContext, PerCapitaPoint } from "@/lib/debt-per-capita"

interface DebtPerCapitaContextProps {
  context: DebtContext
  series: PerCapitaPoint[]
  annualSalary?: number | null
}

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function DebtPerCapitaContext({
  context,
  series,
  annualSalary,
}: DebtPerCapitaContextProps) {
  const sparklinePoints = series
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((p) => ({ period: p.period, value: p.perCapita }))

  const months =
    annualSalary && annualSalary > 0
      ? context.latestPerCapita / (annualSalary / 12)
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tu parte de la deuda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
              Deuda per cápita · {context.latestPeriod.slice(0, 4)}
            </div>
            <div className="mt-1 font-mono text-4xl font-medium tracking-tight">
              {euroFormatter.format(context.latestPerCapita)}
            </div>
            <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">
              Si la deuda pública total se repartiera por igual entre todos los habitantes de España,
              a cada persona le correspondería esta cantidad. Incluye deuda del Estado, comunidades autónomas,
              corporaciones locales y Seguridad Social.
            </p>
          </div>
          {context.changePercent10Y != null && (
            <div className="shrink-0 text-right">
              <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
                En 10 años
              </div>
              <div
                className={`mt-1 font-mono text-2xl font-medium tracking-tight ${
                  context.changePercent10Y > 0 ? "text-accent" : "text-green-500"
                }`}
              >
                {context.changePercent10Y > 0 ? "+" : ""}
                {percentFormatter.format(context.changePercent10Y)}%
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {context.tenYearsAgoPeriod
                  ? `Desde ${context.tenYearsAgoPeriod.slice(0, 4)}`
                  : ""}
              </div>
            </div>
          )}
        </div>

        {sparklinePoints.length > 1 && (
          <div className="space-y-1">
            <IndicatorSparkline points={sparklinePoints} className="text-foreground/85" />
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>{sparklinePoints[0].period.slice(0, 4)}</span>
              <span>{sparklinePoints[sparklinePoints.length - 1].period.slice(0, 4)}</span>
            </div>
          </div>
        )}

        {months != null && months > 0 && (
          <div className="rounded-[2px] border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
            <span className="font-medium">Contexto:</span>{" "}
            <span className="text-muted-foreground">
              Esta cantidad equivale a aproximadamente{" "}
              <span className="font-mono font-medium text-foreground">
                {months.toFixed(1)}
              </span>{" "}
              meses del salario medio bruto anual en España.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
