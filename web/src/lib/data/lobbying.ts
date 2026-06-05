import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE } from "./shared"

export const getLobbyingGroupsPage = unstable_cache(
  async (page: number, category?: string | null, query?: string | null) => {
    const from = (page - 1) * PAGE_SIZE.lobbyingGroups
    const to = from + PAGE_SIZE.lobbyingGroups - 1

    let dbQuery = supabase
      .from("lobbying_groups")
      .select(
        "id, name, slug, category, subcategory, objectives, interest_areas, source_url, updated_at",
        { count: "exact" }
      )

    if (category) {
      dbQuery = dbQuery.eq("category", category)
    }
    if (query?.trim()) {
      dbQuery = dbQuery.ilike("name", `%${query.trim()}%`)
    }

    const { data, count, error } = await dbQuery
      .order("name", { ascending: true })
      .range(from, to)

    if (error) {
      console.error("getLobbyingGroupsPage error:", error)
      return { groups: [], total: 0, categories: [] }
    }

    // Get categories for filter pills
    const { data: catData } = await supabase
      .from("lobbying_groups")
      .select("category", { head: false })
      .not("category", "is", null)
      .order("category", { ascending: true })

    const categories = Array.from(
      new Set((catData ?? []).map((c) => c.category).filter(Boolean))
    ) as string[]

    return { groups: data ?? [], total: count ?? 0, categories }
  },
  ["lobbying-groups-page"],
  { revalidate: HOUR * 6 }
)

export const getLobbyingGroupById = unstable_cache(
  async (id: string) => {
    const [groupResult, linksResult] = await Promise.all([
      supabase
        .from("lobbying_groups")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("lobbying_organization_links")
        .select("id, confidence, match_method, organization_id, reviewed, organizations(id, name)")
        .eq("lobbying_group_id", id)
        .eq("reviewed", true)
        .order("created_at", { ascending: false })
        .limit(10),
    ])

    return {
      group: groupResult.data,
      links: linksResult.data ?? [],
    }
  },
  ["lobbying-group-detail"],
  { revalidate: HOUR }
)

export const getLobbyingCategories = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("lobbying_groups")
      .select("category", { head: false })
      .not("category", "is", null)
      .order("category", { ascending: true })

    return Array.from(
      new Set((data ?? []).map((c) => c.category).filter(Boolean))
    ) as string[]
  },
  ["lobbying-categories"],
  { revalidate: HOUR * 24 }
)
