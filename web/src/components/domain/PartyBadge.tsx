import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getPartyTone } from "@/lib/domain-style"
import { EntityLink } from "@/components/domain/EntityLink"

interface PartyBadgeProps {
  acronym: string
  color?: string | null
  className?: string
  partyId?: string | number | null
}

export function PartyBadge({ acronym, color, className, partyId }: PartyBadgeProps) {
  const tone = getPartyTone(color)

  const badge = (
    <Badge
      variant="outline"
      className={cn("shrink-0 font-medium", className)}
      style={tone}
    >
      {acronym}
    </Badge>
  )

  if (partyId === undefined || partyId === null || partyId === "") {
    return badge
  }

  return (
    <EntityLink kind="party" id={partyId} className="inline-flex">
      {badge}
    </EntityLink>
  )
}
