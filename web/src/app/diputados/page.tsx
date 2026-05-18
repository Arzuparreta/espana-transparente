import type { PoliticianWithMemberships } from "@/types"
import { DiputadosFilter } from "@/components/politicians/DiputadosFilter"
import { PageHeader } from "@/components/domain/PageHeader"
import { getDeputyCards } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Diputados",
  description: "Diputados en activo de la XV Legislatura: partido, circunscripción, historial de voto y trayectoria pública.",
}

export default async function DiputadosPage() {
  const politicians = await getDeputyCards()

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Diputados"
        description="Las 350 personas elegidas en las últimas elecciones generales. Aprueban o rechazan las leyes que afectan a tu día a día: impuestos, sanidad, vivienda, justicia. Aquí su partido, provincia e historial de voto."
      />
      <DiputadosFilter politicians={politicians as unknown as PoliticianWithMemberships[]} />
    </div>
  )
}
