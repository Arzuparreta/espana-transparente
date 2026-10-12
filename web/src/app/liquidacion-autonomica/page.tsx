import { PageHeader } from "@/components/domain/PageHeader";
import { AutonomicLiquidation } from "@/components/chain/AutonomicLiquidation";
import { getAutonomicLiquidation } from "@/lib/data/autonomic-liquidation";
export const revalidate = 3600;
export const metadata = {
  title: "¿Qué ejecutó tu administración autonómica?",
  description:
    "Liquidación definitiva consolidada de 2024: crédito inicial y definitivo, obligaciones y pagos líquidos por comunidad autónoma.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string | string[];
    territory?: string | string[];
  }>;
}) {
  const params = await searchParams;
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="¿Qué ejecutó tu administración autonómica?"
        description="Sigue la autorización, la obligación reconocida y el pago en las cuentas de tu comunidad."
      />
      <AutonomicLiquidation
        data={await getAutonomicLiquidation()}
        year={params.year}
        territory={params.territory}
      />
    </div>
  );
}
