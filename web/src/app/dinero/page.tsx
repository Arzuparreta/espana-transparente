import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { ThreadLanding, ThreadAnchorCard } from "@/components/domain/ThreadLanding"
import { SectionViewNav } from "@/components/navigation/SectionViewNav"
import { getSectionIndex, getTopContractOfMonth, getEuFundsSummary, getMoneyDataOverview } from "@/lib/data"
import { MONEY_VIEWS, parseView } from "@/lib/section-views"
import { getThread } from "@/lib/thread-config"
import type { ReactNode } from "react"

export const revalidate = 3600

interface PageProps {
  searchParams?: Promise<{
    view?: string | string[]
    year?: string
    section?: string
    program?: string
  }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  const view = parseView(params?.view, MONEY_VIEWS, "resumen")
  return view === "trazabilidad"
    ? {
        title: "Trazabilidad del gasto",
        description:
          "Recorrido del presupuesto hasta los contratos y subvenciones publicados por ministerio.",
        alternates: { canonical: "/dinero-publico" },
      }
    : {
        title: "Dinero",
        description: "Presupuestos, contratos, subvenciones y fondos europeos conectados por fuente pública.",
        alternates: { canonical: "/dinero" },
      }
}

function formatAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Sin dato"
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

export default async function DineroThreadPage({ searchParams }: PageProps) {
  const params = await searchParams
  const view = parseView(params?.view, MONEY_VIEWS, "resumen")
  if (view === "trazabilidad") {
    const redirectParams = new URLSearchParams()
    if (params?.year) redirectParams.set("year", params.year)
    if (params?.section) redirectParams.set("section", params.section)
    if (params?.program) redirectParams.set("program", params.program)
    const query = redirectParams.toString()
    permanentRedirect(`/dinero-publico${query ? `?${query}` : ""}`)
  }
  const thread = getThread("dinero")

  const navigation = (
    <SectionViewNav
      label="Vistas de dinero"
      active={view}
      items={[
        { value: "resumen", label: "Explorar", href: "/dinero" },
        { value: "trazabilidad", label: "Trazabilidad", href: "/dinero-publico" },
      ]}
    />
  )

  const [sectionIndex, topContract, euSummary, overview] = await Promise.all([
    getSectionIndex(),
    getTopContractOfMonth(),
    getEuFundsSummary(),
    getMoneyDataOverview(),
  ])
  const totalMoneyRows = overview.coverage.reduce((sum, row) => sum + Number(row.total_rows ?? 0), 0)
  const anchors: ReactNode[] = []

  if (totalMoneyRows > 0) {
    anchors.push(
      <ThreadAnchorCard
        key="registros"
        label="Registros de gasto"
        value={totalMoneyRows.toLocaleString("es-ES")}
        description="Contratos, subvenciones y fondos europeos normalizados para consulta transversal."
        href="/dinero-publico"
        linkLabel="Ver trazabilidad →"
      />
    )
  }

  if (topContract?.amount != null) {
    anchors.push(
      <ThreadAnchorCard
        key="contrato"
        label={`Mayor contrato · ${windowLabel(topContract.windowDays)}`}
        value={formatAmount(topContract.amount)}
        description={
          <>
            <span className="line-clamp-2 font-medium">
              {topContract.title}
            </span>
            {topContract.awarding_body ? (
              <span className="mt-1 block text-xs line-clamp-1">
                {topContract.awarding_body}
              </span>
            ) : null}
          </>
        }
        href={`/contratos/${topContract.id}`}
        linkLabel="Ver contrato →"
      />
    )
  }

  if (euSummary) {
    anchors.push(
      <ThreadAnchorCard
        key="ue"
        label="Fondos europeos"
        value={formatAmount(Number(euSummary.total_eu_budget))}
        description={`${Number(euSummary.beneficiary_count).toLocaleString("es-ES")} beneficiarios españoles en Kohesio.`}
        source="Fuente: Comisión Europea · Kohesio."
        href="/fondos-ue"
        linkLabel="Ver fondos UE →"
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
