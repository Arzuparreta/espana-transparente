import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const revalidate = 3600

interface PageProps { params: Promise<{ code: string }> }

export default async function IndicadorPage({ params }: PageProps) {
  const { code } = await params

  const { data: points } = await supabase
    .from("economic_indicators")
    .select("period, value, unit, indicator_name")
    .eq("indicator_code", code)
    .order("period", { ascending: false })
    .limit(120)

  if (!points || points.length === 0) notFound()

interface Row { period: string; value: number; unit: string; indicator_name: string }
const pts = (points as unknown as Row[])
const name = pts[0].indicator_name
const unit = pts[0].unit
const sorted = [...pts].reverse()
const values = sorted.map((p) => p.value)
const min = Math.min(...values)
const max = Math.max(...values)
const range = max - min || 1

  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const change = prev ? ((latest.value - prev.value) / prev.value * 100) : 0

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs">{code}</Badge>
          <span className="text-sm text-muted-foreground">INE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{name}</h1>
      </div>

      {/* Latest value */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card><CardContent className="py-3 px-3 text-center">
          <div className="text-xl font-bold">{latest.value.toFixed(1)}</div>
          <div className="text-[11px] text-muted-foreground">{unit}</div>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-3 text-center">
          <div className="text-xl font-bold">{latest.period}</div>
          <div className="text-[11px] text-muted-foreground">último periodo</div>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-3 text-center">
          <div className={`text-xl font-bold ${change >= 0 ? "text-red-500" : "text-green-500"}`}>
            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground">variación mensual</div>
        </CardContent></Card>
      </div>

      {/* Bar chart (CSS-based, no library) */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Evolución</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
            {sorted.slice(-60).map((p, i) => {
              const pct = ((p.value - min) / range) * 100
              const isLatest = i === sorted.length - 1
              return (
                <div key={i} className="flex items-center gap-2 text-[10px] sm:text-xs">
                  <span className="w-14 sm:w-16 text-right text-muted-foreground shrink-0">{p.period}</span>
                  <div className="flex-1 h-5 relative">
                    <div
                      className={`absolute inset-y-1 rounded-sm ${isLatest ? "bg-foreground" : "bg-muted-foreground/20"}`}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <span className="w-14 sm:w-16 text-right font-medium shrink-0">{p.value.toFixed(1)}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Data table */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-3">
          Ver tabla completa de datos
        </summary>
        <Card>
          <CardContent className="p-0 max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Periodo</th>
                  <th className="text-right p-2 font-medium">Valor</th>
                  <th className="text-right p-2 font-medium">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {sorted.reverse().map((p, i) => (
                  <tr key={i} className="border-b border-muted/30">
                    <td className="p-2">{p.period}</td>
                    <td className="text-right p-2 font-medium">{p.value.toFixed(1)}</td>
                    <td className="text-right p-2 text-muted-foreground">{p.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </details>
    </div>
  )
}
