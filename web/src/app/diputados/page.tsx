import type { PoliticianWithMemberships } from "@/types"
import { supabase } from "@/lib/supabase/client"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"

export const revalidate = 3600

export default async function DiputadosPage() {
  const { data: politicians } = await supabase
    .from("politicians")
    .select("*, politician_memberships(*, party:parties(*))")
    .order("full_name")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Diputados</h1>
        <p className="text-muted-foreground mt-1">
          Todos los diputados y diputadas activos de la XV Legislatura
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(politicians as PoliticianWithMemberships[])?.map((p) => (
          <PoliticianCard key={p.id} politician={p} />
        ))}
      </div>
    </div>
  )
}
