import { supabase } from "@/lib/supabase/client"
import Link from "next/link"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { Party } from "@/types"

export const revalidate = 3600

export default async function PartidosPage() {
  const { data: parties } = await supabase
    .from("parties")
    .select("*")
    .order("acronym")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Partidos</h1>
        <p className="text-muted-foreground mt-1">
          Grupos parlamentarios y formaciones políticas
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(parties as Party[])?.map((p) => (
          <Link key={p.id} href={`/partidos/${p.id}`}>
            <Card className="hover:border-primary/30 transition-all hover:shadow-sm cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <div>
                    <CardTitle className="text-lg">{p.acronym}</CardTitle>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
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
