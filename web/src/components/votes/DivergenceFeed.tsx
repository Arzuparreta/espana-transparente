import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const VOTE_COLORS: Record<string, string> = {
  Sí: "#22c55e", No: "#ef4444", Abstención: "#f59e0b", "No vota": "#9ca3af",
}

const PARTY_COLORS: Record<string, string> = {
  PP: "#0055A7", PSOE: "#E01021", VOX: "#63BE21", SUMAR: "#E01065",
  ERC: "#FFB232", JUNTS: "#20C0C2", "EH Bildu": "#00D4AA", "EAJ-PNV": "#008000",
  CCa: "#FFD700", BNG: "#6CB6FF",
}

export async function DivergenceFeed() {
  const { data, error } = await supabase.rpc("get_divergences")

  if (error || !data || data.length === 0) return null

  // Group by name + initiative to avoid showing same divergence twice
  const seen = new Set<string>()

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          ⚠️ Votaron distinto a su grupo
          <Badge variant="outline" className="text-xs ml-1">
            {data.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {data.slice(0, 15).map((d: Record<string, string>, i: number) => {
            const key = `${d.full_name}-${d.initiative}`
            if (seen.has(key)) return null
            seen.add(key)

            const partyColor = PARTY_COLORS[d.acronym] || "#718096"
            const votedColor = VOTE_COLORS[d.voted] || "#9ca3af"
            const partyVotedColor = VOTE_COLORS[d.party_voted] || "#9ca3af"

            return (
              <div key={i} className="flex items-start gap-2.5 text-sm border-l-2 border-orange-300 dark:border-orange-700 pl-3 py-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium truncate">{d.full_name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: partyColor + "20", color: partyColor }}>
                      {d.acronym}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5">
                    Votó{" "}
                    <span className="font-bold" style={{ color: votedColor }}>{d.voted}</span>
                    {" "}· su grupo votó{" "}
                    <span className="font-bold" style={{ color: partyVotedColor }}>{d.party_voted}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm">
                    {d.initiative?.substring(0, 100)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
