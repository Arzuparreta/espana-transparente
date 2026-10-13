import { supabase } from "@/lib/supabase/public";
import {
  unstable_cache,
  HOUR,
  dataQuerySignal,
  dataErrorMessage,
} from "./shared";
import { senateControlData, type SenateControlRow } from "@/lib/senate-control";
export const getSenateControl = unstable_cache(
  async () => {
    try {
      const [coverage, records] = await Promise.all([
        supabase
          .from("senate_control_coverage")
          .select("metadata")
          .eq("scope", "senate-15-housing")
          .abortSignal(dataQuerySignal())
          .maybeSingle(),
        supabase
          .from("senate_control_initiatives")
          .select("*")
          .eq("legislature", 15)
          .order("presentation_date", { ascending: false })
          .order("number")
          .limit(1000)
          .abortSignal(dataQuerySignal()),
      ]);
      if (coverage.error) throw coverage.error;
      if (records.error) throw records.error;
      if (!coverage.data && !records.data?.length)
        return { data: null, error: false };
      const data = senateControlData(
        (records.data ?? []) as SenateControlRow[],
        coverage.data?.metadata,
      );
      if (!data) throw new Error("Senate control coverage is inconsistent");
      return { data, error: false };
    } catch (error) {
      console.error("Senate control", dataErrorMessage(error));
      return { data: null, error: true };
    }
  },
  ["senate-control-v1"],
  { revalidate: HOUR },
);
