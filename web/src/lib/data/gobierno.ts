import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, throwDataError, type GobiernoMember, type MinistrioContract, type InstitucionMember } from "./shared"

export type { GobiernoMember, MinistrioContract, InstitucionMember }

export const getGobiernoActual = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("v_gobierno_actual")
      .select(
        "id, position_type, person_name, organization_name, political_party, politician_id, party_color, contract_count, total_amount_eur, government, start_date, source_url"
      )
    throwDataError(error, "government list")
    return (data ?? []) as GobiernoMember[]
  },
  ["gobierno-actual"],
  { revalidate: HOUR * 24 }
)

export const getMinistrioDetail = unstable_cache(
  async (id: string) => {
    const { data: member, error: memberError } = await supabase
      .from("v_gobierno_actual")
      .select(
        "id, position_type, person_name, organization_name, political_party, politician_id, party_color, contract_count, total_amount_eur, government, start_date, source_url"
      )
      .eq("id", id)
      .single()
    throwDataError(memberError, "ministry detail")

    if (!member) return { member: null, contracts: [] }

    const { data: contracts, error: contractsError } = await supabase
      .from("contracts")
      .select("id, title, amount, date, awarding_body, contractor, contractor_nif, contractor_is_sme, contractor_is_ute, award_amount, award_amount_with_taxes, award_date, contract_number, received_tender_quantity")
      .ilike("ministry_normalized", (member as GobiernoMember).organization_name)
      .order("amount", { ascending: false, nullsFirst: false })
      .limit(20)
    throwDataError(contractsError, "ministry contracts")

    return {
      member: member as GobiernoMember,
      contracts: (contracts ?? []) as MinistrioContract[],
    }
  },
  ["ministerio-detail"],
  { revalidate: HOUR * 6 }
)

export const getInstitucionById = unstable_cache(
  async (id: string) => {
    const { data, error } = await supabase
      .from("v_instituciones_actuales")
      .select(
        "id, institution, position_title, person_name, political_party, nominating_body, appointment_date, source_url, party_color, photo_url, photo_variants, politician_id, has_revolving_door"
      )
      .eq("id", id)
      .maybeSingle()
    throwDataError(error, "institution detail")
    return (data ?? null) as InstitucionMember | null
  },
  ["institucion-by-id"],
  { revalidate: HOUR * 24 }
)

export const getInstitucionesActuales = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("v_instituciones_actuales")
      .select(
        "id, institution, position_title, person_name, political_party, nominating_body, appointment_date, source_url, party_color, photo_url, photo_variants, politician_id, has_revolving_door"
      )
    throwDataError(error, "institution list")
    return (data ?? []) as InstitucionMember[]
  },
  ["instituciones-actuales"],
  { revalidate: HOUR * 24 }
)
