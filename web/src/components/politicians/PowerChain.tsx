import { supabase } from "@/lib/supabase/client"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { EntityLink } from "@/components/domain/EntityLink"

const REL_LABELS: Record<string, string> = {
  party_leader: "Responde ante", spokesperson: "Coordinado por",
  list_placement: "En lista por decisión de", appointed_by: "Nombrado por",
}

interface PRRow {
  id: string
  relationship_type: string
  description?: string
  superior_id?: string | null
  superior?: { full_name: string } | null
  party?: { id: string; acronym: string; color: string } | null
}

export async function PowerChain({ politicianId }: { politicianId: string }) {
  const { data: rels } = await supabase
    .from("power_relationships")
    .select("*, superior:superior_id(full_name), party:parties(id, acronym, color)")
    .eq("person_id", politicianId)

  if (!rels || rels.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Sin datos de cadena de mando.</p>
  }

  return (
    <div className="space-y-2">
      {(rels as unknown as PRRow[]).map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-3 text-sm shadow-sm">
          {r.party ? <PartyBadge acronym={r.party.acronym} color={r.party.color} className="text-[11px]" partyId={r.party.id} /> : null}
          <span className="text-muted-foreground text-xs">{REL_LABELS[r.relationship_type] || r.relationship_type}</span>
          {r.superior_id ? (
            <EntityLink kind="politician" id={r.superior_id} className="font-medium underline-offset-2 hover:underline">
              {r.superior?.full_name || "—"}
            </EntityLink>
          ) : (
            <span className="font-medium">{r.superior?.full_name || "—"}</span>
          )}
          {r.description && <span className="text-muted-foreground text-xs hidden sm:inline">· {r.description}</span>}
        </div>
      ))}
    </div>
  )
}
