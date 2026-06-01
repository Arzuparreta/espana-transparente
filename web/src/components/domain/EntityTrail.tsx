import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getEntityTrail, type TrailConnection } from "@/lib/data/entity-trail"

const TRAIL_SLUG: Record<"organization" | "politician" | "party", string> = {
  organization: "organizacion",
  politician: "diputado",
  party: "partido",
}

interface EntityTrailProps {
  entityType: "organization" | "politician" | "party"
  entityId: string
}

function ConnectionGroup({
  title,
  connections,
  external = false,
}: {
  title: string
  connections: TrailConnection[]
  external?: boolean
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
          {Object.keys(grouped).length > 1 && (
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {source}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {items.map((conn, i) =>
              external || conn.external ? (
                <a
                  key={`${conn.route}-${i}`}
                  href={conn.route}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-[2px] border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:border-foreground/30 hover:bg-muted/50"
                >
                  <span className="truncate">{conn.label}</span>
                  {conn.meta ? (
                    <span className="shrink-0 text-muted-foreground">· {conn.meta}</span>
                  ) : null}
                </a>
              ) : (
                <ResponsiveLink
                  key={`${conn.route}-${i}`}
                  href={conn.route}
                  className="inline-flex items-center gap-1 rounded-[2px] border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:border-foreground/30 hover:bg-muted/50"
                >
                  <span className="truncate">{conn.label}</span>
                  {conn.meta && (
                    <span className="shrink-0 text-muted-foreground">· {conn.meta}</span>
                  )}
                </ResponsiveLink>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export async function EntityTrail({ entityType, entityId }: EntityTrailProps) {
  const trail = await getEntityTrail(entityType, entityId)

  const { people, organizations, judicial, external } = trail.connections
  if (people.length === 0 && organizations.length === 0 && judicial.length === 0 && external.length === 0) {
    return null
  }

  const rastroHref = `/rastro/${TRAIL_SLUG[entityType]}/${entityId}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conexiones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ConnectionGroup title="Personas" connections={people} />
        <ConnectionGroup title="Organizaciones" connections={organizations} />
        <ConnectionGroup title="Grupos de interés" connections={external} external />
        <ConnectionGroup title="Casos judiciales" connections={judicial} />
      </CardContent>
      <CardFooter className="border-t border-border pt-3">
        <ResponsiveLink
          href={rastroHref}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Ver rastro completo →
        </ResponsiveLink>
      </CardFooter>
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
