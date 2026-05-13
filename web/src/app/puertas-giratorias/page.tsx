import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const PARTY_COLORS: Record<string, string> = {
  PP: "#0055A7", PSOE: "#E01021", VOX: "#63BE21", SUMAR: "#E01065",
}

interface RDCase {
  person_name: string
  political_party: string
  public_role: string
  public_organization: string
  private_role: string
  private_organization: string
  sector: string
  person_id: string | null
}

export default async function PuertasGiratoriasPage() {
  const { data } = await supabase
    .from("revolving_door")
    .select("*")
    .order("person_name")

  const cases = (data as RDCase[]) || []

  if (cases.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Puertas giratorias</h1>
        <p className="text-muted-foreground">Sin datos registrados.</p>
      </div>
    )
  }

  const groups = new Map<string, RDCase[]>()
  for (const c of cases) {
    const s = c.sector || "Sin clasificar"
    if (!groups.has(s)) groups.set(s, [])
    groups.get(s)!.push(c)
  }

  const uniquePeople = new Set(cases.map((c) => c.person_name)).size

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Puertas giratorias</h1>
        <p className="text-muted-foreground mt-1">
          {uniquePeople} personas · {cases.length} movimientos documentados entre el sector público y privado
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">¿Qué son las puertas giratorias?</CardTitle>
          <CardDescription>
            El movimiento de altos cargos entre el sector público y el privado. Un ex-ministro regula un sector, 
            luego ficha por una empresa de ese mismo sector. La información y los contactos obtenidos en el cargo 
            público se monetizan en el privado. En España, 3 de cada 10 ministros dejan la política y fichan por 
            la empresa privada.
          </CardDescription>
        </CardHeader>
      </Card>

      {Array.from(groups.entries()).sort().map(([sector, entries]) => (
        <Card key={sector}>
          <CardHeader>
            <CardTitle className="text-base">{sector}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entries.map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3 py-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{e.person_name}</span>
                    {e.political_party && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: (PARTY_COLORS[e.political_party] || "#718096") + "20",
                          color: PARTY_COLORS[e.political_party] || "#718096",
                        }}>
                        {e.political_party}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    {e.public_role} en {e.public_organization}
                    {" → "}
                    <span className="font-medium text-foreground">{e.private_role}</span>
                    {" en "}{e.private_organization}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="py-4 text-xs text-muted-foreground">
          Fuente: Wikipedia, Civio, y medios de comunicación. La Ley 5/2006 establece un periodo 
          de incompatibilidad de 2 años para altos cargos que pasan al sector privado, pero no 
          impide el movimiento en sí.
        </CardContent>
      </Card>
    </div>
  )
}
