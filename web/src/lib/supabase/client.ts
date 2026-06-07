import { createClient } from "@/lib/supabase/browser"
import { guardPublicDataClient } from "@/lib/supabase/data-query-guard"

export const supabase = guardPublicDataClient(createClient())
