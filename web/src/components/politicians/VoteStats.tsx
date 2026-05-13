import { supabase } from "@/lib/supabase/client"

const VOTE_COLORS: Record<string, string> = {
  Sí: "#22c55e",
  No: "#ef4444",
  Abstención: "#f59e0b",
  "No vota": "#9ca3af",
}

interface VoteStatsProps {
  politicianId: string
}

export async function VoteStats({ politicianId }: VoteStatsProps) {
  const { data } = await supabase
    .from("votes")
    .select("vote")
    .eq("politician_id", politicianId)

  if (!data || data.length === 0) return null

  const counts: Record<string, number> = {}
  for (const v of data) {
    counts[v.vote] = (counts[v.vote] || 0) + 1
  }

  const total = data.length
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {sorted.map(([vote, count]) => {
          const pct = Math.round((count / total) * 100)
          const color = VOTE_COLORS[vote] || "#9ca3af"
          return (
            <div key={vote} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium">{vote}</span>
              <span className="text-sm text-muted-foreground">
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        {sorted.map(([vote, count]) => {
          const pct = (count / total) * 100
          const color = VOTE_COLORS[vote] || "#9ca3af"
          return (
            <div
              key={vote}
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          )
        })}
      </div>
    </div>
  )
}
