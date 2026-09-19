import Link from "next/link"
import { LogoHero } from "@/components/layout/LogoHero"
import { FiscalChain } from "@/components/chain/FiscalChain"
import { AREAS } from "@/lib/nav-config"
import { getEtlFreshnessSummary } from "@/lib/data"
export const dynamic = "force-dynamic"
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const [p, freshness] = await Promise.all([
    searchParams,
    getEtlFreshnessSummary(),
  ])
  return (
    <div className="space-y-10">
      <LogoHero />
      {freshness.status === "delayed" && (
        <Link
          href="/estado-datos"
          className="block text-sm text-muted-foreground"
        >
          Hay fuentes pendientes de actualización. Consultar cobertura y fechas
          →
        </Link>
      )}
      <nav
        aria-label="Explorar los datos"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {AREAS.map((area) => (
          <Link
            key={area.key}
            href={area.href}
            className="rounded border border-border p-4 hover:bg-muted"
          >
            <span className="text-xs text-muted-foreground">{area.label}</span>
            <h2 className="mt-2 text-lg font-semibold">{area.question}</h2>
          </Link>
        ))}
      </nav>
      <FiscalChain from={p.desde} to={p.hasta} />
    </div>
  )
}
