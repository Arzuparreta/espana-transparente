import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { PageHeader } from "@/components/domain/PageHeader"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { RecordSection } from "@/components/domain/RecordSection"
import { StatGrid } from "@/components/domain/StatGrid"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { getPoliticianDeclarations, type PoliticianDeclarationDoc } from "@/lib/data"
import { getResponsivePhoto } from "@/lib/photos"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const data = await getPoliticianDeclarations(id)
  const name = data?.politician.full_name
  if (!name) return { title: "Declaraciones económicas" }
  return {
    title: `Declaraciones económicas · ${name}`,
    description: `Bienes, rentas, actividades e intereses económicos declarados por ${name} en el Registro de Intereses del Congreso.`,
  }
}

function fmtEuro(value: number | null): string {
  if (value == null || value <= 0) return "—"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha"
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return "Sin fecha"
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function sourceHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  ACTIVIDAD: "Actividad",
  DONACION: "Donación",
  FUNDACIONES: "Fundación / asociación",
  OBSERVACIONES: "Observación",
}

export default async function PoliticianDeclarationsPage({ params }: PageProps) {
  const { id } = await params
  const data = await getPoliticianDeclarations(id)
  if (!data || data.docs.length === 0) notFound()

  const { politician, docs } = data
  const name = politician.full_name ?? "Diputado/a"
  const photo = getResponsivePhoto(politician.photo_url, politician.photo_variants)
  const profileHref = politician.chamber === "senate" ? `/senadores/${politician.id}` : `/diputados/${politician.id}`

  const bienes = docs.filter((d) => d.type === "bienes_rentas")
  const actividades = docs.filter((d) => d.type === "actividades")
  const intereses = docs.filter((d) => d.type === "intereses_economicos")
  const otros = docs.filter(
    (d) => d.type !== "bienes_rentas" && d.type !== "actividades" && d.type !== "intereses_economicos"
  )

  // Headline figures come from the most recent bienes-y-rentas declaration.
  const latestBienes = bienes[0] ?? null
  const latestDate = docs.map((d) => d.declaration_date).filter(Boolean).sort().at(-1) ?? null

  const stats = [
    { label: "Ingresos declarados", value: fmtEuro(latestBienes?.total_income ?? null) },
    { label: "IRPF pagado", value: fmtEuro(latestBienes?.irpf_paid ?? null) },
    {
      label: "Inmuebles",
      value: latestBienes?.inmuebles != null && latestBienes.inmuebles > 0 ? String(latestBienes.inmuebles) : "—",
    },
    {
      label: "Vehículos",
      value: latestBienes?.vehiculos != null && latestBienes.vehiculos > 0 ? String(latestBienes.vehiculos) : "—",
    },
    {
      label: "Activos financieros",
      value:
        latestBienes?.financial_assets != null && latestBienes.financial_assets > 0
          ? String(latestBienes.financial_assets)
          : "—",
    },
  ]

  const hasHeadlineFigures = stats.some((s) => s.value !== "—")
  const hasOcrFigures = bienes.some(
    (d) =>
      d.source !== "congreso_opendata" &&
      (d.total_income != null || d.irpf_paid != null || d.incomes.length > 0 || !!d.ocr_text)
  )

  const hero = (
    <PageHeader
      variant="record"
      title={name}
      titleFit="long"
      description="Bienes, rentas, actividades e intereses económicos declarados en el Registro de Intereses del Congreso de los Diputados."
      eyebrow={
        <>
          <Avatar className="size-14 shrink-0">
            <AvatarImage src={photo.src} srcSet={photo.srcSet} sizes={photo.sizes} decoding="async" alt={name} />
            <AvatarFallback className="text-base">{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Declaraciones económicas
          </span>
          {politician.party_acronym ? (
            <PartyBadge
              acronym={politician.party_acronym}
              color={politician.party_color}
              partyId={politician.party_id}
              className="text-sm"
            />
          ) : null}
        </>
      }
      actions={
        <ResponsiveLink
          href={profileHref}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          Ver ficha completa →
        </ResponsiveLink>
      }
    />
  )

  const aside = (
    <>
      <SourceFootnote
        sourceLabel="Congreso de los Diputados · Registro de Intereses"
        latestRecordDate={latestDate}
        coverageLabel={`${docs.length} declaración${docs.length === 1 ? "" : "es"}`}
      />
      {hasOcrFigures ? (
        <InfoPanel title="Sobre las cifras">
          Las cantidades de bienes y rentas se extraen automáticamente (OCR) del PDF oficial y pueden
          contener errores de lectura. La declaración firmada es siempre el documento oficial enlazado.
        </InfoPanel>
      ) : null}
    </>
  )

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/declaraciones", label: "Declaraciones" }}
        current={name}
        meta={politician.group_parliamentary ?? undefined}
        fallbackHref="/declaraciones"
        fallbackLabel="Volver a Declaraciones"
        related={[{ href: profileHref, label: "Ficha del/de la diputado/a" }]}
      />

      <RecordLayout hero={hero} aside={aside}>
        {hasHeadlineFigures ? (
          <RecordSection
            title="Resumen"
            eyebrow={latestBienes?.declaration_date ? `Última declaración · ${formatDate(latestBienes.declaration_date)}` : undefined}
          >
            <StatGrid variant="flat" items={stats} />
          </RecordSection>
        ) : null}

        {bienes.length > 0 ? (
          <RecordSection title="Bienes y rentas" count={bienes.length}>
            <div className="space-y-6">
              {bienes.map((doc) => (
                <BienesDoc key={doc.id} doc={doc} />
              ))}
            </div>
          </RecordSection>
        ) : null}

        {actividades.length > 0 ? (
          <RecordSection title="Actividades" count={actividades.length}>
            <div className="space-y-6">
              {actividades.map((doc) => (
                <ActivitiesDoc key={doc.id} doc={doc} />
              ))}
            </div>
          </RecordSection>
        ) : null}

        {intereses.length > 0 ? (
          <RecordSection title="Intereses económicos" count={intereses.length}>
            <div className="space-y-6">
              {intereses.map((doc) => (
                <ActivitiesDoc key={doc.id} doc={doc} />
              ))}
            </div>
          </RecordSection>
        ) : null}

        {otros.length > 0 ? (
          <RecordSection title="Otras declaraciones" count={otros.length}>
            <div className="space-y-6">
              {otros.map((doc) => (
                <ActivitiesDoc key={doc.id} doc={doc} />
              ))}
            </div>
          </RecordSection>
        ) : null}
      </RecordLayout>
    </div>
  )
}

