import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface TimelineProps {
  memberships: Array<{
    id: string
    constituency?: string
    group_parliamentary?: string
    start_date?: string
    end_date?: string
    is_active?: boolean
    legislature?: {
      number: number
      name: string
      start_date?: string
      end_date?: string
    }
    party?: {
      acronym: string
      color: string
      name: string
    }
  }>
}

export function PoliticianTimeline({ memberships }: TimelineProps) {
  const sorted = [...memberships].sort((a, b) => {
    const na = a.legislature?.number ?? 0
    const nb = b.legislature?.number ?? 0
    return nb - na
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Trayectoria parlamentaria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 text-sm border-l-2 pl-3"
              style={{
                borderLeftColor: m.party?.color || "#718096",
                opacity: m.is_active ? 1 : 0.6,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {m.legislature?.name || `Legislatura ${m.legislature?.number}`}
                </div>
                <div className="text-muted-foreground text-xs">
                  {m.constituency && `Circunscripción: ${m.constituency}`}
                  {m.start_date && ` · Desde ${m.start_date}`}
                  {m.end_date && ` hasta ${m.end_date}`}
                </div>
              </div>
              {m.party && (
                <Badge
                  variant="outline"
                  className="text-xs shrink-0"
                  style={{
                    borderColor: m.party.color,
                    color: m.party.color,
                    backgroundColor: m.party.color + "10",
                  }}
                >
                  {m.party.acronym}
                </Badge>
              )}
              {m.is_active && (
                <Badge
                  variant="outline"
                  className="text-xs shrink-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                >
                  Activo
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
