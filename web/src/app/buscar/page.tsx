import { PageHeader } from "@/components/domain/PageHeader"
import { SmartSearch } from "@/components/search/SmartSearch"
import { searchDocuments } from "@/lib/data"

interface PageProps {
  searchParams?: { q?: string }
}

export function generateMetadata({ searchParams }: PageProps) {
  const q = searchParams?.q
  return {
    title: q ? `"${q}" — Búsqueda` : "Búsqueda",
  }
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const query = searchParams?.q?.trim() ?? ""
  const results = query.length >= 2 ? await searchDocuments(query, { limit: 24 }) : []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Búsqueda"
        description="Personas, votaciones, contratos, subvenciones, presupuestos, indicadores y fuentes públicas."
      />
      <SmartSearch initialQuery={query} initialResults={results} mode="page" autoFocus />
    </div>
  )
}
