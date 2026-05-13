import { supabase } from "@/lib/supabase/client"
import { getVoteColor } from "@/lib/domain-style"

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {sorted.map(([vote, count]) => {
          const pct = Math.round((count / total) * 100)
          const color = getVoteColor(vote)
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
          const color = getVoteColor(vote)
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
