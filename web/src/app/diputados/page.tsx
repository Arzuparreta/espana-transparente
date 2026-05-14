import type { PoliticianWithMemberships } from "@/types"
import { supabase } from "@/lib/supabase/client"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { PageHeader } from "@/components/domain/PageHeader"

export const revalidate = 3600

export default async function DiputadosPage() {
  const { data: politicians } = await supabase
    .from("politicians")
    .select("*, politician_memberships!inner(*, party:parties(*))")
    .eq("politician_memberships.is_active", true)
    .order("full_name")

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Diputados"
        description="Diputados y diputadas en activo de la XV Legislatura. Cada ficha incluye partido, circunscripción, trayectoria, historial de voto y cadena de mando."
      />
      <div className="ui-grid-cards">
        {(politicians as PoliticianWithMemberships[])?.map((p) => (
          <PoliticianCard key={p.id} politician={p} />
        ))}
      </div>
    </div>
  )
}
