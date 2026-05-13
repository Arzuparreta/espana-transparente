import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PowerRelRow {
  id: string
  relationship_type: string
  description?: string
  superior?: { full_name: string } | null
  party?: { acronym: string; color: string } | null
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  party_leader: "Líder del partido",
  spokesperson: "Portavoz del grupo parlamentario",
  list_placement: "Controla su puesto en la lista electoral",
  appointed_by: "Nombrado por",
  minister_of: "Ministro/a de",
}

interface PowerChainProps {
  politicianId: string
}

export async function PowerChain({ politicianId }: PowerChainProps) {
  const { data: relationships } = await supabase
    .from("power_relationships")
    .select("*, superior:superior_id(full_name), party:parties(acronym, color)")
    .eq("person_id", politicianId)

  if (!relationships || relationships.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Sin datos de cadena de mando registrados.
        </CardContent>
      </Card>
    )
  }

  // Also check: has this person ever voted against their party?
  const { count: divergences } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("politician_id", politicianId)
    .neq("vote", "Sí") // placeholder — will be refined

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🔗 Cadena de mando</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(relationships as unknown as PowerRelRow[]).map((r) => {
          const superiorName = r.superior?.full_name || "Desconocido"
          const party = r.party
          const relType = RELATIONSHIP_LABELS[r.relationship_type] || r.relationship_type
          const desc = r.description || ""

          return (
            <div key={r.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm">
                {party && (
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: party.color, color: party.color }}
                  >
                    {party.acronym}
                  </Badge>
                )}
                <span className="font-medium">{superiorName}</span>
                <span className="text-muted-foreground">— {relType}</span>
              </div>
              {desc && (
                <p className="text-xs text-muted-foreground ml-7">{desc}</p>
              )}
            </div>
          )
        })}

        {divergences !== null && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            {divergences === 0
              ? "▸ Nunca ha votado contra su grupo parlamentario."
              : `▸ Ha votado contra su grupo en ${divergences} ocasiones.`}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
