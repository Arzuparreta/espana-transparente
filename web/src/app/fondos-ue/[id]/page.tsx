import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { getEuFundBySlug } from "@/lib/data"

export const revalidate = 3600 * 24

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const fund = await getEuFundBySlug(decodeURIComponent(params.id))
  return { title: fund?.label ?? "Fondo UE" }
}

function formatEuros(amount: number | null): string {
  if (amount == null) return "—"
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2).replace(".", ",")} mil M €`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} M €`
  return `${amount.toLocaleString("es-ES")} €`
}

export default async function EuFundDetailPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.id)
  const fund = await getEuFundBySlug(slug)
  if (!fund) notFound()

  const kohesioUrl = `https://kohesio.ec.europa.eu/en/beneficiaries/${slug}`

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/fondos-ue", label: "Fondos UE" }}
        current={fund.label}
        fallbackHref="/fondos-ue"
        fallbackLabel="Volver a Fondos UE"
        related={[
          { href: kohesioUrl, label: "Ficha Kohesio", external: true },
          fund.wikidata_link
            ? { href: fund.wikidata_link, label: "Wikidata", external: true }
            : null,
        ]}
      />
      <PageHeader
        title={fund.label}
        description="Beneficiario de Fondos Estructurales y de Inversión Europeos (ESIF 2014-2027)."
      />

      <StatGrid
        items={[
          { label: "Fondos UE asignados", value: formatEuros(fund.eu_budget) },
          { label: "Presupuesto total", value: formatEuros(fund.total_budget) },
          {
            label: "Proyectos",
            value:
              fund.number_projects != null
                ? fund.number_projects.toLocaleString("es-ES")
                : "—",
          },
          {
            label: "Cofinanciación UE",
            value:
              fund.cofinancing_rate != null
                ? `${Number(fund.cofinancing_rate).toFixed(1)} %`
                : "—",
          },
        ]}
      />

      <InfoPanel title="Fuente">
        Datos extraídos de{" "}
        <a
          href={kohesioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Kohesio
        </a>
        , portal oficial de la Comisión Europea para los fondos estructurales ESIF 2014-2027.
        Incluye FEDER, FSE, Fondo de Cohesión, FEADER y FEMP. El importe asignado es la
        contribución de la UE; el presupuesto total incluye la cofinanciación nacional.
      </InfoPanel>
    </div>
  )
}
