import { PageHeader } from "@/components/domain/PageHeader"
import { FiscalChain } from "@/components/chain/FiscalChain"
export const metadata = {
  title: "Cuentas públicas",
  description:
    "Ingresos, gasto realizado, saldo, deuda e intereses de las administraciones públicas españolas.",
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const p = await searchParams
  return (
    <div className="space-y-8">
      <PageHeader
        title="Cuentas públicas"
        description="España · conjunto de las administraciones públicas · contabilidad nacional SEC 2010"
      />
      <FiscalChain from={p.desde} to={p.hasta} action="/cuentas-publicas" />
    </div>
  )
}
