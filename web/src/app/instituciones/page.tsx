import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { StatGrid } from "@/components/domain/StatGrid"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { EntityLink } from "@/components/domain/EntityLink"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getInstitucionesActuales, getPartyAcronymMap, type InstitucionMember } from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const revalidate = 3600 * 24

export const metadata = {
  title: "Instituciones",
  description: "Nombramientos en Tribunal Constitucional, CGPJ, RTVE y SEPI: persona, organismo proponente y fuente BOE.",
}

const INSTITUTION_META: Record<
  string,
  { label: string; description: string; nominating: string }
> = {
  TC: {
    label: "Tribunal Constitucional",
    description: "12 magistrados. Mandato de 9 años.",
    nominating: "4 × Congreso · 4 × Senado · 2 × CGPJ · 2 × Gobierno",
  },
  CGPJ: {
    label: "Consejo General del Poder Judicial",
    description: "20 vocales + presidente. Mandato de 5 años.",
    nominating: "12 × Congreso · 8 × Senado",
  },
  RTVE: {
    label: "Corporación RTVE",
    description: "Consejo de administración. Mandato de 6 años.",
    nominating: "Congreso (mayoría 2/3)",
  },
  SEPI: {
    label: "SEPI — Sociedad Estatal de Participaciones Industriales",
    description: "Consejo de administración.",
    nominating: "Gobierno (Consejo de Ministros)",
  },
}

const INSTITUTION_ORDER = ["TC", "CGPJ", "RTVE", "SEPI"]

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

function formatName(raw: string): string {
  return raw
    .split(",")
    .map((s) => s.trim())
    .reverse()
    .join(" ")
}

function MemberCard({ member, partyId }: { member: InstitucionMember; partyId: string | null }) {
  const color = getPartyColor(member.party_color)
  const nameFormatted = formatName(member.person_name)

  return (
    <div
      data-slot="card"
      className="flex min-h-[6rem] flex-col justify-between rounded-[2px] border bg-card p-4 transition-colors hover:border-foreground/40"
      style={{ borderColor: `${color}28` }}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium leading-snug text-muted-foreground line-clamp-1">
          {member.position_title}
          {member.nominating_body ? ` · ${member.nominating_body}` : ""}
        </p>
        {member.politician_id ? (
          <EntityLink kind="politician" id={member.politician_id}>
            <p className="font-semibold leading-snug underline-offset-2 hover:underline">{nameFormatted}</p>
          </EntityLink>
        ) : (
          <p className="font-semibold leading-snug">{nameFormatted}</p>
        )}
      </div>

      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <PartyBadge
          acronym={member.political_party ?? "—"}
          color={member.party_color ?? undefined}
          partyId={partyId}
        />
        <div className="flex shrink-0 items-center gap-2">
          {member.has_revolving_door && (
            <ResponsiveLink
              href={member.politician_id ? `/puertas-giratorias#person-${member.politician_id}` : "/puertas-giratorias"}
              className="rounded border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-accent"
            >
              Puerta giratoria →
            </ResponsiveLink>
          )}
          {member.source_url && (
            <a
              href={member.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs text-muted-foreground hover:underline"
            >
              BOE
            </a>
          )}
        </div>
      </div>

      {member.appointment_date && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Desde {formatDate(member.appointment_date)}
        </p>
      )}
    </div>
  )
}

export default async function InstitucionesPage() {
  const [members, partyMap] = await Promise.all([
    getInstitucionesActuales(),
    getPartyAcronymMap(),
  ])

  const byInstitution = members.reduce<Record<string, InstitucionMember[]>>((acc, m) => {
    acc[m.institution] = [...(acc[m.institution] ?? []), m]
    return acc
  }, {})

  const totalMembers = members.length
  const withParty = members.filter((m) => m.political_party).length
  const pctParty =
    totalMembers > 0 ? Math.round((withParty / totalMembers) * 100) : 0
  const lastDate = members
    .map((m) => m.appointment_date)
    .filter(Boolean)
    .sort()
    .at(-1)

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader
        title="Organismos institucionales"
        description="Personas nombradas para dirigir organismos públicos clave —Tribunal Constitucional, Consejo General del Poder Judicial, RTVE, SEPI— y por qué partido fue propuesta cada una."
      />

      <StatGrid
        items={[
          { label: "Miembros activos", value: totalMembers.toString() },
          { label: "Organismos cubiertos", value: INSTITUTION_ORDER.length.toString() },
          { label: "Con partido identificado", value: `${pctParty} %` },
          {
            label: "Último nombramiento",
            value: lastDate ? formatDate(lastDate) : "—",
          },
        ]}
      />

      {INSTITUTION_ORDER.map((inst) => {
        const group = byInstitution[inst]
        if (!group?.length) return null
        const meta = INSTITUTION_META[inst]
        return (
          <section key={inst} className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold">{meta.label}</h2>
              <p className="text-sm text-muted-foreground">
                {meta.description}{" "}
                <span className="text-xs">{meta.nominating}</span>
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  partyId={m.political_party ? partyMap[m.political_party.toLowerCase()] ?? null : null}
                />
              ))}
            </div>
          </section>
        )
      })}

      {members.length === 0 && (
        <EmptyState
          title="Sin datos"
          description="El ETL aún no ha cargado el YAML de nombramientos."
        />
      )}

      <InfoPanel title="Fuente">
        Los nombramientos se extraen del BOE y de las webs oficiales de cada organismo.
        El partido asociado corresponde al que respaldó la candidatura en el Congreso, el Senado,
        el CGPJ o el Gobierno según el caso. Las tarjetas con enlace dirigen a la ficha del/la
        diputado/a cuando la persona forma o ha formado parte del Congreso. El badge{" "}
        <span className="font-medium text-accent">Puerta giratoria</span>{" "}
        indica que existe un caso publicado y verificado en nuestra base de datos.
      </InfoPanel>
    </div>
  )
}
