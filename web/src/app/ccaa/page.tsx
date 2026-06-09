import { permanentRedirect } from "next/navigation"

export default function CcaaLegacyPage() {
  permanentRedirect("/territorio?view=autonomico")
}
