import { permanentRedirect } from "next/navigation"

export default function DivergenciasLegacyPage() {
  permanentRedirect("/diputados?view=divergencias")
}
