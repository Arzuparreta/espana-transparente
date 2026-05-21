import { cookies, headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { getEtlPipelineLabel } from "@/lib/etl-pipelines"
import { AdminLoginForm } from "./login-form"

export const dynamic = "force-dynamic"

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnnotationRow {
  id: string
  body: string
  entity_type: string
  entity_id: string
  created_at: string
  updated_at: string
  is_hidden: boolean
  user_id: string
  user_email: string | null
  user_handle: string | null
  user_display_name: string | null
}

interface AnomalyUser {
  user_id: string
  email: string | null
  handle: string | null
  display_name: string | null
  count: number
  first_at: string
  last_at: string
}

interface SignupRow {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  confirmed_at: string | null
  has_profile: boolean
}

interface PipelineRow {
  pipeline: string
  last_status: string | null
  last_finished_at: string | null
}

// ── Labels ─────────────────────────────────────────────────────────────────────

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

function entityLink(entityType: string, entityId: string) {
  const base = "https://espana-transparente.vercel.app"
  switch (entityType) {
    case "politician":
      return `${base}/diputados/${entityId}`
    case "contract":
      return `${base}/contratos/${entityId}`
    case "subsidy":
      return `${base}/subvenciones/${entityId}`
    case "voting_session":
      return `${base}/votaciones/${entityId}`
    case "initiative":
      return `${base}/iniciativas/${entityId}`
    case "organization":
      return `${base}/organizaciones/${entityId}`
    case "party":
      return `${base}/partidos/${entityId}`
    case "budget":
      return `${base}/presupuestos/${entityId}`
    case "eu_fund":
      return `${base}/fondos-ue/${entityId}`
    default:
      return `${base}`
  }
}

function entityLabel(entityType: string) {
  const map: Record<string, string> = {
    politician: "Diputado/a",
    senator: "Senador/a",
    contract: "Contrato",
    subsidy: "Subvención",
    voting_session: "Votación",
    initiative: "Iniciativa",
    organization: "Organización",
    party: "Partido",
    budget: "Presupuesto",
    eu_fund: "Fondo UE",
    institution: "Institución",
    revolving_door: "Puerta giratoria",
  }
  return map[entityType] ?? entityType
}

// ── Data fetchers ──────────────────────────────────────────────────────────────

async function fetchAnnotations(): Promise<AnnotationRow[]> {
  const admin = createAdminClient()

  const { data: annos } = await admin
    .from("annotations")
    .select("id, body, entity_type, entity_id, created_at, updated_at, is_hidden, user_id")
    .order("created_at", { ascending: false })
    .limit(500)

  if (!annos?.length) return []

  const userIds = Array.from(new Set(annos.map((a) => a.user_id)))

  const [
    { data: usersResp },
    { data: profiles },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: userIds.length }),
    admin.from("user_profiles").select("id, handle, display_name").in("id", userIds),
  ])

  const emailById = new Map<string, string | null>()
  for (const u of usersResp?.users ?? []) {
    emailById.set(u.id, u.email ?? null)
  }

  const profileById = new Map(profiles?.map((p: { id: string; handle: string | null; display_name: string | null }) => [
    p.id,
    { handle: p.handle, displayName: p.display_name },
  ]) ?? [])

  return annos.map((a) => ({
    ...a,
    user_email: emailById.get(a.user_id) ?? null,
    user_handle: profileById.get(a.user_id)?.handle ?? null,
    user_display_name: profileById.get(a.user_id)?.displayName ?? null,
  })) as AnnotationRow[]
}

async function fetchSignups(): Promise<SignupRow[]> {
  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 100 })
  if (!users?.users) return []
  const userIds = users.users.map((u) => u.id)

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id")
    .in("id", userIds)

  const profileIds = new Set((profiles ?? []).map((p: { id: string }) => p.id))

  return users.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      confirmed_at: u.confirmed_at ?? null,
      has_profile: profileIds.has(u.id),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50)
}

