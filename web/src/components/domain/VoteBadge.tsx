import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getVoteTone } from "@/lib/domain-style"

interface VoteBadgeProps {
  vote: string
  className?: string
}

export function VoteBadge({ vote, className }: VoteBadgeProps) {
  const tone = getVoteTone(vote)

  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 font-semibold", className)}
      style={tone}
    >
      {vote}
    </Badge>
  )
}
