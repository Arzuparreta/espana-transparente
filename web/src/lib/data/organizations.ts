import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE, type OrganizationPublicRow } from "./shared"

export const getOrganizationsList = unstable_cache(
  async (page: number) => {
    const offset = (page - 1) * PAGE_SIZE.organizations
    const { data, count } = await supabase
      .from("v_organization_public")
      .select("id, name, organization_type, sector, country, contract_count, subsidy_beneficiary_count, subsidy_granting_count, revolving_door_count", { count: "exact" })
      .order("contract_count", { ascending: false, nullsFirst: false })
      .range(offset, offset + 49)
    return { organizations: data ?? [], total: count ?? 0 }
  },
  ["organizations-list"],
  { revalidate: HOUR }
)

export const getOrganizationPageData = unstable_cache(
  async (id: string) => {
    const [organization, contracts, beneficiarySubsidies, grantingSubsidies, revolvingDoorCases] =
      await Promise.all([
        supabase.from("v_organization_public").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("contracts")
          .select("id, title, amount, date, source_url")
          .or(`awarding_body_organization_id.eq.${id},contractor_organization_id.eq.${id}`)
          .order("date", { ascending: false })
          .limit(20),
        supabase
          .from("subsidies")
          .select("id, beneficiario, importe, fecha_concesion, source_url")
          .eq("beneficiary_organization_id", id)
          .order("fecha_concesion", { ascending: false })
          .limit(20),
        supabase
          .from("subsidies")
          .select("id, nivel3, beneficiario, importe, fecha_concesion, source_url")
          .eq("granting_body_organization_id", id)
          .order("fecha_concesion", { ascending: false })
          .limit(20),
        supabase
          .from("v_revolving_door_public")
          .select("id, person_name, person_id, private_role, private_organization, public_role, public_organization, private_start_date, primary_source_url, source_url")
          .eq("organization_id", id)
          .order("private_start_date", { ascending: false, nullsFirst: false })
          .limit(20),
      ])

    return {
      organization: organization.data as OrganizationPublicRow | null,
      contracts: contracts.data ?? [],
      beneficiarySubsidies: beneficiarySubsidies.data ?? [],
      grantingSubsidies: grantingSubsidies.data ?? [],
      revolvingDoorCases: revolvingDoorCases.data ?? [],
    }
  },
  ["organization-page-data"],
  { revalidate: HOUR }
)
