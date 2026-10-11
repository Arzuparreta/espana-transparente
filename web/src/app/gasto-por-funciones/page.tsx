import { PageHeader } from "@/components/domain/PageHeader"
import { ExpenditureFunctions } from "@/components/chain/ExpenditureFunctions"
import { getExpenditureFunctions } from "@/lib/data/cofog"
export const revalidate = 3600
export const metadata = {
  title: "Gasto público por funciones",
  description:
    "En qué se gastó el dinero público: diez funciones COFOG, ámbito S13, ejercicio y fuente Eurostat.",
}
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string | string[] }>
}) {
  const params = await searchParams
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="El destino del gasto público"
        description="Gasto realizado por función: qué parte corresponde a protección social, salud, educación y las demás finalidades."
      />
      <ExpenditureFunctions
        data={await getExpenditureFunctions()}
        year={params?.year}
      />
    </div>
  )
}
