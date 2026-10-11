import { PageHeader } from "@/components/domain/PageHeader"
import { FiscalSectors } from "@/components/chain/FiscalSectors"
import { getFiscalSectors } from "@/lib/data/fiscal-sectors"
export const revalidate = 3600
export const metadata = {
  title: "Cuentas públicas por subsector",
  description:
    "Ingresos, gasto y saldo de la administración central, autonómica, local y Seguridad Social.",
}
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string | string[] }>
}) {
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="¿Qué cuentas tiene cada nivel administrativo?"
        description="Ingresos, gasto realizado y saldo del mismo ejercicio. Cada subsector incluye operaciones entre administraciones; el conjunto S13 es consolidado."
      />
      <FiscalSectors
        data={await getFiscalSectors()}
        year={(await searchParams)?.year}
      />
    </div>
  )
}
