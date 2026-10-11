import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { ThreadLanding } from "@/components/domain/ThreadLanding"
import { PublicMoneyOverview } from "@/components/chain/PublicMoneyOverview"
import { getFiscalAccounts } from "@/lib/data/fiscal"
import { SectionViewNav } from "@/components/navigation/SectionViewNav"
import { getSectionIndex } from "@/lib/data"
import { MONEY_VIEWS, parseView } from "@/lib/section-views"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

interface PageProps {
  searchParams?: Promise<{
    view?: string | string[]
    year?: string | string[]
    section?: string
    program?: string
  }>
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params = await searchParams
  const view = parseView(params?.view, MONEY_VIEWS, "resumen")
  return view === "trazabilidad"
    ? {
        title: "¿Qué operaciones se asocian a cada ministerio?",
        description:
          "Presupuesto anual y operaciones históricas asociadas por ministerio; alcance y evidencia de cada cruce.",
        alternates: { canonical: "/dinero-publico" },
      }
    : {
        title: "Dinero público",
        description:
          "Cuánto ingresan y gastan las administraciones, qué saldo queda y cómo consultar presupuestos y operaciones con fuentes oficiales.",
        alternates: { canonical: "/dinero" },
      }
}

export default async function DineroThreadPage({ searchParams }: PageProps) {
  const params = await searchParams
  const view = parseView(params?.view, MONEY_VIEWS, "resumen")
  if (view === "trazabilidad") {
    const redirectParams = new URLSearchParams()
    if (typeof params?.year === "string")
      redirectParams.set("year", params.year)
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
        {
          value: "trazabilidad",
          label: "Trazabilidad",
          href: "/dinero-publico",
        },
      ]}
    />
  )

  const [sectionIndex, accounts] = await Promise.all([
    getSectionIndex(),
    getFiscalAccounts(),
  ])
  const citizenThread = {
    ...thread,
    sources: thread.sources.map((source) => {
      const descriptions: Record<string, string> = {
        "/contratos":
          "¿Qué se compra y a quién se adjudica? Operaciones publicadas; no equivalen a pagos.",
        "/subvenciones":
          "¿Qué ayudas se concedieron y a quién? Concesión no equivale a pago.",
        "/fondos-ue":
          "¿Qué beneficiarios figuran en Kohesio? Cobertura de cohesión, no el total de fondos europeos.",
        "/dinero-publico":
          "¿Qué operaciones se asocian a cada ministerio? Explora los vínculos documentados y sus límites.",
      }
      return {
        ...source,
        countUnit: "registros",
        description: descriptions[source.href] ?? source.description,
      }
    }),
  }

  return (
    <ThreadLanding
      thread={citizenThread}
      sectionIndex={sectionIndex}
      fullDescriptions
      introduction={
        <PublicMoneyOverview accounts={accounts} year={params?.year} />
      }
      navigation={navigation}
    />
  )
}
