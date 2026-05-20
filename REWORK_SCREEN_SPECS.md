# Rework Screen Specs — España Transparente

Status: Build-ready specs  
Design system: `DESIGN.md`  
Plan source: `arsu-main-design-20260520-153430.md`

## 1. Home

### Goal

Make the full product surface visible without turning the home into a marketing page.

### Structure

1. Brand/search hero.
2. Three factual anchors:
   - Deuda pública por ciudadano.
   - Mayor contrato.
   - IPC mensual.
3. `Qué hay aquí` section index.
4. Existing live sections:
   - Gobierno.
   - Votaciones.
   - Puertas giratorias.
5. Footer link to `/estado-datos`.

### Notes

- Do not replace `IPC mensual` with a divergence widget in this pass. The reviewed plan explicitly rejected decontextualized divergence as low-value.
- The section index should use one shared card primitive, not a one-off grid.
- Cards should include route label, count or coverage when cheap, one factual line, and link.

### Suggested Categories

Personas:

- Diputados
- Senado
- Gobierno
- Partidos
- Instituciones

Dinero público:

- Presupuestos
- Contratos
- Subvenciones
- Fondos UE
- Organizaciones

Decisiones:

- Votaciones
- Iniciativas
- Distorsión electoral

Fuentes y cobertura:

- Indicadores
- Estado de los datos
- Buscar

## 2. Section Index Card

### Content

- Label.
- Record count or coverage label when available.
- One factual description.
- Primary destination.
- Optional latest data date.

### Visual

- Border 1px.
- Radius 2px.
- Surface background.
- Mono count/date.
- No icon circles.
- No marketing CTA language.

### Empty/Fallback

If a count query fails, render the card with label and description. Do not fail the whole home.

## 3. SourceFootnote

### Goal

Give every major section a small, consistent source and freshness surface.

### Props

```ts
type SourceFootnoteProps = {
  sourceLabel: string
  sourceHref?: string
  lastChecked?: string | null
  latestRecordDate?: string | null
  coverageLabel?: string | null
  coverageValue?: number | null
  statusHref?: string
}
```

### Rendering

- `Fuente oficial: Congreso`
- `Última verificación: 2026-05-20`
- `Cobertura: 350 diputados activos`
- `Ver estado de los datos`

### Rules

- `coverageValue` clamps to 0-100 when shown as percent.
- Missing dates render as `Sin verificar`.
- External source links open in a new tab.
- Use Geist Mono for dates, counts, and percentages.

## 4. Detail Pages

### Required Pattern

All important detail pages should have:

1. `ContextTrail`.
2. Record header.
3. Key facts.
4. Related records.
5. SourceFootnote or local source block.

### Priority Routes

- `/diputados/[id]`
- `/votaciones/[id]`
- `/contratos/[id]`
- `/subvenciones/[id]`
- `/fondos-ue/[id]`
- `/organizaciones/[id]`
- `/instituciones/[id]`
- `/puertas-giratorias/[id]`
- `/presupuestos/[section]`
- `/presupuestos/[section]/[program]`
- `/indicadores/[code]`
- `/iniciativas/[id]`

### Recovery Action

Priority:

1. Internal prior page when available.
2. Search/listing results when available.
3. Section fallback.

Never rely only on browser back.

## 5. `Dinero público` / `Trazabilidad del gasto`

### Route

Recommended route: `/dinero-publico`.

### Goal

Create the flagship flow that connects public budget lines to responsible ministries, programs, contracts, subsidies, EU funds, organizations, and source documents.

### Structure

1. Header:
   - Title: `Trazabilidad del gasto`.
   - Subtitle: factual description of what data is connected.
   - Year selector.
   - Source/freshness summary.

2. Budget overview:
   - Current in-force budget year.
   - Budget type (`ley`, `prórroga`, `proyecto`).
   - Total initial credit.
   - Number of sections and programs.

3. Ministry cascade:
   - Section name and code.
   - Responsible minister when resolved.
   - Program list.
   - Contracts/subsidies/funds associated by normalized ministry/program names.
   - Organization beneficiaries.

4. Deep link behavior:
   - `#program-<code>` opens and scrolls to the program.
   - Empty nodes render `Sin datos`.

### Visual

- Accordions or disclosure rows, not a huge tree diagram.
- Left rail or stepped indentation on desktop.
- Single-column stacked disclosure on mobile.
- Use signal only for active/focused node or exceptional count.

### Copy

Use:

- `Presupuesto`
- `Ministerio`
- `Programa`
- `Contratos asociados`
- `Subvenciones asociadas`
- `Fondos UE asociados`
- `Organizaciones`
- `Fuente`

Avoid:

- `Despilfarro`
- `Quién se queda tu dinero`
- `Botín`
- Any accusation or conclusion.

## 6. Sitemap

### Current Gap

`web/src/app/sitemap.ts` currently includes static routes plus deputy and party detail pages.

### Required Additions

Add dynamic entries for:

- `/votaciones/[id]`
- `/contratos/[id]`
- `/subvenciones/[id]`
- `/fondos-ue/[id]`
- `/puertas-giratorias/[id]`
- `/organizaciones/[id]`
- `/indicadores/[code]`
- `/instituciones/[id]`
- `/presupuestos/[section]`
- `/presupuestos/[section]/[program]`
- `/iniciativas/[id]`

For high-volume tables, use a ranked subset first if full enumeration is too heavy.

## 7. New List Pages

### `/iniciativas`

Needed because detail pages exist and are currently hard to browse.

Minimum:

- Paginated list.
- Title, type/number, status, proposer group.
- Link to detail.
- Source link when available.

### `/declaraciones`

Needed because economic declarations have no dedicated index.

Minimum:

- Paginated list.
- Deputy, type, date or `Documento vigente`, source host.
- Link to deputy profile and source PDF.

## 8. Data Status Promotion

`/estado-datos` exists. The rework should make it visible from:

- Home map.
- SourceFootnote.
- Footer.
- Relevant empty states.

## 9. Mobile Rules

- No horizontal scroll dependence.
- Cascade nodes collapse by default.
- Section index becomes single column.
- SourceFootnote stacks into rows.
- Long titles use `min-w-0` and wrap before actions.

## 10. Acceptance

- A new visitor can name at least five available data areas from the home without opening the nav.
- From any priority detail route, the user can return inside the UI.
- Every major section exposes source/freshness/cobertura or a clear `Sin verificar`.
- The money flow route lets a reader move from budget section to at least one specific downstream record.
- `npm run content:audit`, `npm run ui:audit`, `npm run lint`, and build pass.
