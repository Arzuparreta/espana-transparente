import type { Metadata } from "next"
import { PageHeader } from "@/components/domain/PageHeader"
import { MunicipalSpendingView } from "@/components/views/MunicipalSpendingView"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Gasto municipal",
  description: "Contratos y subvenciones con municipio o entidad local resoluble en las fuentes.",
  alternates: { canonical: "/municipios" },
}

export default function MunicipalitiesPage() {
  return (
    <div className="ui-page-wide space-y-6 sm:space-y-8">
      <PageHeader title={metadata.title as string} description={metadata.description as string} />
      <MunicipalSpendingView />
    </div>
  )
}
