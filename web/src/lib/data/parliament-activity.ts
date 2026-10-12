import { supabase } from "@/lib/supabase/client";
import {
  unstable_cache,
  HOUR,
  dataQuerySignal,
  dataErrorMessage,
} from "./shared";
import {
  activityCoverage,
  selectActivityYear,
  validateActivity,
  type ActivityRow,
} from "@/lib/parliament-activity";
export const getParliamentActivity = unstable_cache(
  async (requested?: string | string[]) => {
    try {
      const coverageResult = await supabase
        .from("parliament_activity_coverage")
        .select("metadata")
        .eq("scope", "congreso-15-housing")
        .abortSignal(dataQuerySignal())
        .maybeSingle();
      if (coverageResult.error) throw coverageResult.error;
      const coverage = activityCoverage(coverageResult.data?.metadata);
      const year = selectActivityYear(coverage, requested);
      if (!coverage || !year) return { coverage, year, rows: [], error: false };
      const result = await supabase
        .from("parliament_activity")
        .select("*")
        .eq("legislature", 15)
        .eq("topic", "housing")
        .gte("event_date", `${year}-01-01`)
        .lt("event_date", `${Number(year) + 1}-01-01`)
        .order("event_date", { ascending: false })
        .order("id")
        .limit(1000)
        .abortSignal(dataQuerySignal());
      if (result.error) throw result.error;
      const rows = (result.data ?? []) as ActivityRow[];
      if (
        !validateActivity(
          rows,
          year,
          coverage.years[year],
          coverage.dataset_sha256,
        )
      )
        throw new Error("Activity coverage and rows disagree");
      return { coverage, year, rows, error: false };
    } catch (error) {
      console.error("Parliament activity", dataErrorMessage(error));
      return { coverage: null, year: undefined, rows: [], error: true };
    }
  },
  ["parliament-activity-v1"],
  { revalidate: HOUR },
);
