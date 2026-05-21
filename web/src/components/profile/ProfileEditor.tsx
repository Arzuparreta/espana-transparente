"use client"

import { useMemo, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { USER_AVATAR_BUCKET } from "@/lib/profile"
import { supabase } from "@/lib/supabase/client"
import type { PublicProfileOptions, UserProfile, UserProfileSettings } from "@/types"

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]

interface ProfileEditorProps {
  initialData: {
    user: {
      id: string
      email: string | null
    }
    profile: UserProfile
    settings: UserProfileSettings
    avatarUrl: string | null
  }
}

export function ProfileEditor({ initialData }: ProfileEditorProps) {
  const [profile, setProfile] = useState<UserProfile>(initialData.profile)
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl)
  const [handle, setHandle] = useState(profile.handle ?? "")
  const [displayName, setDisplayName] = useState(profile.display_name ?? "")
  const [bio, setBio] = useState(profile.bio ?? "")
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? "")
  const [location, setLocation] = useState(profile.location ?? "")
  const [isPublic, setIsPublic] = useState(profile.is_public)
  const [publicOptions, setPublicOptions] = useState<PublicProfileOptions>(profile.public_options)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const publicUrl = useMemo(() => {
    if (!profile.handle || !profile.is_public) return null
    return `/usuarios/${profile.handle}`
  }, [profile.handle, profile.is_public])

  function normalizeHandle(value: string) {
    return value.trim().toLowerCase()
  }

  function getInitial() {
    return (displayName || initialData.user.email || "?").trim()[0]?.toUpperCase() ?? "?"
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")

    const normalizedHandle = normalizeHandle(handle)
    // Normalize scheme to lowercase so it satisfies the case-sensitive DB constraint.
    const cleanedWebsite = websiteUrl.trim().replace(/^https?:\/\//i, (m) => m.toLowerCase())
    const nextIsPublic = isPublic

    if (normalizedHandle && !HANDLE_RE.test(normalizedHandle)) {
      setError("El identificador debe tener 3-32 caracteres: minúsculas, números, guion o guion bajo.")
      setSaving(false)
      return
    }

    if (nextIsPublic && (!normalizedHandle || !displayName.trim())) {
      setError("Para publicar el perfil necesitas identificador y nombre visible.")
      setSaving(false)
      return
    }

    if (cleanedWebsite && !/^https?:\/\//.test(cleanedWebsite)) {
      setError("La web debe empezar por http:// o https://.")
      setSaving(false)
      return
    }

    const payload = {
      id: initialData.user.id,
      handle: normalizedHandle || null,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      website_url: cleanedWebsite || null,
      location: location.trim() || null,
      is_public: nextIsPublic,
      public_options: publicOptions,
    }

    const { data, error: saveError } = await supabase
      .from("user_profiles")
      .upsert(payload)
      .select("*")
      .single()

    if (saveError) {
      console.error("[ProfileEditor] upsert error:", saveError)
      if (saveError.code === "23505") {
        setError("Ese identificador ya está en uso.")
      } else {
        setError(`No se pudo guardar el perfil. (${saveError.code ?? saveError.message})`)
      }
      setSaving(false)
      return
    }

    const { error: settingsError } = await supabase
      .from("user_profile_settings")
      .upsert({ user_id: initialData.user.id, settings: initialData.settings.settings ?? {} })

    if (settingsError) {
      console.error("[ProfileEditor] settings upsert error:", settingsError)
    }

    setProfile(data as UserProfile)
    setMessage("Perfil guardado.")
    setSaving(false)
  }

  async function uploadAvatar(file: File | null) {
    if (!file) return
    setUploading(true)
    setError("")
    setMessage("")

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError("La foto debe ser JPG, PNG o WebP.")
      setUploading(false)
      return
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setError("La foto no puede superar 5 MB.")
      setUploading(false)
      return
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp"
    const path = `${initialData.user.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from(USER_AVATAR_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      setError("No se pudo subir la foto.")
      setUploading(false)
      return
    }

    const previousAvatarPath = profile.avatar_path
    const { data, error: saveError } = await supabase
      .from("user_profiles")
      .upsert({ id: initialData.user.id, avatar_path: path })
      .select("*")
      .single()

    if (saveError) {
      setError("La foto se subió, pero no se pudo asociar al perfil.")
      setUploading(false)
      return
    }

    if (previousAvatarPath) {
      await supabase.storage.from(USER_AVATAR_BUCKET).remove([previousAvatarPath])
    }

    const { data: signed } = await supabase.storage
      .from(USER_AVATAR_BUCKET)
      .createSignedUrl(path, 60 * 10)

    setAvatarUrl(signed?.signedUrl ?? null)
    setProfile(data as UserProfile)
    setMessage("Foto actualizada.")
    setUploading(false)
  }

  async function removeAvatar() {
    if (!profile.avatar_path) return
    setUploading(true)
    setError("")
    setMessage("")

    const path = profile.avatar_path
    const { data, error: saveError } = await supabase
      .from("user_profiles")
      .upsert({ id: initialData.user.id, avatar_path: null })
      .select("*")
      .single()

    if (saveError) {
      setError("No se pudo quitar la foto.")
      setUploading(false)
      return
    }

    await supabase.storage.from(USER_AVATAR_BUCKET).remove([path])
    setAvatarUrl(null)
    setProfile(data as UserProfile)
    setMessage("Foto eliminada.")
    setUploading(false)
  }

  function updateOption(key: keyof PublicProfileOptions, value: boolean) {
    setPublicOptions((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar size="lg" className="size-16">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-lg font-semibold">{getInitial()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Cuenta
              </p>
              <h1 className="font-display text-3xl font-black uppercase tracking-[-0.03em]">
                Perfil
              </h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">{initialData.user.email}</p>
            </div>
          </div>
          {publicUrl ? (
            <a
              href={publicUrl}
              className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Ver perfil público
            </a>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={saveProfile} className="space-y-6 rounded border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
          <div>
            <h2 className="text-lg font-semibold">Datos del perfil</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estos campos solo aparecen en la página pública si activas la visibilidad.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Identificador</span>
              <Input
                value={handle}
                onChange={(e) => setHandle(normalizeHandle(e.target.value))}
                placeholder="usuario"
                maxLength={32}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Nombre visible</span>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nombre"
                maxLength={80}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Bio</span>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Contexto público breve."
              maxLength={280}
              rows={4}
            />
            <span className="block text-right font-mono text-[10px] text-muted-foreground">
              {bio.length}/280
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Web</span>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Ubicación</span>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ciudad"
                maxLength={80}
              />
            </label>
          </div>

          <div className="space-y-3 rounded border border-border/70 bg-background/60 p-4">
            <label className="flex min-w-0 items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium">Perfil público</span>
                <span className="block text-sm text-muted-foreground">
                  Publica una página visible en /usuarios/{handle || "usuario"}.
                </span>
              </span>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
            </label>
            <label className="flex min-w-0 items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium">Mostrar foto</span>
                <span className="block text-sm text-muted-foreground">
                  La foto se sirve con URL firmada, no desde un bucket público.
                </span>
              </span>
              <input
                type="checkbox"
                checked={publicOptions.show_avatar}
                onChange={(e) => updateOption("show_avatar", e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
            </label>
            <label className="flex min-w-0 items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium">Mostrar anotaciones recientes</span>
                <span className="block text-sm text-muted-foreground">
                  Lista las últimas anotaciones públicas asociadas a tu cuenta.
                </span>
              </span>
              <input
                type="checkbox"
                checked={publicOptions.show_recent_annotations}
                onChange={(e) => updateOption("show_recent_annotations", e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
            </label>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar perfil"}
          </Button>
        </form>

        <aside className="space-y-4">
          <section className="rounded border border-border bg-card px-4 py-5">
            <h2 className="text-lg font-semibold">Foto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              JPG, PNG o WebP. Máximo 5 MB.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null)}
              />
              {profile.avatar_path ? (
                <Button type="button" variant="outline" onClick={removeAvatar} disabled={uploading}>
                  Quitar foto
                </Button>
              ) : null}
            </div>
          </section>

          <section className="rounded border border-border bg-card px-4 py-5">
            <h2 className="text-lg font-semibold">Opciones futuras</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              La estructura privada de preferencias ya existe para añadir controles sin cambiar el modelo base.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
