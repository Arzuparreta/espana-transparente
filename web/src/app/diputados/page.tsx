import type { PoliticianWithMemberships } from "@/types"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { PageHeader } from "@/components/domain/PageHeader"
import { getDeputyCards } from "@/lib/data"

export const revalidate = 3600

export default async function DiputadosPage() {
  const politicians = await getDeputyCards()

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Diputados"
        description="Diputados y diputadas en activo de la XV Legislatura. Cada ficha incluye partido, circunscripción, trayectoria, historial de voto y relaciones registradas."
      />
      <div className="ui-grid-cards">
        {(politicians as unknown as PoliticianWithMemberships[]).map((p) => (
          <PoliticianCard key={p.id} politician={p} />
        ))}
      </div>
    </div>
  )
}
