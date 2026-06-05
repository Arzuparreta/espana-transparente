import { ThreadLanding, ThreadAnchorCard } from "@/components/domain/ThreadLanding"
import { PurchasingPowerCalculator } from "@/components/indicators/PurchasingPowerCalculator"
import { getIndicators, getIpcIndexSeries, getLatestInflationAnchor, getSectionIndex } from "@/lib/data"
import { getThread } from "@/lib/thread-config"
import type { ReactNode } from "react"

export const revalidate = 3600

export const metadata = {
  title: "Economía",
  description: "IPC, deuda pública, PIB, empleo y salario medio con series públicas y explicación ciudadana.",
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  })
}

function formatLatest(value: number, unit: string | null): string {
  if (unit === "%") return formatPercent(value)
  if (unit === "millones EUR") {
    // 1,698,224 M€ → "1,7 B€" (billones)
    const billones = value / 1_000_000
    return `${billones.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} B€`
  }
  return value.toLocaleString("es-ES", { maximumFractionDigits: 1 })
}

export default async function EconomiaThreadPage() {
  const thread = getThread("economia")
  const [sectionIndex, inflation, rows, ipcSeries] = await Promise.all([
    getSectionIndex(),
    getLatestInflationAnchor(),
    getIndicators(),
    getIpcIndexSeries(),
  ])

  const latestByCode = new Map<string, { name: string; value: number; unit: string | null; period: string }>()
  for (const row of rows) {
    const current = latestByCode.get(row.indicator_code)
    if (!current || row.period > current.period) {
      latestByCode.set(row.indicator_code, {
        name: row.indicator_name,
        value: Number(row.value),
        unit: row.unit ?? null,
        period: row.period,
      })
    }
  }

  const debt = latestByCode.get("DEUDA_PUBLICA")
  const unemployment = latestByCode.get("TASA_PARO")
  const anchors: ReactNode[] = []

  if (inflation) {
    anchors.push(
      <ThreadAnchorCard
        key="ipc"
        label={`IPC mensual · ${formatPeriod(inflation.period)}`}
        value={formatPercent(inflation.monthlyValue)}
        description={
          inflation.annualValue != null
            ? `Variación anual: ${formatPercent(inflation.annualValue)}.`
            : "Serie mensual nacional."
        }
        source="Fuente: INE, serie nacional del IPC."
        href="/indicadores/IPC_VAR_MENSUAL"
        linkLabel="Ver serie →"
      />
    )
  }

  if (debt) {
    anchors.push(
      <ThreadAnchorCard
        key="deuda"
        label={`Deuda pública · ${debt.period.slice(0, 4)}`}
        value={formatLatest(debt.value, debt.unit)}
        description="Deuda pública consolidada de las Administraciones Públicas, en billones de euros."
        source="Fuente: Eurostat · criterio de Maastricht."
        href="/indicadores/DEUDA_PUBLICA"
        linkLabel="Ver serie →"
      />
    )
  }

  if (unemployment) {
    anchors.push(
      <ThreadAnchorCard
        key="paro"
        label={`Tasa de paro · ${unemployment.period}`}
        value={formatLatest(unemployment.value, unemployment.unit)}
        description="Porcentaje de población activa en paro."
        source="Fuente: INE."
        href="/indicadores/TASA_PARO"
        linkLabel="Ver serie →"
      />
    )
  }

  return (
    <ThreadLanding
      thread={thread}
      sectionIndex={sectionIndex}
      anchors={anchors}
      feature={
        ipcSeries.length > 1 ? (
          <PurchasingPowerCalculator series={ipcSeries} />
        ) : null
      }
    />
  )
}
