import type { Metadata } from "next"
import { PageHeader } from "@/components/domain/PageHeader"
import { AutonomicSpendingView } from "@/components/views/AutonomicSpendingView"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Gasto autonómico",
  description: "Contratos y subvenciones con territorio autonómico resoluble en las fuentes.",
  alternates: { canonical: "/ccaa" },
}

export default function AutonomousCommunitiesPage() {
  return (
    <div className="ui-page-wide space-y-6 sm:space-y-8">
      <PageHeader title={metadata.title as string} description={metadata.description as string} />
      <AutonomicSpendingView />
    </div>
  )
}
