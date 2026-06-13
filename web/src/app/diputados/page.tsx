import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { PageHeader } from "@/components/domain/PageHeader"
import { SectionViewNav } from "@/components/navigation/SectionViewNav"
import { DeputiesDirectoryView } from "@/components/views/DeputiesDirectoryView"
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
      canonical:
        view === "asistencia"
          ? "/asistencia"
          : view === "divergencias"
            ? "/divergencias"
            : "/diputados",
    },
  }
}

export default async function DiputadosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const view = parseView(params?.view, DEPUTY_VIEWS, "directorio")
  if (view === "asistencia") {
    const redirectParams = new URLSearchParams()
    if (params?.page) redirectParams.set("page", params.page)
    if (params?.party) redirectParams.set("party", params.party)
    if (params?.sort) redirectParams.set("sort", params.sort)
    if (params?.direction) redirectParams.set("direction", params.direction)
    const query = redirectParams.toString()
    permanentRedirect(`/asistencia${query ? `?${query}` : ""}`)
  }
  if (view === "divergencias") {
    permanentRedirect("/divergencias")
  }
  const meta = VIEW_META[view]

  return (
    <div className="ui-page space-y-6 sm:space-y-8">
      <PageHeader title={meta.title} description={meta.description} />
      <SectionViewNav
        label="Vistas de diputados"
        active={view}
        items={[
          { value: "directorio", label: "Directorio", href: "/diputados" },
          { value: "asistencia", label: "Asistencia", href: "/asistencia" },
          { value: "divergencias", label: "Divergencias", href: "/divergencias" },
        ]}
      />

      <DeputiesDirectoryView />
    </div>
  )
}
