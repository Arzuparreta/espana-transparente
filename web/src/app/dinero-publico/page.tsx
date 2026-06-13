import type { Metadata } from "next"
import { PageHeader } from "@/components/domain/PageHeader"
import { MoneyTraceabilityView } from "@/components/views/MoneyTraceabilityView"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Trazabilidad del gasto",
  description:
    "Recorrido del presupuesto hasta los contratos y subvenciones publicados por ministerio.",
  alternates: { canonical: "/dinero-publico" },
}

interface PageProps {
  searchParams?: Promise<{
    year?: string
    section?: string
    program?: string
  }>
}

export default async function PublicMoneyPage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <div className="ui-page-wide space-y-6 sm:space-y-8">
      <PageHeader
        title={metadata.title as string}
        description={metadata.description as string}
      />
      <MoneyTraceabilityView searchParams={params ?? {}} />
    </div>
  )
}
