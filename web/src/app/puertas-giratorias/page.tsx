import { RevolvingDoorExplorer } from "@/components/politicians/RevolvingDoorExplorer"
import { getPartyAcronymMap, getRevolvingDoorCases } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Puertas giratorias",
  description: "Casos verificados de paso entre cargo público y actividad privada, con persona, organización y fuente pública.",
}

export interface RDCase {
  id: string
  person_name: string
  political_party: string
  public_role: string
  public_organization: string
  public_exit_date: string | null
  private_role: string
  private_organization: string
  private_start_date: string | null
  authorization_date: string | null
  cooling_off_months: number | null
  sector: string
  person_id: string | null
  organization_id: string | null
  primary_source_url: string | null
  source_url: string | null
  sources: RDSource[] | null
}

export interface RDSource {
  source_type: "primary" | "secondary" | "discovery"
  source_name: string
  source_url: string
  title: string | null
  published_at: string | null
  evidence_text: string | null
}

export default async function PuertasGiratoriasPage() {
  const [cases, partyMap] = await Promise.all([
    getRevolvingDoorCases(),
    getPartyAcronymMap(),
  ])
  return <RevolvingDoorExplorer cases={cases as RDCase[]} partyMap={partyMap} />
}
