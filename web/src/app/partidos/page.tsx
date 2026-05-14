import { supabase } from "@/lib/supabase/client"
import Link from "next/link"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/domain/PageHeader"
import type { Party } from "@/types"

export const revalidate = 3600

export default async function PartidosPage() {
  const { data: parties } = await supabase
    .from("parties")
    .select("*")
    .order("acronym")

  return (
    <div className="space-y-8">
      <PageHeader
        title="Partidos"
        description="Partidos con representación en el Congreso. Cada partido incluye sus diputados activos, grupo parlamentario y cadena de mando."
      />
      <div className="ui-grid-cards">
        {(parties as Party[])?.map((p) => (
          <Link key={p.id} href={`/partidos/${p.id}`}>
            <Card className="ui-card-link h-full cursor-pointer bg-card/85">
              <CardHeader className="space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 shrink-0 rounded-full border border-border/60 shadow-sm"
                    style={{ backgroundColor: p.color }}
                  />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg">{p.acronym}</CardTitle>
                    <p className="text-sm text-muted-foreground text-balance">
                      {p.name}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