function DocHeader({ doc, label }: { doc: PoliticianDeclarationDoc; label?: string }) {
  const host = sourceHost(doc.source_url)
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="font-mono text-sm font-medium">
        {label ? `${label} · ` : ""}
        {formatDate(doc.declaration_date)}
      </span>
      {doc.source_url ? (
        <a
          href={doc.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Documento oficial{host ? ` · ${host}` : ""} →
        </a>
      ) : null}
    </div>
  )
}

function AssetChips({ doc }: { doc: PoliticianDeclarationDoc }) {
  const chips: string[] = []
  if (doc.inmuebles && doc.inmuebles > 0) chips.push(`🏠 ${doc.inmuebles} inmuebles`)
  if (doc.vehiculos && doc.vehiculos > 0) chips.push(`🚗 ${doc.vehiculos} vehículos`)
  if (doc.financial_assets && doc.financial_assets > 0) chips.push(`💰 ${doc.financial_assets} activos financieros`)
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span key={c} className="rounded-[2px] bg-muted/50 px-2.5 py-1 text-xs font-medium">
          {c}
        </span>
      ))}
    </div>
  )
}

function BienesDoc({ doc }: { doc: PoliticianDeclarationDoc }) {
  const hasFigures = doc.total_income != null || doc.irpf_paid != null
  return (
    <div className="space-y-3 border-l-2 border-border pl-4">
      <DocHeader doc={doc} />

      {hasFigures ? (
        <div className="flex flex-wrap gap-6">
          {doc.total_income != null && doc.total_income > 0 ? (
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Ingresos</div>
              <div className="font-mono text-xl font-medium tabular-nums">{fmtEuro(doc.total_income)}</div>
            </div>
          ) : null}
          {doc.irpf_paid != null && doc.irpf_paid > 0 ? (
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">IRPF pagado</div>
              <div className="font-mono text-xl font-medium tabular-nums">{fmtEuro(doc.irpf_paid)}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <AssetChips doc={doc} />

      {doc.incomes.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
            Fuentes de ingresos detectadas ({doc.incomes.length})
          </summary>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Extraído automáticamente del PDF (OCR); las etiquetas pueden contener errores de lectura.
          </p>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {doc.incomes.map((inc, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-border/30 py-1 text-xs">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{inc.source || "Sin etiqueta"}</span>
                <span className="shrink-0 font-mono tabular-nums">{fmtEuro(inc.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {doc.ocr_text ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
            Texto extraído (OCR)
          </summary>
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[2px] border border-border bg-muted/30 p-3 text-xs leading-relaxed">
            {doc.ocr_text.slice(0, 4000)}
            {doc.ocr_text.length > 4000 && "\n\n[… texto truncado, ver documento oficial para el contenido completo]"}
          </pre>
        </details>
      ) : null}

      {!hasFigures && doc.incomes.length === 0 && !doc.ocr_text ? (
        <p className="text-sm text-muted-foreground">
          Documento presentado. Sin cifras estructuradas disponibles — consulte el documento oficial.
        </p>
      ) : null}
    </div>
  )
}

function ActivitiesDoc({ doc }: { doc: PoliticianDeclarationDoc }) {
  const grouped = new Map<string, typeof doc.activities>()
  for (const act of doc.activities) {
    const key = act.type || "OTROS"
    const list = grouped.get(key) ?? []
    list.push(act)
    grouped.set(key, list)
  }

  return (
    <div className="space-y-3 border-l-2 border-border pl-4">
      <DocHeader doc={doc} />
      {doc.activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Documento presentado sin actividades estructuradas. Consulte el documento oficial.
        </p>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([type, acts]) => (
            <div key={type} className="space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {ACTIVITY_TYPE_LABELS[type] ?? type} · {acts.length}
              </div>
              <ul className="space-y-3">
                {acts.map((act, i) => (
                  <li key={i} className="border-l-2 border-border/50 pl-3">
                    {act.employer ? <div className="font-medium">{act.employer}</div> : null}
                    {act.description ? (
                      <div className="mt-0.5 text-sm text-muted-foreground">{act.description}</div>
                    ) : null}
                    {act.sector || act.period ? (
                      <div className="mt-0.5 flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground/70">
                        {act.sector ? <span>{act.sector}</span> : null}
                        {act.period ? <span>{act.period}</span> : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
