import { notFound, redirect } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { getInstitucionById, getPartyAcronymMap } from "@/lib/data"

export const revalidate = 3600 * 24

interface PageProps {
  params: { id: string }
}

const INSTITUTION_LABEL: Record<string, string> = {
  TC: "Tribunal Constitucional",
  CGPJ: "Consejo General del Poder Judicial",
  RTVE: "Corporación RTVE",
  SEPI: "SEPI — Sociedad Estatal de Participaciones Industriales",
}

export async function generateMetadata({ params }: PageProps) {
  const member = await getInstitucionById(params.id)
  return { title: member?.person_name ?? "Nombramiento" }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatName(raw: string): string {
  return raw
    .split(",")
    .map((s) => s.trim())
    .reverse()
    .join(" ")
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 border-t border-border/50 py-3 text-sm first:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  )
}

export default async function InstitucionDetailPage({ params }: PageProps) {
  const member = await getInstitucionById(params.id)
  if (!member) notFound()

  if (member.politician_id) {
    redirect(`/diputados/${member.politician_id}`)
  }

  const partyMap = await getPartyAcronymMap()
  const partyId = member.political_party
    ? partyMap[member.political_party.toLowerCase()] ?? null
    : null

  const institutionLabel = INSTITUTION_LABEL[member.institution] ?? member.institution

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/instituciones", label: "Instituciones" }}
        current={formatName(member.person_name)}
        meta={institutionLabel}
        fallbackHref="/instituciones"
        fallbackLabel="Volver a Instituciones"
        related={[
          member.source_url
            ? { href: member.source_url, label: "Fuente BOE", external: true }
            : null,
        ]}
      />
      <PageHeader
        title={formatName(member.person_name)}
        description={`${member.position_title} · ${institutionLabel}`}
        eyebrow={
          member.political_party ? (
            <PartyBadge
              acronym={member.political_party}
              color={member.party_color ?? undefined}
              partyId={partyId}
            />
          ) : undefined
        }
      />

      <div className="rounded-[2px] border border-border bg-card px-6 py-2">
        <dl>
          <Row label="Organismo">{institutionLabel}</Row>
          <Row label="Cargo">{member.position_title}</Row>
          {member.nominating_body && <Row label="Propuesto por">{member.nominating_body}</Row>}
          {member.political_party && <Row label="Partido">{member.political_party}</Row>}
          {member.appointment_date && (
            <Row label="Nombramiento">{formatDate(member.appointment_date)}</Row>
          )}
        </dl>
      </div>

      <InfoPanel title="Fuente">
        Nombramiento extraído del BOE o de la web oficial del organismo. El partido asociado
        corresponde al que respaldó la candidatura en el Congreso, el Senado, el CGPJ o el
        Gobierno según el caso.
        {member.source_url && (
          <>
            {" "}
            <a
              href={member.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Ver fuente oficial →
            </a>
          </>
        )}
      </InfoPanel>
    </div>
  )
}
