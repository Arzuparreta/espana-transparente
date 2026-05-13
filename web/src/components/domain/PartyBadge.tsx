import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getPartyTone } from "@/lib/domain-style"

interface PartyBadgeProps {
  acronym: string
  color?: string | null
  className?: string
}

export function PartyBadge({ acronym, color, className }: PartyBadgeProps) {
  const tone = getPartyTone(color)

  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 font-medium", className)}
      style={tone}
    >
      {acronym}
    </Badge>
  )
}
