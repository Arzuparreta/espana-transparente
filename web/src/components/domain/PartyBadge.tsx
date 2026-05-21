import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getPartyTone } from "@/lib/domain-style"
import { EntityLink } from "@/components/domain/EntityLink"

interface PartyBadgeProps {
  acronym: string
  color?: string | null
  className?: string
  partyId?: string | number | null
  title?: string
}

export function PartyBadge({ acronym, color, className, partyId, title }: PartyBadgeProps) {
  const tone = getPartyTone(color)
  const label = title ? `${acronym} · ${title}` : acronym

  const badge = (
    <Badge
      variant="outline"
      className={cn("shrink-0 font-medium", className)}
      style={tone}
      title={label}
    >
      {acronym}
    </Badge>
  )

  if (partyId === undefined || partyId === null || partyId === "") {
    return badge
  }

  return (
    <EntityLink
      kind="party"
      id={partyId}
      className="relative z-20 inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Abrir partido ${label}`}
    >
      {badge}
    </EntityLink>
  )
}
