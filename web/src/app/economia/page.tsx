import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/domain/PageHeader"
import { ThreadAnchorCard, ThreadLanding } from "@/components/domain/ThreadLanding"
import { IpcBasketCalculator } from "@/components/indicators/IpcBasketCalculator"
import { PurchasingPowerCalculator } from "@/components/indicators/PurchasingPowerCalculator"
import { SalaryVsIpcCalculator } from "@/components/indicators/SalaryVsIpcCalculator"
import { SectionViewNav } from "@/components/navigation/SectionViewNav"
import {
  getIndicators,
  getIpcIndexSeries,
  getIpcSubgroupSeries,
  getLatestInflationAnchor,
  getSectionIndex,
} from "@/lib/data"
import { getPopulationForYear } from "@/lib/debt-per-capita"
import { ECONOMY_VIEWS, parseView } from "@/lib/section-views"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

interface PageProps {
  searchParams?: Promise<{ view?: string | string[] }>
}

const VIEW_META = {
  resumen: {
    title: "Economía",
    description: "Precios, deuda, empleo, salarios y actividad con datos públicos.",
  },
  // "series" now lives at /indicadores; kept here so old /economia?view=series
  // links parse and redirect instead of falling back to "resumen".
  series: {
    title: "Series económicas",
    description: "IPC, PIB, empleo, salarios y deuda con su último dato y evolución histórica.",
  },
  calculadoras: {
    title: "Calculadoras económicas",
    description: "Herramientas basadas en las series oficiales del IPC para comparar importes y poder adquisitivo.",
  },
} as const

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  const view = parseView(params?.view, ECONOMY_VIEWS, "resumen")
  return {
    ...VIEW_META[view],
    alternates: {
      canonical: view === "resumen" ? "/economia" : `/economia?view=${view}`,
    },
  }
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
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  })
}

function formatLatest(value: number, unit: string | null): string {
  if (unit === "%") return formatPercent(value)
  if (unit === "millones EUR") {
    return `${(value / 1_000_000).toLocaleString("es-ES", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} B€`
  }
  return value.toLocaleString("es-ES", { maximumFractionDigits: 1 })
}

export default async function EconomiaPage({ searchParams }: PageProps) {
  const params = await searchParams
  const view = parseView(params?.view, ECONOMY_VIEWS, "resumen")

  if (view === "series") {
    permanentRedirect("/indicadores")
  }

  const navigation = (
    <SectionViewNav
      label="Vistas de economía"
      active={view}
      items={[
        { value: "resumen", label: "Explorar", href: "/economia" },
        { value: "series", label: "Series", href: "/indicadores" },
        { value: "calculadoras", label: "Calculadoras", href: "/economia?view=calculadoras" },
      ]}
    />
  )

  if (view === "calculadoras") {
    const [ipcSeries, ipcSubgroups] = await Promise.all([
      getIpcIndexSeries(),
      getIpcSubgroupSeries(),
    ])
    return (
      <div className="ui-page-wide space-y-6 sm:space-y-8">
        <PageHeader {...VIEW_META.calculadoras} />
        {navigation}
        {ipcSeries.length > 1 ? (
          <div className="space-y-6">
            <IpcBasketCalculator series={ipcSubgroups} />
            <SalaryVsIpcCalculator series={ipcSeries} />
            <PurchasingPowerCalculator series={ipcSeries} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Las series necesarias no están disponibles.</p>
        )}
      </div>
    )
  }

  const thread = getThread("economia")
  const [sectionIndex, inflation, rows] = await Promise.all([
    getSectionIndex(),
    getLatestInflationAnchor(),
    getIndicators(),
  ])
  const latestByCode = new Map<string, { value: number; unit: string | null; period: string }>()
  for (const row of rows) {
    const current = latestByCode.get(row.indicator_code)
    if (!current || row.period > current.period) {
      latestByCode.set(row.indicator_code, {
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
        description="Deuda pública consolidada de las Administraciones Públicas."
        source="Fuente: Eurostat · criterio de Maastricht."
        href="/indicadores/DEUDA_PUBLICA"
        linkLabel="Ver serie →"
      />
    )
    const year = Number(debt.period.slice(0, 4))
    const populationMillions = getPopulationForYear(year)
    if (populationMillions > 0) {
      anchors.push(
        <ThreadAnchorCard
          key="deuda-per-capita"
          label={`Deuda per cápita · ${year}`}
          value={new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(debt.value / populationMillions)}
          description="Deuda pública total dividida entre la población."
          source="Fuente: Eurostat + estimación INE."
          href="/indicadores/DEUDA_PUBLICA"
          linkLabel="Ver contexto →"
        />
      )
    }
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
      navigation={navigation}
    />
  )
}
