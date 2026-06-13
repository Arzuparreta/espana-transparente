import type { Metadata } from "next"
import { PageHeader } from "@/components/domain/PageHeader"
import { IpcBasketCalculator } from "@/components/indicators/IpcBasketCalculator"
import { PurchasingPowerCalculator } from "@/components/indicators/PurchasingPowerCalculator"
import { SalaryVsIpcCalculator } from "@/components/indicators/SalaryVsIpcCalculator"
import { getIpcIndexSeries, getIpcSubgroupSeries } from "@/lib/data"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Calculadoras económicas",
  description:
    "Herramientas basadas en las series oficiales del IPC para comparar importes y poder adquisitivo.",
  alternates: { canonical: "/calculadoras" },
}

export default async function CalculatorsPage() {
  const [ipcSeries, ipcSubgroups] = await Promise.all([
    getIpcIndexSeries(),
    getIpcSubgroupSeries(),
  ])

  return (
    <div className="ui-page-wide space-y-6 sm:space-y-8">
      <PageHeader title={metadata.title as string} description={metadata.description as string} />
      {ipcSeries.length > 1 ? (
        <div className="space-y-6">
          <IpcBasketCalculator series={ipcSubgroups} />
          <SalaryVsIpcCalculator series={ipcSeries} />
          <PurchasingPowerCalculator series={ipcSeries} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Las series necesarias no están disponibles.
        </p>
      )}
    </div>
  )
}
