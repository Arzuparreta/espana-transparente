import { supabase } from "@/lib/supabase/client"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const revalidate = 3600

export default async function IndicadoresPage() {
  const { data: indicators } = await supabase
    .from("economic_indicators")
    .select("indicator_code, indicator_name, unit")
    .order("indicator_code")

  // Get latest value for each indicator
  const unique: Record<string, { name: string; unit: string; latest: string; value: number }> = {}
  const rows = (indicators || []) as unknown as Array<{ indicator_code: string; indicator_name: string; unit: string }>
  for (const row of rows) {
    if (!unique[row.indicator_code]) {
      unique[row.indicator_code] = {
        name: row.indicator_name,
        unit: row.unit,
        latest: "",
        value: 0,
      }
    }
  }

  // Get latest period for each
  for (const code of Object.keys(unique)) {
    const { data } = await supabase
      .from("economic_indicators")
      .select("period, value")
      .eq("indicator_code", code)
      .order("period", { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      unique[code].latest = data[0].period
      unique[code].value = data[0].value
    }
  }

  const entries = Object.entries(unique)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Indicadores económicos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Datos del INE. Sin marco ideológico. Cada número explicado para que entiendas qué mide realmente.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Sin datos todavía. Ejecuta el ETL del INE.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {entries.map(([code, info]) => (
            <Link key={code} href={`/indicadores/${code}`}>
              <Card className="hover:border-primary/30 transition-all cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{info.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">{code}</Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <span className="text-xl font-bold">{info.value.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">{info.unit}</span>
                  </CardDescription>
                  <CardDescription className="text-xs">
                    Último dato: {info.latest}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="py-4 text-xs text-muted-foreground">
          Fuente: INE (Instituto Nacional de Estadística). Datos actualizados mensualmente vía API JSON.
        </CardContent>
      </Card>
    </div>
  )
}
