import { permanentRedirect } from "next/navigation"

export default function DineroPublicoLegacyPage() {
  permanentRedirect("/dinero?view=trazabilidad")
}
