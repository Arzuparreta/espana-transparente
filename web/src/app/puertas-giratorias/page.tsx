import { supabase } from "@/lib/supabase/client"
import { RevolvingDoorExplorer } from "@/components/politicians/RevolvingDoorExplorer"

export const revalidate = 3600

export interface RDCase {
  person_name: string
  political_party: string
  public_role: string
  public_organization: string
  private_role: string
  private_organization: string
  sector: string
  person_id: string | null
}

export default async function PuertasGiratoriasPage() {
  const { data } = await supabase
    .from("revolving_door")
    .select("person_name, political_party, public_role, public_organization, private_role, private_organization, sector, person_id")
    .order("person_name")

  return <RevolvingDoorExplorer cases={(data as RDCase[]) || []} />
}
