import type { MoneyFlowSection } from "@/lib/data/money-flow"

// The SQL view repeats the same historical operations on every budget
// section sharing a ministry. Count each ministry once, never each section.
export function summarizeMinistryAssociations(sections: MoneyFlowSection[]) {
  const ministries = new Map<string, MoneyFlowSection>()
  for (const section of sections) {
    if (section.ministry_normalized && !ministries.has(section.ministry_normalized)) {
      ministries.set(section.ministry_normalized, section)
    }
  }
  return [...ministries.values()].reduce(
    (sum, section) => ({
      contractCount: sum.contractCount + section.contract_count,
      subsidyCount: sum.subsidyCount + section.subsidy_count,
    }),
    { contractCount: 0, subsidyCount: 0 },
  )
}
