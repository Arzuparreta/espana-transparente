import type { PoliticianWithMemberships } from "@/types"
import { supabase } from "@/lib/supabase/client"
import { SearchBox } from "@/components/search/SearchBox"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { LogoHero } from "@/components/layout/LogoHero"
import { DivergenceFeed } from "@/components/votes/DivergenceFeed"

export const revalidate = 3600

export default async function HomePage() {
  const { data: politicians } = await supabase
    .from("politicians")
    .select("*, politician_memberships(*, party:parties(*))")
    .order("full_name")
    .limit(24)

  const { count } = await supabase
    .from("politicians")
    .select("*", { count: "exact", head: true })

  const { data: parties } = await supabase
    .from("parties")
    .select("acronym, color, name")
    .order("acronym")

  return (
    <div className="space-y-12">
      <LogoHero />

      <section className="text-center space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          {count} políticos bajo la lupa
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Datos objetivos del Congreso de los Diputados. Sin filtros. Sin editoriales.
          Cada voto, cada declaración, cada contrato, enlazado a la persona que lo decide.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {parties?.map((p) => (
            <span
              key={p.acronym}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ borderColor: p.color + "40", color: p.color }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: p.color }}
              />
              {p.acronym}
            </span>
          ))}
        </div>
      </section>

      <SearchBox />

      <DivergenceFeed />

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(politicians as unknown as PoliticianWithMemberships[])?.map((p) => (
            <PoliticianCard key={p.id} politician={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
