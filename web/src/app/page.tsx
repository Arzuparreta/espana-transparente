import type { PoliticianWithMemberships } from "@/types"
import { supabase } from "@/lib/supabase/client"
import { SearchBox } from "@/components/search/SearchBox"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { LogoHero } from "@/components/layout/LogoHero"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { StatGrid } from "@/components/domain/StatGrid"

export const revalidate = 3600

export default async function HomePage() {
  const { data: politicians } = await supabase
    .from("politicians")
    .select("*, politician_memberships!inner(*, party:parties(*))")
    .eq("politician_memberships.is_active", true)
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
    <div className="space-y-8 sm:space-y-12">
      <LogoHero />

      <section className="space-y-5 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {count} personas bajo la lupa
        </h2>
        <p className="mx-auto max-w-3xl text-balance text-base leading-7 text-muted-foreground">
          Datos objetivos del Congreso de los Diputados. Sin filtros. Sin editoriales.
          Cada voto, cada declaración, cada contrato, enlazado a la persona que lo decide.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {parties?.map((p) => (
            <PartyBadge key={p.acronym} acronym={p.acronym} color={p.color} />
          ))}
        </div>
      </section>

      <SearchBox />

      <StatGrid
        items={[
          {
            label: "Entidad de análisis",
            value: `${count ?? 0}`,
            hint: "Políticos indexados con ficha propia y relaciones trazables.",
          },
          {
            label: "Unidad de lectura",
            value: "La persona",
            hint: "Nunca el partido como actor abstracto.",
          },
          {
            label: "Señal prioritaria",
            value: "La excepción",
            hint: "La divergencia frente al bloque uniforme.",
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
