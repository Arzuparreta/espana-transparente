import Link from "next/link"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/domain/PageHeader"
import { CohesionProgrammeView } from "@/components/chain/CohesionProgramme"
import { getCohesionProgrammes } from "@/lib/data/cohesion-program"
export const revalidate = 3600
export const metadata = { title: "Fases del programa FEDER" }
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ cci: string }>
  searchParams?: Promise<{
    implementationYear?: string | string[]
    paymentYear?: string | string[]
  }>
}) {
  const { cci } = await params
  if (!/^2014ES16RF(?:OP|SM)\d{3}$/.test(cci)) notFound()
  const { snapshot, error } = await getCohesionProgrammes()
  if (error)
    return (
      <div className="ui-page">
        <p role="alert">
          No se ha podido consultar el programa. No significa ausencia de
          financiación.
        </p>
        <Link href="/fondos-ue/cohesion" className="underline">
          Volver a programas
        </Link>
      </div>
    )
  if (!snapshot)
    return (
      <div className="ui-page">
        <p role="status">No hay una edición disponible.</p>
      </div>
    )
  const programme = snapshot.programmes.find((p) => p.cci === cci)
  if (!programme) notFound()
  const context = await searchParams
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title={`¿Qué fases financieras acredita el programa ${cci}?`}
        description="El CCI identifica el programa. Costes UE más nacionales y transferencias netas UE conservan sus denominadores y periodos."
      />
      <CohesionProgrammeView
        snapshot={snapshot}
        programme={programme}
        implementationYear={context?.implementationYear}
        paymentYear={context?.paymentYear}
      />
    </div>
  )
}