async function fetchPipelines(): Promise<PipelineRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("v_etl_pipeline_status")
    .select("pipeline, last_status, last_finished_at")
    .order("pipeline")
  return (data ?? []) as PipelineRow[]
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword || token !== adminPassword) {
    return <AdminLoginForm />
  }

  let annotations: AnnotationRow[] = []
  let signups: SignupRow[] = []
  let pipelines: PipelineRow[] = []
  let fetchError: string | null = null

  try {
    [annotations, signups, pipelines] = await Promise.all([
      fetchAnnotations(),
      fetchSignups(),
      fetchPipelines(),
    ])
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Error al conectar con la base de datos"
    console.error("Admin fetch error:", e)
  }

  // ── Derived metrics ────────────────────────────────────────────────────────

  const now = Date.now()
  const last24h = new Date(now - 86400000).toISOString()

  const annotationsToday = annotations.filter((a) => a.created_at >= last24h).length
  const totalAnnotations = annotations.length
  const hiddenCount = annotations.filter((a) => a.is_hidden).length
  const visibleCount = totalAnnotations - hiddenCount

  // Users who signed up in the last 24h
  const signupsToday = signups.filter((s) => s.created_at >= last24h).length

  // Rapid-fire posters (>3 annotations in the last 24h)
  const userAnno24h = new Map<string, AnomalyUser>()
  for (const a of annotations) {
    if (a.created_at < last24h) continue
    const entry = userAnno24h.get(a.user_id)
    if (entry) {
      entry.count++
      if (a.created_at < entry.first_at) entry.first_at = a.created_at
      if (a.created_at > entry.last_at) entry.last_at = a.created_at
    } else {
      userAnno24h.set(a.user_id, {
        user_id: a.user_id,
        count: 1,
        email: a.user_email,
        handle: a.user_handle,
        display_name: a.user_display_name,
        first_at: a.created_at,
        last_at: a.created_at,
      })
    }
  }

  const rapidFireUsers: AnomalyUser[] = Array.from(userAnno24h.entries())
    .filter(([, v]) => v.count >= 3)
    .map(([, v]) => v)
    .sort((a, b) => b.count - a.count)

  // Fresh-account posters: signed up < 24h ago and already posted
  const freshSignupIds = new Set(
    signups.filter((s) => s.created_at >= last24h).map((s) => s.id)
  )
  const freshAccountPosters = annotations.filter((a) => freshSignupIds.has(a.user_id))

  // Pipeline failures
  const failedPipelines = pipelines.filter((p) => p.last_status === "failed")

  // Health metric: site alive (use request host to avoid Vercel self-fetch redirects)
  let siteStatus: string = "unknown"
  let siteLatency = 0
  try {
    const headersList = await headers()
    const host = headersList.get("host") || "espana-transparente.vercel.app"
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
    const t0 = Date.now()
    const res = await fetch(`${protocol}://${host}/api/health`, {
      next: { revalidate: 0 },
      headers: { "x-vercel-skip-toolbar": "1" },
    })
    siteLatency = Date.now() - t0
    siteStatus = res.ok ? "ok" : `${res.status}`
  } catch {
    siteStatus = "down"
  }

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="rounded-[2px] border border-red-500/30 bg-red-500/5 p-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.10em] text-red-400">
            Error de conexión
          </p>
          <p className="mt-1 font-mono text-[12px] leading-relaxed text-red-300/80">
            {fetchError}
          </p>
        </div>
      )}
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.10em] text-[#999992]">
            Internal dashboard
          </p>
        </div>
        <span className="font-mono text-[11px] text-[#999992]">
          {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", weekday: "long" })}
        </span>
      </div>

      {/* ── Alert banner ────────────────────────────────────────────── */}
      {(rapidFireUsers.length > 0 || freshAccountPosters.length > 0 || failedPipelines.length > 0) && (
        <div className="rounded-[2px] border border-red-500/30 bg-red-500/5 p-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.10em] text-red-400">
            Alertas
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-red-300/80">
            {rapidFireUsers.length > 0 && (
              <li>
                {rapidFireUsers.length} usuario{rapidFireUsers.length !== 1 ? "s" : ""} con alta actividad en 24h:{" "}
                {rapidFireUsers.map((u, i) => (
                  <span key={u.user_id}>
                    {i > 0 && ", "}
                    <span className="font-mono text-[11px]">{u.email ?? u.display_name ?? u.handle ?? "desconocido"}</span>
                    {" "}({u.count} anotaciones)
                  </span>
                ))}
              </li>
            )}
            {freshAccountPosters.length > 0 && (
              <li>{freshAccountPosters.length} anotación{freshAccountPosters.length !== 1 ? "es" : ""} de cuentas creadas en las últimas 24h.</li>
            )}
            {failedPipelines.length > 0 && (
              <li>
                {failedPipelines.length} pipeline{failedPipelines.length !== 1 ? "s" : ""} ETL con error:{" "}
                {failedPipelines.map((p) => getEtlPipelineLabel(p.pipeline)).join(", ")}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ── Health cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[2px] border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">Usuarios</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{signups.length}</p>
          <p className="mt-0.5 text-[12px] text-[#999992]">
            {signupsToday} hoy
          </p>
        </div>
        <div className="rounded-[2px] border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">Anotaciones</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalAnnotations}</p>
          <p className="mt-0.5 text-[12px] text-[#999992]">
            {annotationsToday} en 24h · {hiddenCount} ocultas
          </p>
        </div>
        <div className="rounded-[2px] border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">Site</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${
            siteStatus === "ok" ? "text-green-500" : siteStatus === "down" ? "text-red-500" : "text-yellow-500"
          }`}>
            {siteStatus === "ok" ? "OK" : siteStatus === "down" ? "Down" : siteStatus}
          </p>
          <p className="mt-0.5 text-[12px] text-[#999992]">{siteLatency}ms</p>
        </div>
        <div className="rounded-[2px] border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">ETL</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${
            pipelines.length === 0 ? "text-[#999992]" : failedPipelines.length === 0 ? "text-green-500" : "text-red-500"
          }`}>
            {pipelines.length === 0 ? "—" : `${pipelines.filter((p) => p.last_status === "succeeded").length}/${pipelines.length}`}
          </p>
          <p className="mt-0.5 text-[12px] text-[#999992]">
            {pipelines.length === 0 ? "Sin datos" : failedPipelines.length > 0 ? `${failedPipelines.length} con error` : "Todos OK"}
          </p>
        </div>
      </div>

      {/* ── Annotations ─────────────────────────────────────────────── */}
      <section className="rounded-[2px] border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Anotaciones</h2>
          <span className="font-mono text-[11px] text-[#999992]">
            {visibleCount} visibles · {hiddenCount} ocultas
          </span>
        </div>

        {annotations.length === 0 ? (
          <p className="mt-6 py-4 text-center font-mono text-[11px] text-[#999992]">
            Sin anotaciones.
          </p>
        ) : (
          <div className="mt-4 space-y-px">
            {annotations.slice(0, 100).map((a) => (
              <div
                key={a.id}
                className={`group flex items-start justify-between gap-4 border-l-2 px-3 py-2.5 transition-colors ${
                  a.is_hidden
                    ? "border-red-500/30 bg-red-500/[0.03]"
                    : "border-border/40 bg-transparent hover:border-[#C8FF00]/30"
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-[13px] leading-relaxed ${
                    a.is_hidden ? "text-[#999992]/50 line-through" : "text-[#EEEDE9]"
                  }`}>
                    {a.body}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[#999992]">
                    <span className="font-mono uppercase tracking-[0.06em]">
                      {a.user_handle ? `@${a.user_handle}` : a.user_email ?? "desconocido"}
                    </span>
                    <span className="font-mono">{timeAgo(a.created_at)}</span>
                    <span>{entityLabel(a.entity_type)}</span>
                    <a
                      href={entityLink(a.entity_type, a.entity_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-mono text-[10px] hover:text-[#EEEDE9] transition-colors"
                    >
                      ver →
                    </a>
                    {a.is_hidden && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-red-400/70">oculta</span>
                    )}
                  </div>
                </div>
                <form
                  action="/api/admin/annotations"
                  method="POST"
                  className="shrink-0"
                >
                  <input type="hidden" name="action" value={a.is_hidden ? "show" : "hide"} />
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors ${
                      a.is_hidden
                        ? "text-green-500/70 hover:text-green-400"
                        : "opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400"
                    }`}
                  >
                    {a.is_hidden ? "Mostrar" : "Ocultar"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Signups ─────────────────────────────────────────────────── */}
      <section className="rounded-[2px] border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Registros recientes</h2>
          <span className="font-mono text-[11px] text-[#999992]">
            {signups.length} · {signupsToday} en 24h
          </span>
        </div>

        {signups.length === 0 ? (
          <p className="mt-6 py-4 text-center font-mono text-[11px] text-[#999992]">
            Sin registros.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="text-left font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Registro</th>
                  <th className="pb-2 pr-4 font-medium">Último acceso</th>
                  <th className="pb-2 pr-4 font-medium">Confirmado</th>
                  <th className="pb-2 font-medium">Perfil</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="py-2.5 pr-4 font-mono text-[12px]">{s.email ?? "—"}</td>
                    <td className="py-2.5 pr-4">{formatDateTime(s.created_at)}</td>
                    <td className="py-2.5 pr-4">{formatDateTime(s.last_sign_in_at)}</td>
                    <td className="py-2.5 pr-4">
                      {s.confirmed_at ? (
                        <span className="text-green-500/80">Sí</span>
                      ) : (
                        <span className="text-yellow-500/80">No</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {s.has_profile ? (
                        <span className="text-green-500/80">Público</span>
                      ) : (
                        <span className="text-[#999992]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── ETL Pipelines ───────────────────────────────────────────── */}
      <section className="rounded-[2px] border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Pipelines ETL</h2>

        {pipelines.length === 0 ? (
          <p className="mt-6 py-4 text-center font-mono text-[11px] text-[#999992]">
            Sin datos de pipelines.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="text-left font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Pipeline</th>
                  <th className="pb-2 pr-4 font-medium">Último éxito</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pipelines.map((p) => {
                  const label = getEtlPipelineLabel(p.pipeline)
                  const finishedAt = p.last_finished_at
                    ? new Date(p.last_finished_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
                    : "—"
                  const statusClass =
                    p.last_status === "succeeded"
                      ? "text-green-500/80"
                      : p.last_status === "failed"
                      ? "text-red-500/80"
                      : "text-[#999992]"

                  return (
                    <tr key={p.pipeline} className="border-t border-border/60">
                      <td className="py-2.5 pr-4 font-medium">{label}</td>
                      <td className="py-2.5 pr-4 font-mono text-[12px]">{finishedAt}</td>
                      <td className={`py-2.5 font-mono text-[10px] uppercase tracking-[0.06em] ${statusClass}`}>
                        {p.last_status === "succeeded" ? "OK" : p.last_status === "failed" ? "Error" : p.last_status ?? "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
