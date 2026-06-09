import { permanentRedirect } from "next/navigation"

export default function IndicadoresLegacyPage() {
  permanentRedirect("/economia?view=series")
}
