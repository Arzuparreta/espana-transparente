import { ACTIVITY_VERSION } from "./parliament-activity";
export const SENATE_CONTROL_SOURCE =
  "https://www.senado.es/web/relacionesciudadanos/datosabiertos/catalogodatos/index.html?lang=es_ES";
export interface SenateEvidence {
  title: string;
  official_type: string;
  status: string | null;
  presentation: string | null;
  qualification: string | null;
  authors: (string | null)[];
  official_topics: string[];
  committees: string[];
  actors: {
    name: string | null;
    source_id: string | null;
    role: string | null;
    registered_total: string | null;
  }[];
  stages: { date: string | null; description: string | null }[];
  sessions: {
    date: string | null;
    body: string | null;
    source_id: string | null;
    number: string | null;
    convocation: string | null;
    state: string | null;
  }[];
  documents: {
    url: string;
    kind: string;
    date: string | null;
    label: string | null;
  }[];
  source_url: string;
  page_url: string;
  title_signal: string;
  mapping_version: string;
  legislature: number;
  number: string;
  kind: string;
  xml_sha256: string;
  retrieved_at: string;
}
export interface SenateControlRow {
  id: string;
  legislature: number;
  number: string;
  kind: "motion" | "interpellation";
  presentation_date: string | null;
  title: string;
  evidence: SenateEvidence;
}
export interface SenateControlCoverage {
  source: string;
  legislature: number;
  mapping_version: string;
  topic: string;
  catalogs: Record<
    string,
    { url: string; universe: number; selected: number; sha256: string }
  >;
  years: Record<string, number>;
  undated: number;
  selected: number;
  retrieved_at: string;
}
const count = (n: unknown) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const official = (value: string) => {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      ["www.senado.es", "www.congreso.es", "www.boe.es"].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      !u.port
    );
  } catch {
    return false;
  }
};
export function senateControlData(rows: SenateControlRow[], raw: unknown) {
  const metadata = raw as SenateControlCoverage | undefined;
  if (
    !metadata ||
    metadata.legislature !== 15 ||
    metadata.mapping_version !== ACTIVITY_VERSION ||
    metadata.topic !== "housing" ||
    !count(metadata.selected) ||
    metadata.selected !== rows.length ||
    rows.length > 300 ||
    new Set(rows.map((r) => r.id)).size !== rows.length ||
    !metadata.years ||
    !metadata.catalogs ||
    !count(metadata.undated) ||
    !Number.isFinite(Date.parse(metadata.retrieved_at ?? ""))
  )
    return null;
  if (
    Object.values(metadata.years).some((v) => !count(v)) ||
    Object.entries(metadata.years).some(([year]) => !/^20\d{2}$/.test(year)) ||
    Object.values(metadata.years).reduce((a, b) => a + b, 0) +
      metadata.undated !==
      metadata.selected
  )
    return null;
  const counts = { motion: 0, interpellation: 0 };
  const years: Record<string, number> = {};
  let undated = 0;
  for (const r of rows) {
    const e = r.evidence;
    if (
      r.legislature !== 15 ||
      r.id !== `15/${r.number}` ||
      !/^\d{3}\/\d{6}$/.test(r.number) ||
      !Object.hasOwn(counts, r.kind) ||
      !e ||
      e.number !== r.number ||
      e.kind !== r.kind ||
      e.legislature !== 15 ||
      e.mapping_version !== ACTIVITY_VERSION ||
      e.presentation !== r.presentation_date ||
      e.title !== r.title ||
      !e.title_signal ||
      !e.title.toLowerCase().includes(e.title_signal.toLowerCase()) ||
      !official(e.source_url) ||
      !official(e.page_url) ||
      !/^[a-f0-9]{64}$/.test(e.xml_sha256) ||
      !Number.isFinite(Date.parse(e.retrieved_at)) ||
      ![
        e.authors,
        e.official_topics,
        e.committees,
        e.actors,
        e.stages,
        e.sessions,
        e.documents,
      ].every(Array.isArray) ||
      e.documents.some((d) => !official(d.url))
    )
      return null;
    counts[r.kind]++;
    if (r.presentation_date) {
      const year = r.presentation_date.slice(0, 4);
      years[year] = (years[year] ?? 0) + 1;
    } else undated++;
  }
  for (const [kind, n] of Object.entries(counts)) {
    const c = metadata.catalogs[kind];
    if (
      !c ||
      c.selected !== n ||
      !count(c.universe) ||
      n > c.universe ||
      !official(c.url) ||
      !/^[a-f0-9]{64}$/.test(c.sha256)
    )
      return null;
  }
  if (
    undated !== metadata.undated ||
    Object.keys(years).length !== Object.keys(metadata.years).length ||
    Object.entries(years).some(([y, n]) => metadata.years[y] !== n)
  )
    return null;
  return { rows, metadata };
}
export function selectSenateYear(
  metadata: SenateControlCoverage | null,
  requested?: string | string[],
) {
  if (!metadata) return undefined;
  const years = Object.keys(metadata.years).sort();
  return requested === undefined
    ? years.at(-1)
    : typeof requested === "string" && years.includes(requested)
      ? requested
      : undefined;
}
