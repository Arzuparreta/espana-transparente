import Link from "next/link"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { getDusProgram } from "@/lib/data/prtr-program"
import {
  DUS_PROGRAM_URL,
  DUS_LIST_URL,
  dusEuro,
  selectDusProjects,
} from "@/lib/prtr-program"
export const revalidate = 3600
export const metadata = { title: "Expediente DUS 5000 · PRTR" }
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{
    territory?: string | string[]
    q?: string | string[]
    page?: string | string[]
  }>
}) {
  const { id } = await params
  if (!/^PR-D5000-20(?:21|22)-\d{6}[A-Z]?$/.test(id)) notFound()
  const { snapshot, error } = await getDusProgram()
  if (error)
    return (
      <div className="ui-page">
        <p role="alert">
          No se ha podido consultar el expediente. No se interpreta como una
          ayuda inexistente.
        </p>
        <Link href="/fondos-ue/prtr" className="underline">
          Volver al programa
        </Link>
      </div>
    )
  if (!snapshot)
    return (
      <div className="ui-page">
        <p role="status">El listado del programa todavía no está disponible.</p>
      </div>
    )
  const r = snapshot.rows.find((r) => r.id === id)
  if (!r) notFound()
  const territory = snapshot.territories.find((t) => t.code === r.territory)!
  const context = await searchParams
  const returnQuery = new URLSearchParams()
  const contextRows = selectDusProjects(
    snapshot,
    context?.territory,
    context?.q,
  )
  if (contextRows !== null) {
    if (typeof context?.territory === "string")
      returnQuery.set("territory", context.territory)
    if (typeof context?.q === "string") returnQuery.set("q", context.q)
    if (
      typeof context?.page === "string" &&
      /^[1-9]\d{0,4}$/.test(context.page) &&
      Number(context.page) <= Math.max(1, Math.ceil(contextRows.length / 25))
    )
      returnQuery.set("page", context.page)
  }
  const returnHref = `/fondos-ue/prtr${returnQuery.size ? `?${returnQuery}` : ""}`
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title={r.project ?? "Nombre de proyecto no publicado"}
        description={`${r.id} · DUS 5000 · MRR/PRTR · subvención, no préstamo`}
      />
      <h2 className="text-xl font-semibold">
        ¿Qué importe acredita la última resolución publicada?
      </h2>
      <p className="font-mono text-3xl">{dusEuro(r.grant_cents)}</p>
      <p className="text-sm leading-6">
        Ayuda directa concedida según el listado oficial favorable. Última
        resolución: {r.last_resolution}. Puede revisar una concesión anterior;
        no es fecha de pago ni acredita que el proyecto haya terminado.
      </p>
      <dl className="space-y-4">
        <div>
          <dt className="font-semibold">Entidad beneficiaria publicada</dt>
          <dd className="break-words">{r.beneficiary}</dd>
        </div>
        <div>
          <dt className="font-semibold">Municipio / provincia del listado</dt>
          <dd>
            {r.municipality ?? "No publicado"} / {r.province ?? "No publicada"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Comunidad</dt>
          <dd>{territory.label}</dd>
        </div>
      </dl>
      <section className="space-y-3 rounded border p-4">
        <h2 className="text-lg font-semibold">¿Qué fases se pueden seguir?</h2>
        <p className="text-sm leading-6">
          Programa: subvención financiada por el MRR, gestionada por IDAE.
          Expediente: importe concedido publicado. Pago, anticipo, justificación
          y cierre de este expediente: sin evidencia individual incorporada en
          este piloto. No se presentan como cero ni como fases completadas.
        </p>
        <p className="text-sm leading-6">
          La coincidencia de beneficiario con contratos, ayudas BDNS o Kohesio
          no demuestra que financien este mismo proyecto. Tampoco se atribuye la
          resolución a una persona por ocupar entonces un cargo.
        </p>
        <a
          href={DUS_PROGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Consultar programa y normas de concesión/justificación
        </a>
      </section>
      <SourceFootnote
        sourceLabel="IDAE · listado de resoluciones favorables D5000 · buscar el identificador completo"
        sourceHref={DUS_LIST_URL}
        lastChecked={snapshot.retrieved_at}
        coverageLabel="Importe de la última resolución publicada, no pago"
      />
      <Link href={returnHref} className="text-sm underline">
        Volver a la consulta de expedientes
      </Link>
      <Link
        href={`/fondos-ue/prtr?territory=${r.territory}`}
        className="text-sm underline"
      >
        Ver expedientes publicados en esta comunidad
      </Link>
    </div>
  )
}
