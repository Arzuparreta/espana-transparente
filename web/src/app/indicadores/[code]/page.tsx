import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IndicatorChart } from "@/components/indicators/IndicatorChart"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { getIndicatorPoints } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ code: string }>
}

interface Row {
  period: string
  value: number
  unit: string
  indicator_name: string
}

export default async function IndicadorPage({ params }: PageProps) {
  const { code } = await params

  const points = await getIndicatorPoints(code)

  if (!points || points.length === 0) notFound()

  const pts = points as unknown as Row[]
  const name = pts[0].indicator_name
  const unit = pts[0].unit
  const sorted = [...pts].reverse()
  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const change = prev ? ((latest.value - prev.value) / prev.value) * 100 : 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={name}
        description="Serie histórica del Instituto Nacional de Estadística (INE)."
        eyebrow={
          <>
            <Badge variant="outline" className="text-xs">
              {code}
            </Badge>
            <span className="text-sm text-muted-foreground">INE</span>
          </>
        }
      />

      <StatGrid
        items={[
          { label: "Último dato", value: latest.value.toFixed(1), hint: unit },
          { label: "Periodo", value: latest.period, hint: "Última observación disponible." },
          {
            label: "Variación mensual",
            value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
            valueClassName:
              change >= 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400",
            hint: "Cambio respecto al periodo anterior.",
          },
        ]}
      />

      <IndicatorChart
        data={sorted.map((point) => ({ period: point.period, value: point.value }))}
        unit={unit}
      />

      <details className="text-sm">
        <summary className="mb-3 cursor-pointer text-muted-foreground hover:text-foreground">
          Ver tabla completa de datos
        </summary>
        <Card className="bg-card/80">
          <CardContent className="max-h-[320px] overflow-y-auto p-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">Periodo</th>
                  <th className="p-2 text-right font-medium">Valor</th>
                  <th className="p-2 text-right font-medium">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((point, index) => (
                  <tr key={index} className="border-b border-muted/30">
                    <td className="p-2">{point.period}</td>
                    <td className="p-2 text-right font-medium">{point.value.toFixed(1)}</td>
                    <td className="p-2 text-right text-muted-foreground">{point.unit}</td>
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
