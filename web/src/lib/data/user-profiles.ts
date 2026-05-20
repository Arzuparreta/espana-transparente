import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { DEFAULT_PUBLIC_PROFILE_OPTIONS, USER_AVATAR_BUCKET } from "@/lib/profile"
import type { PublicProfileOptions, UserProfile, UserProfileSettings } from "@/types"

type RawProfile = Omit<UserProfile, "public_options"> & {
  public_options: Partial<PublicProfileOptions> | null
}

export interface CurrentUserProfileData {
  user: {
    id: string
    email: string | null
  }
  profile: UserProfile
  settings: UserProfileSettings
  avatarUrl: string | null
}

export interface PublicUserProfileData {
  profile: UserProfile
  avatarUrl: string | null
  annotations: PublicUserAnnotation[]
}

export interface PublicUserAnnotation {
  id: string
  body: string
  created_at: string
  entity_type: string
  entity_id: string
}

function normalizeProfile(profile: RawProfile): UserProfile {
  return {
    ...profile,
    public_options: {
      ...DEFAULT_PUBLIC_PROFILE_OPTIONS,
      ...(profile.public_options ?? {}),
    },
  }
}

async function createSignedAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from(USER_AVATAR_BUCKET)
      .createSignedUrl(path, 60 * 10)
    if (error) return null
    return data.signedUrl
  } catch {
    return null
  }
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfileData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<RawProfile>()

  const profile = profileRow
    ? normalizeProfile(profileRow)
    : normalizeProfile({
        id: user.id,
        handle: null,
        display_name: null,
        bio: null,
        website_url: null,
        location: null,
        avatar_path: null,
        is_public: false,
        public_options: DEFAULT_PUBLIC_PROFILE_OPTIONS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

  const { data: settingsRow } = await supabase
    .from("user_profile_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<UserProfileSettings>()

  const settings =
    settingsRow ??
    ({
      user_id: user.id,
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies UserProfileSettings)

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    profile,
    settings,
    avatarUrl: await createSignedAvatarUrl(profile.avatar_path),
  }
}

export async function getPublicUserProfile(handle: string): Promise<PublicUserProfileData | null> {
  const supabase = await createClient()
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("handle", handle)
    .eq("is_public", true)
    .maybeSingle<RawProfile>()

  if (!profileRow) return null

  const profile = normalizeProfile(profileRow)
  const shouldShowAnnotations = profile.public_options.show_recent_annotations
  const shouldShowAvatar = profile.public_options.show_avatar
  const { data: annotations } = shouldShowAnnotations
    ? await supabase
        .from("annotations")
        .select("id, body, created_at, entity_type, entity_id")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(8)
        .returns<PublicUserAnnotation[]>()
    : { data: [] as PublicUserAnnotation[] }

  return {
    profile,
    avatarUrl: shouldShowAvatar ? await createSignedAvatarUrl(profile.avatar_path) : null,
    annotations: annotations ?? [],
  }
}

export async function getPublicProfilesByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, UserProfile>()

  const supabase = await createClient()
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .in("id", ids)
    .eq("is_public", true)
    .returns<RawProfile[]>()

  return new Map((data ?? []).map((row) => [row.id, normalizeProfile(row)]))
}
