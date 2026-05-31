import { AnchorCard } from "@/components/domain/AnchorCard"
import type { InflationAnchor, TopContractAncla, TopBudgetSectionAncla } from "@/lib/data"

interface HomePanoramaProps {
  deudaPerCapita: number | null
  deudaYear: string | null
  topContract: TopContractAncla | null
  inflation: InflationAnchor | null
  budgetAnchor: TopBudgetSectionAncla | null
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function windowLabel(days: 30 | 60 | 90 | null): string {
  if (days === 30) return "últimos 30 días"
  if (days === 60) return "últimos 60 días"
  if (days === 90) return "últimos 90 días"
  return "histórico"
}

export function HomePanorama({
  deudaPerCapita,
  deudaYear,
  topContract,
  inflation,
  budgetAnchor,
}: HomePanoramaProps) {
  const cards: React.ReactNode[] = []

  if (deudaPerCapita != null) {
    cards.push(
      <AnchorCard
        key="deuda"
        variant="compact"
        label={`Deuda pública por ciudadano${deudaYear ? ` · ${deudaYear}` : ""}`}
        value={`${deudaPerCapita.toLocaleString("es-ES")} €`}
        description="Deuda consolidada de las administraciones públicas dividida entre la población. No es tu deuda personal, pero es la que el Estado contrae en tu nombre."
        source="Fuente: Eurostat · criterio de Maastricht."
        href="/indicadores/DEUDA_PUBLICA"
        linkLabel="Ver serie histórica →"
      />
    )
  }

  if (inflation) {
    const sign = inflation.monthlyValue > 0 ? "+" : ""
    const valueLabel = `${sign}${inflation.monthlyValue.toLocaleString("es-ES", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`
    const [year, month] = inflation.period.split("-")
    const periodLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
      "es-ES",
      { month: "long", year: "numeric" }
    )

    const annualSuffix =
      inflation.annualValue != null
        ? ` La variación interanual es del ${inflation.annualValue > 0 ? "+" : ""}${inflation.annualValue.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%.`
        : ""

    cards.push(
      <AnchorCard
        key="ipc"
        variant="compact"
        label={`IPC · ${periodLabel}`}
        value={valueLabel}
        description={`Variación mensual del índice general de precios al consumo.${annualSuffix}`}
        source="Fuente: INE · serie nacional del IPC."
        href="/indicadores/IPC_VAR_MENSUAL"
        linkLabel="Ver serie →"
      />
    )
  }

  if (topContract?.amount != null) {
    cards.push(
      <AnchorCard
        key="contrato"
        variant="compact"
        label={`Mayor contrato · ${windowLabel(topContract.windowDays)}`}
        value={formatAmount(topContract.amount)}
        description={
          <>
            <span className="line-clamp-2 font-medium">{topContract.title}</span>
            {topContract.contractor ? (
              <span className="mt-1 block text-xs line-clamp-1 text-muted-foreground">
                Adjudicatario: {topContract.contractor}
              </span>
            ) : null}
          </>
        }
        source="Fuente: Plataforma de Contratación del Sector Público."
        href={`/contratos/${topContract.id}`}
        linkLabel="Ver contrato →"
      />
    )
  }

  if (budgetAnchor) {
    cards.push(
      <AnchorCard
        key="presupuesto"
        variant="compact"
        label={`Presupuesto · ${budgetAnchor.year}`}
        value={formatAmount(budgetAnchor.total_credit_initial)}
        description={
          <>
            <span className="line-clamp-2 font-medium">{budgetAnchor.section_name}</span>
            {budgetAnchor.minister_name ? (
              <span className="mt-1 block text-xs line-clamp-1 text-muted-foreground">
                Responsable: {budgetAnchor.minister_name}
              </span>
            ) : null}
          </>
        }
        source={`Fuente: SEPG · ${budgetAnchor.statusLabel ?? "PGE"}.`}
        href={`/presupuestos/${encodeURIComponent(budgetAnchor.section_code)}?year=${budgetAnchor.in_force_year ?? budgetAnchor.year}`}
        linkLabel="Ver partida →"
      />
    )
  }

  const visibleCards = cards.slice(0, 3)
  if (visibleCards.length === 0) return null

  const gridCols =
    visibleCards.length === 1
      ? ""
      : visibleCards.length === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-3"

  return (
    <section>
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        En cifras
      </p>
      <div className={`grid gap-3 ${gridCols}`.trim()}>
        {visibleCards}
      </div>
    </section>
  )
}
