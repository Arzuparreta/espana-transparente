import type { Metadata } from "next"
import { PageHeader } from "@/components/domain/PageHeader"
import { SectionViewNav } from "@/components/navigation/SectionViewNav"
import { AttendanceView } from "@/components/views/AttendanceView"
import { DeputiesDirectoryView } from "@/components/views/DeputiesDirectoryView"
import { DivergenceView } from "@/components/views/DivergenceView"
import { DEPUTY_VIEWS, parseView } from "@/lib/section-views"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams?: Promise<{
    view?: string | string[]
    page?: string
    party?: string
    sort?: string
    direction?: string
  }>
}

const VIEW_META = {
  directorio: {
    title: "Diputados",
    description:
      "Directorio de las personas elegidas al Congreso, con grupo, circunscripción e historial público.",
  },
  asistencia: {
    title: "Asistencia de diputados",
    description:
      "Sesiones plenarias con voto nominal en las que cada diputado ha emitido al menos un voto.",
  },
  divergencias: {
    title: "Divergencias de voto",
    description:
      "Votos distintos a la posición oficial del grupo parlamentario en sesiones con voto nominal.",
  },
} as const

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  const view = parseView(params?.view, DEPUTY_VIEWS, "directorio")
  return {
    title: VIEW_META[view].title,
    description: VIEW_META[view].description,
    alternates: {
      canonical: view === "directorio" ? "/diputados" : `/diputados?view=${view}`,
    },
  }
}

export default async function DiputadosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const view = parseView(params?.view, DEPUTY_VIEWS, "directorio")
  const meta = VIEW_META[view]

  return (
    <div className="ui-page space-y-6 sm:space-y-8">
      <PageHeader title={meta.title} description={meta.description} />
      <SectionViewNav
        label="Vistas de diputados"
        active={view}
        items={[
          { value: "directorio", label: "Directorio", href: "/diputados" },
          { value: "asistencia", label: "Asistencia", href: "/diputados?view=asistencia" },
          { value: "divergencias", label: "Divergencias", href: "/diputados?view=divergencias" },
        ]}
      />

      {view === "directorio" ? <DeputiesDirectoryView /> : null}
      {view === "asistencia" ? (
        <AttendanceView
          searchParams={Promise.resolve({
            page: params?.page,
            party: params?.party,
            sort: params?.sort,
            direction: params?.direction,
          })}
        />
      ) : null}
      {view === "divergencias" ? <DivergenceView /> : null}
    </div>
  )
}
