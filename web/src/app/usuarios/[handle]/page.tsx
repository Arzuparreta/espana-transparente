import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PublicProfileHeader } from "@/components/profile/PublicProfileHeader"
import { getPublicUserProfile } from "@/lib/data/user-profiles"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { handle: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getPublicUserProfile(params.handle)
  if (!data) return { title: "Usuario no encontrado" }
  const name = data.profile.display_name ?? `@${data.profile.handle}`
  return {
    title: name,
    description: data.profile.bio ?? `Perfil público de ${name}`,
  }
}

export default async function UsuarioPage({ params }: PageProps) {
  const data = await getPublicUserProfile(params.handle)
  if (!data) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ContextTrail
        section={{ href: "/usuarios", label: "Usuarios" }}
        current={data.profile.display_name ?? `@${data.profile.handle}`}
        fallbackHref="/"
        fallbackLabel="Volver al inicio"
        related={[{ href: "/buscar", label: "Buscar" }]}
      />
      <PublicProfileHeader profile={data.profile} avatarUrl={data.avatarUrl} />

      {data.profile.public_options.show_recent_annotations ? (
        <section className="rounded border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
          <h2 className="text-lg font-semibold">Anotaciones recientes</h2>
          {data.annotations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sin anotaciones públicas recientes.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.annotations.map((annotation) => (
                <article key={annotation.id} className="border-l-2 border-border py-1 pl-3">
                  <p className="text-sm leading-6">{annotation.body}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.10em] text-muted-foreground">
                    {new Date(annotation.created_at).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
