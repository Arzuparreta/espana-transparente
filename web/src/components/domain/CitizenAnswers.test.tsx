import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { PeopleAnswer, mandateDocument } from "./PeopleAnswer"
import { DecisionAnswer } from "./DecisionAnswer"
import { ThreadLanding } from "./ThreadLanding"
import { activityFixture } from "@/lib/parliament-activity-fixtures"
import { getThread } from "@/lib/thread-config"
import type { GobiernoMember } from "@/lib/data"
vi.mock("next/navigation", () => ({ usePathname: () => "/personas", useRouter: () => ({ prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
const member: GobiernoMember = { id: "position-id", person_name: "Persona de prueba", organization_name: "Departamento de prueba", position_type: "ministro", official_id: "official-id", politician_id: null, start_date: "2024-01-01", end_date: null, source_url: "https://www.boe.es/buscar/doc.php?id=BOE-A-2024-1", political_party: "", party_color: null, contract_count: 0, total_amount_eur: 0, excluded_amount_count: 0, government: "Gobierno de prueba" }
it("answers with the documented person, mandate and source before the directory", () => {
  const html = renderToStaticMarkup(<ThreadLanding thread={getThread("personas")} sectionIndex={[]} introduction={<PeopleAnswer members={[member]} error={false} />} />)
  for (const text of ["Persona de prueba", "2024-01-01", "/cargos/official-id", "Documento del mandato", "no recuento de personas únicas", "nombramiento", "firma"]) expect(html.toLowerCase()).toContain(text.toLowerCase())
  expect(html.indexOf("¿Quién ocupa el cargo")).toBeLessThan(html.indexOf('aria-label="Datos disponibles"'))
  expect(html).not.toContain("Ministerios con persona responsable")
})
it("does not fabricate identity, source or vacancy from missing data or error", () => {
  const missing = renderToStaticMarkup(<PeopleAnswer members={[{ ...member, official_id: null, politician_id: null, start_date: null, source_url: null }]} error={false} />)
  expect(missing).toContain("fecha no disponible")
  expect(missing).toContain("Documento concreto del mandato no disponible")
  expect(missing).not.toContain("/cargos/official-id")
  expect(renderToStaticMarkup(<PeopleAnswer members={[]} error={true} />)).toContain('role="alert"')
  expect(renderToStaticMarkup(<PeopleAnswer members={[]} error={false} />)).toContain("no acredita ausencia de titulares")
})
it("preserves session year, source, economic independence and procedural limits", () => {
  const html = renderToStaticMarkup(<DecisionAnswer data={activityFixture()} />)
  for (const text of ["2024", "name=\"year\"", "action=\"/decisiones\"", "?year=2024", "housing-title-words-v1", "No es una clasificación oficial", "no horas de trabajo", "Orador no equivale a proponente", "no contiene por sí solo el voto nominal", "publicación y vigencia"]) expect(html).toContain(text)
})
it("keeps failed, unavailable and validated zero activity distinct", () => {
  expect(renderToStaticMarkup(<DecisionAnswer data={{ coverage: null, rows: [], error: true }} />)).toContain('role="alert"')
  expect(renderToStaticMarkup(<DecisionAnswer data={{ ...activityFixture(), year: undefined, rows: [] }} />)).toContain("No se sustituye")
  const data = activityFixture(); data.rows = []; data.coverage.years["2024"] = { universe: 10, selected: 0, interventions: 0, voting_records: 0 }
  expect(renderToStaticMarkup(<DecisionAnswer data={data} />)).toContain("selección validada no contiene registros")
})

it("does not present a generic BOE homepage as evidence of a mandate", () => {
  expect(mandateDocument("https://www.boe.es/")).toBeNull()
  expect(mandateDocument("https://example.com/?id=BOE-A-2024-1")).toBeNull()
  expect(mandateDocument(member.source_url)).toBe(member.source_url)
})
