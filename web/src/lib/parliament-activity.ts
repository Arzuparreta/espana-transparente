export const ACTIVITY_SOURCE =
  "https://www.congreso.es/es/opendata/intervenciones";
export const ACTIVITY_VERSION = "housing-title-words-v1";
export interface ActivityRow {
  id: string;
  legislature: number;
  topic: string;
  event_date: string;
  initiative_number: string;
  title: string;
  initiative_type: string;
  kind: "intervention" | "voting_record";
  body: string | null;
  phase: string | null;
  speaker: string | null;
  speaker_role: string | null;
  proposer_label: string | null;
  documents: string[];
  title_signal: string;
  mapping_version: string;
  dataset_sha256: string;
  politician_id: string | null;
  official_id: string | null;
}
export interface ActivityYear {
  universe: number;
  selected: number;
  interventions: number;
  voting_records: number;
}
export interface ActivityCoverage {
  source: string;
  dataset_url: string;
  retrieved_at: string;
  legislature: number;
  topic: string;
  mapping_version: string;
  dataset_sha256: string;
  universe: number;
  selected: number;
  without_title_signal: number;
  unlocated_dates: number;
  years: Record<string, ActivityYear>;
}
export function activityCoverage(raw: unknown): ActivityCoverage | null {
  const m = raw as ActivityCoverage | undefined;
  const count = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (
    !m ||
    m.legislature !== 15 ||
    m.topic !== "housing" ||
    m.mapping_version !== ACTIVITY_VERSION ||
    !/^https:\/\/www\.congreso\.es\/webpublica\/opendata\/intervenciones\/IntervencionesIniciativa__\d+\.json$/.test(
      m.dataset_url ?? "",
    ) ||
    !/^[a-f0-9]{64}$/.test(m.dataset_sha256 ?? "") ||
    !Number.isFinite(Date.parse(m.retrieved_at ?? "")) ||
    !count(m.universe) ||
    !count(m.selected) ||
    !count(m.without_title_signal) ||
    !count(m.unlocated_dates) ||
    m.selected + m.without_title_signal !== m.universe ||
    !m.years ||
    typeof m.years !== "object"
  )
    return null;
  const years = Object.entries(m.years);
  if (
    !years.length ||
    years.some(
      ([y, v]) =>
        !/^20\d{2}$/.test(y) ||
        !v ||
        ![v.universe, v.selected, v.interventions, v.voting_records].every(
          count,
        ) ||
        v.interventions + v.voting_records !== v.selected ||
        v.selected > v.universe,
    ) ||
    years.reduce((sum, [, v]) => sum + v.universe, 0) + m.unlocated_dates !==
      m.universe ||
    years.reduce((sum, [, v]) => sum + v.selected, 0) !== m.selected
  )
    return null;
  return m;
}
export function selectActivityYear(
  coverage: ActivityCoverage | null,
  requested?: string | string[],
) {
  if (!coverage) return undefined;
  const years = Object.keys(coverage.years).sort();
  return requested === undefined
    ? years.at(-1)
    : typeof requested === "string" && years.includes(requested)
      ? requested
      : undefined;
}
export function validateActivity(
  rows: ActivityRow[],
  year: string,
  expected: ActivityYear,
  sourceHash: string,
) {
  if (
    rows.length !== expected.selected ||
    rows.length >= 1000 ||
    new Set(rows.map((r) => r.id)).size !== rows.length
  )
    return false;
  const kindCounts = { intervention: 0, voting_record: 0 };
  for (const r of rows) {
    if (
      !/^[a-f0-9]{64}$/.test(r.id) ||
      r.legislature !== 15 ||
      r.topic !== "housing" ||
      r.event_date.slice(0, 4) !== year ||
      r.mapping_version !== ACTIVITY_VERSION ||
      r.dataset_sha256 !== sourceHash ||
      !r.title ||
      !r.initiative_number ||
      !r.initiative_type ||
      !Object.hasOwn(kindCounts, r.kind) ||
      !r.title_signal ||
      !r.title.toLowerCase().includes(r.title_signal.toLowerCase()) ||
      !Array.isArray(r.documents) ||
      !r.documents.length ||
      r.documents.some((d) => {
        try {
          const u = new URL(d);
          return (
            u.protocol !== "https:" ||
            u.hostname !== "www.congreso.es" ||
            !u.pathname.startsWith("/public_oficiales/L15/") ||
            !!u.username ||
            !!u.password ||
            !!u.port
          );
        } catch {
          return true;
        }
      })
    )
      return false;
    kindCounts[r.kind]++;
  }
  return (
    kindCounts.intervention === expected.interventions &&
    kindCounts.voting_record === expected.voting_records
  );
}
