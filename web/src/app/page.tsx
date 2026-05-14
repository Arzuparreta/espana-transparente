import type { PoliticianWithMemberships } from "@/types"
import { supabase } from "@/lib/supabase/client"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { LogoHero } from "@/components/layout/LogoHero"
import { StatGrid } from "@/components/domain/StatGrid"

export const revalidate = 3600

export default async function HomePage() {
  const { data: politicians } = await supabase
    .from("politicians")
    .select("*, politician_memberships!inner(*, party:parties(*))")
    .eq("politician_memberships.is_active", true)
    .order("full_name")
    .limit(24)

  const { count: politicianCount } = await supabase
    .from("politicians")
    .select("*", { count: "exact", head: true })

  const { data: parties } = await supabase
    .from("parties")
    .select("acronym, color, name")
    .order("acronym")

  const { count: sessionsCount } = await supabase
    .from("voting_sessions")
    .select("*", { count: "exact", head: true })

  return (
    <div className="space-y-8 sm:space-y-12">
      <LogoHero parties={parties ?? []} />

      <StatGrid
        items={[
          {
            label: "Diputados",
            value: `${politicianCount ?? 0}`,
            hint: "Con ficha individual, trayectoria y cadena de mando.",
          },
          {
            label: "Partidos",
            value: `${parties?.length ?? 0}`,
            hint: "Con representación en la XV Legislatura.",
          },
          {
            label: "Votaciones",
            value: `${sessionsCount ?? 0}`,
            hint: "Sesiones con voto individual desglosado por diputado.",
          },
        ]}
      />

      <section>
        <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Diputados destacados</h3>
            <p className="text-sm text-muted-foreground">
              Muestra inicial para entrar en perfiles, trayectorias y cadenas de mando.
            </p>
          </div>
        </div>
        <div className="ui-grid-cards">
          {(politicians as unknown as PoliticianWithMemberships[])?.map((p) => (
            <PoliticianCard key={p.id} politician={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
