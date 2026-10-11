import { PageHeader } from "@/components/domain/PageHeader"
import { SubsidyPurposes } from "@/components/subvenciones/SubsidyPurposes"
import { getSubsidyPurposeYear } from "@/lib/data/subsidy-purposes"
import { purposeYear } from "@/lib/subsidy-purpose"
export const revalidate = 3600
export const metadata = {
  title: "Ayudas por finalidad",
  description:
    "Para qué se concedieron las ayudas del portal, según convocatoria BDNS e instrumento.",
}
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string | string[] }>
}) {
  const year = purposeYear((await searchParams)?.year, new Date().getFullYear())
  const data =
    year === null
      ? { groups: [], error: false }
      : await getSubsidyPurposeYear(year)
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="¿Para qué se concedieron ayudas?"
        description="Finalidades declaradas de las concesiones a organizaciones recopiladas por el portal. Cada instrumento conserva su propio significado."
      />
      <SubsidyPurposes year={year} {...data} />
    </div>
  )
}
