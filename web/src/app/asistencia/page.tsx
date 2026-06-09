import { permanentRedirect } from "next/navigation"

export default function AsistenciaLegacyPage() {
  permanentRedirect("/diputados?view=asistencia")
}
