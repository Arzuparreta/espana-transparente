import Link from "next/link"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { StatGrid } from "@/components/domain/StatGrid"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { getInstitucionesActuales, type InstitucionMember } from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const revalidate = 3600 * 24

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

function MemberCard({ member }: { member: InstitucionMember }) {
  const color = getPartyColor(member.party_color)
  const nameFormatted = formatName(member.person_name)

  const inner = (
    <div
      data-slot="card"
      className="flex min-h-[6rem] flex-col justify-between rounded-xl border bg-card/80 p-4 transition-colors hover:bg-card"
      style={{ borderColor: `${color}28` }}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium leading-snug text-muted-foreground line-clamp-1">
          {member.position_title}
          {member.nominating_body ? ` · ${member.nominating_body}` : ""}
        </p>
        <p className="font-semibold leading-snug">{nameFormatted}</p>
      </div>

      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <PartyBadge
          acronym={member.political_party ?? "—"}
          color={member.party_color ?? undefined}
        />
        <div className="flex shrink-0 items-center gap-2">
          {member.has_revolving_door && (
            <Link
              href="/puertas-giratorias"
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              onClick={(e) => e.stopPropagation()}
            >
              Puerta giratoria →
            </Link>
          )}
          {member.source_url && (
            <a
              href={member.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs text-muted-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              BOE
            </a>
          )}
        </div>
      </div>

      {member.appointment_date && (
        <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          Desde {formatDate(member.appointment_date)}
        </p>
      )}
    </div>
  )

  if (member.politician_id) {
    return (
      <Link href={`/diputados/${member.politician_id}`} className="block">
        {inner}
      </Link>
    )
  }
  return inner
}

export default async function InstitucionesPage() {
  const members = await getInstitucionesActuales()

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
        description="Magistrados, vocales y consejeros designados por partidos políticos en el Tribunal Constitucional, el CGPJ, RTVE y la SEPI."
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
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          </section>
        )
      })}

      {members.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin datos disponibles. El ETL aún no ha cargado el YAML de nombramientos.
        </p>
      )}

      <InfoPanel title="Fuente y metodología">
        Los nombramientos se extraen del BOE y de las webs oficiales de cada organismo.
        El partido asociado corresponde al que respaldó la candidatura en el Congreso, el Senado,
        el CGPJ o el Gobierno según el caso. Las tarjetas con enlace dirigen a la ficha del/la
        diputado/a cuando la persona forma o ha formado parte del Congreso. El badge{" "}
        <span className="font-medium text-amber-700 dark:text-amber-400">Puerta giratoria</span>{" "}
        indica que existe un caso publicado y verificado en nuestra base de datos.
      </InfoPanel>
    </div>
  )
}
