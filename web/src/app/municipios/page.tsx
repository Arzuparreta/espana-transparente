import { permanentRedirect } from "next/navigation"

export default function MunicipiosLegacyPage() {
  permanentRedirect("/territorio?view=municipal")
}
