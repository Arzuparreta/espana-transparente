import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface RevolvingDoorProps {
  politicianId: string
}

export async function RevolvingDoorList({ politicianId }: RevolvingDoorProps) {
  const { data: entries } = await supabase
    .from("revolving_door")
    .select("*")
    .eq("person_id", politicianId)
    .order("start_date", { ascending: false })

  if (!entries || entries.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🔄 Puertas giratorias</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((e) => (
          <div key={e.id} className="text-sm space-y-1 border-l-2 border-muted pl-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span>{e.public_role}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{e.private_role}</span>
              <span className="text-muted-foreground">en {e.private_organization}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {e.sector && `Sector: ${e.sector}`}
              {e.cooling_off_months != null && ` · Sin periodo de enfriamiento`}
              {e.start_date && ` · ${new Date(e.start_date).toLocaleDateString("es-ES")}`}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
