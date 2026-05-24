import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getEntityTrail, type TrailConnection } from "@/lib/data/entity-trail"

interface EntityTrailProps {
  entityType: "organization" | "politician"
  entityId: string
}

function ConnectionGroup({
  title,
  connections,
}: {
  title: string
  connections: TrailConnection[]
}) {
  if (connections.length === 0) return null

  // Group by connection type
  const grouped: Record<string, TrailConnection[]> = {}
  for (const conn of connections) {
    if (!grouped[conn.connection]) grouped[conn.connection] = []
    grouped[conn.connection].push(conn)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {Object.entries(grouped).map(([source, items]) => (
        <div key={source} className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {source}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((conn, i) => (
              <ResponsiveLink
                key={`${conn.route}-${i}`}
                href={conn.route}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:border-foreground/30 hover:bg-muted/50"
              >
                <span className="truncate">{conn.label}</span>
                {conn.meta && (
                  <span className="shrink-0 text-muted-foreground">· {conn.meta}</span>
                )}
              </ResponsiveLink>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export async function EntityTrail({ entityType, entityId }: EntityTrailProps) {
  const trail = await getEntityTrail(entityType, entityId)

  const { people, organizations } = trail.connections
  if (people.length === 0 && organizations.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conexiones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ConnectionGroup
          title="Personas"
          connections={people}
        />
        <ConnectionGroup
          title="Organizaciones"
          connections={organizations}
        />
      </CardContent>
    </Card>
  )
}

/** Lightweight version for pages that need a quick check before rendering. */
export function EntityTrailSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conexiones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-28 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
