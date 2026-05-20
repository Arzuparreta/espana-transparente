import type { Metadata } from "next"
import { ProfileEditor } from "@/components/profile/ProfileEditor"
import { ProfileLoginPrompt } from "@/components/profile/ProfileLoginPrompt"
import { getCurrentUserProfile } from "@/lib/data/user-profiles"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Perfil",
  description: "Perfil de usuario y opciones de cuenta.",
}

export default async function PerfilPage() {
  const data = await getCurrentUserProfile()
  if (!data) return <ProfileLoginPrompt />
  return <ProfileEditor initialData={data} />
}
