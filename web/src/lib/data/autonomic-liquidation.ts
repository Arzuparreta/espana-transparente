import { supabase } from "@/lib/supabase/public";
import {
  unstable_cache,
  HOUR,
  dataQuerySignal,
  dataErrorMessage,
} from "./shared";
import { liquidationData, type Observation } from "@/lib/autonomic-liquidation";
export const getAutonomicLiquidation = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("autonomic_liquidation")
        .select(
          "territory,year,chapter,initial,credit,obligations,payments,unit,raw_data",
        )
        .eq("year", 2024)
        .order("territory")
        .limit(1000)
        .abortSignal(dataQuerySignal());
      if (error) throw error;
      if (!data || data.length >= 1000)
        throw new Error("Incomplete liquidation response");
      return { ...liquidationData(data as Observation[]), error: false };
    } catch (error) {
      console.error("Autonomic liquidation", dataErrorMessage(error));
      return { regions: [], rejected: [], error: true };
    }
  },
  ["autonomic-liquidation-v1"],
  { revalidate: HOUR },
);
