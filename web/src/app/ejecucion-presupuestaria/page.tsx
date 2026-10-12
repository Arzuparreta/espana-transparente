import { PageHeader } from "@/components/domain/PageHeader"
import { BudgetExecution } from "@/components/chain/BudgetExecution"
import { getBudgetExecution } from "@/lib/data/budget-execution"
export const revalidate = 3600
export const metadata = {
  title: "Ejecución del presupuesto del Estado",
  description:
    "Créditos definitivos, obligaciones reconocidas y pagos corrientes del presupuesto de gastos del Estado, según IGAE.",
}
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string | string[] }>
}) {
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="¿Qué parte del presupuesto estatal se ejecutó y pagó?"
        description="Un piloto con cifras presupuestarias comparables: mismo ejercicio, corte y ámbito. Obligación reconocida y pago conservan significados distintos."
      />
      <BudgetExecution
        data={await getBudgetExecution()}
        period={(await searchParams)?.period}
      />
    </div>
  )
}
