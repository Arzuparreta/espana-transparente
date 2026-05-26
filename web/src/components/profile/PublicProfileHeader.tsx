import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { UserProfile } from "@/types"

interface PublicProfileHeaderProps {
  profile: UserProfile
  avatarUrl: string | null
}

export function PublicProfileHeader({ profile, avatarUrl }: PublicProfileHeaderProps) {
  const name = profile.display_name ?? profile.handle ?? "Usuario"
  const initial = name.trim()[0]?.toUpperCase() ?? "U"

  return (
    <section className="rounded-[2px] border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar size="lg" className="size-20">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-xl font-semibold">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Perfil de usuario
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-[-0.03em] sm:text-5xl">
            {name}
          </h1>
          {profile.handle ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">@{profile.handle}</p>
          ) : null}
          {profile.bio ? (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {profile.bio}
            </p>
          ) : null}
          <div className="mt-4 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {profile.location ? <span>{profile.location}</span> : null}
            {profile.website_url ? (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Web
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
