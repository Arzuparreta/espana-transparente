import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/domain/EmptyState"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PageHeader } from "@/components/domain/PageHeader"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getIndicators } from "@/lib/data"

export const revalidate = 3600

export default async function IndicadoresPage() {
  const rows = await getIndicators()

  // Keep only the first (latest) row per indicator_code
  const unique: Record<string, { name: string; unit: string; latest: string; value: number }> = {}
  for (const row of rows ?? []) {
    if (!unique[row.indicator_code]) {
      unique[row.indicator_code] = {
        name: row.indicator_name,
        unit: row.unit,
        latest: row.period,
        value: row.value,
      }
    }
  }

  const entries = Object.entries(unique)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Indicadores económicos"
        description="Series históricas del Instituto Nacional de Estadística (INE). IPC, PIB, EPA, deuda pública y otros indicadores económicos."
      />

      {entries.length === 0 ? (
        <EmptyState title="Sin indicadores" description="Ejecuta el ETL del INE." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {entries.map(([code, info]) => (
            <ResponsiveLink key={code} href={`/indicadores/${code}`}>
              <Card className="h-full">
                <CardHeader className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CardTitle className="min-w-0 flex-1 text-base leading-6 text-balance">{info.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">{code}</Badge>
                  </div>
                  <CardDescription className="flex flex-wrap items-end gap-2">
                    <span className="text-2xl font-semibold tracking-tight text-foreground">
                      {info.value.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">{info.unit}</span>
                  </CardDescription>
                  <CardDescription className="text-xs">
                    Último dato: {info.latest}
                  </CardDescription>
                </CardHeader>
              </Card>
            </ResponsiveLink>
          ))}
        </div>
      )}

      <InfoPanel title="Fuente">
        INE (Instituto Nacional de Estadística). Datos actualizados mensualmente vía API JSON.
      </InfoPanel>
    </div>
  )
}
