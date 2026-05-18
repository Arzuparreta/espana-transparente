import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getResponsivePhoto } from "@/lib/photos"
import { toTitleCaseIfShouting } from "@/lib/text"
import type { PoliticianWithMemberships } from "@/types"

interface PoliticianCardProps {
  politician: PoliticianWithMemberships
}

export function PoliticianCard({ politician }: PoliticianCardProps) {
  const membership = politician.politician_memberships?.[0]
  const party = membership?.party
  const initials = `${politician.first_name[0] ?? ""}${politician.last_name[0] ?? ""}`.toUpperCase()
  const photo = getResponsivePhoto(politician.photo_url, politician.photo_variants)
  const displayName = toTitleCaseIfShouting(politician.full_name)
  const displayConstituency = membership?.constituency
    ? toTitleCaseIfShouting(membership.constituency)
    : null
  const displayGroup = membership?.group_parliamentary
    ? toTitleCaseIfShouting(membership.group_parliamentary)
    : null

  return (
    <ResponsiveLink href={`/diputados/${politician.id}`}>
      <Card className="h-full">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <Avatar size="default" className="mt-0.5 shrink-0">
              <AvatarImage
                src={photo.src}
                srcSet={photo.srcSet}
                sizes={photo.sizes}
                loading="lazy"
                decoding="async"
                alt={politician.full_name}
              />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-base text-balance sm:text-lg">{displayName}</CardTitle>
              {displayConstituency && (
                <CardDescription className="text-sm">{displayConstituency}</CardDescription>
              )}
            </div>
            {party && (
              <PartyBadge
                acronym={party.acronym}
                color={party.color}
                className="mt-0.5 max-w-full"
              />
            )}
          </div>
          {displayGroup ? (
            <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Grupo parlamentario: {displayGroup}
            </div>
          ) : null}
        </CardHeader>
      </Card>
    </ResponsiveLink>
  )
}
