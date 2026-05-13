import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PoliticianWithMemberships } from "@/types"

interface PoliticianCardProps {
  politician: PoliticianWithMemberships
}

export function PoliticianCard({ politician }: PoliticianCardProps) {
  const membership = politician.politician_memberships?.[0]
  const party = membership?.party

  return (
    <Link href={`/diputados/${politician.id}`}>
      <Card className="hover:border-primary/30 transition-all hover:shadow-sm cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{politician.full_name}</CardTitle>
              {membership?.constituency && (
                <CardDescription>{membership.constituency}</CardDescription>
              )}
            </div>
            {party && (
              <Badge
                variant="outline"
                style={{
                  borderColor: party.color,
                  color: party.color,
                  backgroundColor: party.color + "10",
                }}
              >
                {party.acronym}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}
