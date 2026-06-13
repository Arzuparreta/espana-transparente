import type { Metadata } from "next"
import { PageHeader } from "@/components/domain/PageHeader"
import { DivergenceView } from "@/components/views/DivergenceView"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Divergencias de voto",
  description:
    "Votos distintos a la posición oficial del grupo parlamentario en sesiones con voto nominal.",
  alternates: { canonical: "/divergencias" },
}

export default function DivergencesPage() {
  return (
    <div className="ui-page space-y-6 sm:space-y-8">
      <PageHeader title={metadata.title as string} description={metadata.description as string} />
      <DivergenceView />
    </div>
  )
}
