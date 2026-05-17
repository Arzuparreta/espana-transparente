import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { getResponsivePhoto } from "@/lib/photos"
import type { PoliticianWithMemberships } from "@/types"

interface PoliticianCardProps {
  politician: PoliticianWithMemberships
}

export function PoliticianCard({ politician }: PoliticianCardProps) {
  const membership = politician.politician_memberships?.[0]
  const party = membership?.party
  const initials = `${politician.first_name[0] ?? ""}${politician.last_name[0] ?? ""}`.toUpperCase()
  const photo = getResponsivePhoto(politician.photo_url, politician.photo_variants)

  return (
    <div className="relative">
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
              <CardTitle className="text-base text-balance sm:text-lg">{politician.full_name}</CardTitle>
              {membership?.constituency && (
                <CardDescription className="text-sm">{membership.constituency}</CardDescription>
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
          {membership?.group_parliamentary ? (
            <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Grupo parlamentario: {membership.group_parliamentary}
            </div>
          ) : null}
        </CardHeader>
      </Card>
      <Link
        href={`/diputados/${politician.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={politician.full_name}
        prefetch={false}
      />
    </div>
  )
}
