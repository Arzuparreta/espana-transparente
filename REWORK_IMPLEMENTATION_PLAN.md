# Rework Implementation Plan — España Transparente

Source plan: `arsu-main-design-20260520-153430.md`  
Design system: `DESIGN.md`  
Screen specs: `REWORK_SCREEN_SPECS.md`

## Sequencing

This should ship in slices. The product risk is not visual polish; it is amplifying incomplete or hard-to-source data. Ship source visibility and discovery before the flagship route.

## Phase 0 — Integrity And Visibility Foundations

### 0.1 Sitemap Expansion

Files:

- `web/src/app/sitemap.ts`
- `web/src/lib/data/*` as needed for ranked ID fetchers.

Tasks:

- Add dynamic detail routes beyond deputies and parties.
- Use ranked subsets for huge datasets if needed.
- Keep static fallback when Supabase errors.

Verification:

- `npm run build`.
- Inspect generated sitemap locally or via route check.

### 0.2 SourceFootnote Primitive

Files:

- `web/src/components/domain/SourceFootnote.tsx`
- `web/src/components/domain/index` if such barrel is added later.

Tasks:

- Build component from `REWORK_SCREEN_SPECS.md`.
- Add runtime formatting helpers for missing dates and coverage clamp.
- Add it first to `presupuestos`, `contratos`, `subvenciones`, `fondos-ue`, `votaciones`, and `estado-datos`.

Verification:

- Unit test if Vitest is added in this phase.
- Otherwise verify with `npm run lint`, `npm run ui:audit`, `npm run content:audit`.

### 0.3 Home Section Counts RPC

Files:

- New migration under `supabase/migrations/`.
- `web/src/lib/data/home.ts`.
- `web/src/app/page.tsx`.

Tasks:

- Add one RPC that returns counts/coverage for section cards.
- Avoid 19 parallel home queries.
- Use `unstable_cache` while app remains on Next.js 14.

Verification:

- Local RPC check.
- Home renders if RPC fails.

## Phase 1 — Home Atlas

Files:

- `web/src/app/page.tsx`
- `web/src/components/domain/SectionIndexCard.tsx`
- `web/src/lib/nav-config.ts`
- `web/src/lib/data/home.ts`

Tasks:

- Add `Qué hay aquí` section below the three anchors.
- Keep `IPC mensual`.
- Categorize the public verticals.
- Include counts/freshness only where cheap and reliable.
- Promote `/estado-datos`.

Verification:

- Mobile 375px check.
- Desktop 1280px check.
- `npm run ui:audit`.
- `npm run content:audit`.

## Phase 2 — Missing Browse Surfaces

### 2.1 `/iniciativas`

Files:

- `web/src/app/iniciativas/page.tsx`
- `web/src/app/iniciativas/loading.tsx`
- `web/src/lib/data/conexiones.ts`
- `web/src/lib/nav-config.ts`

Tasks:

- Add paginated list page.
- Link existing details.
- Include source link when present.

### 2.2 `/declaraciones`

Files:

- `web/src/app/declaraciones/page.tsx`
- `web/src/app/declaraciones/loading.tsx`
- `web/src/lib/data/politicians.ts` or new `declarations.ts`.
- `web/src/lib/nav-config.ts`

Tasks:

- Add paginated declarations index.
- Show deputy, type, date, source.
- Link deputy profile and source PDF.

Verification:

- Empty states.
- Pagination.
- Search route links if added.

## Phase 3 — Context Completion

Files:

- `web/src/components/navigation/ContextTrail.tsx`
- `web/src/lib/nav-config.ts`
- Priority detail pages.

Tasks:

- Extend current `ContextTrail` across priority detail routes.
- Add related links from actual data only.
- Preserve internal-history recovery.

Verification:

- Direct-load a detail URL and recover to section.
- Navigate from list/search to detail and recover to prior internal page.
- Mobile route trail does not overflow.

## Phase 4 — Flagship `Dinero público`

Prerequisite:

- Decide route name. Recommendation: `/dinero-publico` with page title `Trazabilidad del gasto`.
- If the app is upgraded to Next.js with `use cache`, use it. If not, continue with `unstable_cache`.

Files:

- New migration for materialized view or cached view.
- `web/src/app/dinero-publico/page.tsx`
- `web/src/app/dinero-publico/[year]/[section]/[program]/page.tsx` if deep route is chosen over hash links.
- `web/src/components/domain/MoneyCascade.tsx`
- `web/src/lib/data/money-flow.ts`

Data shape:

```sql
v_program_money_flow(
  year,
  budget_type,
  section_code,
  section_name,
  ministry_normalized,
  minister_person_id,
  minister_name,
  program_code,
  program_name,
  total_credit_initial,
  contract_count,
  contract_total,
  subsidy_count,
  subsidy_total,
  eu_fund_count,
  eu_fund_total,
  latest_record_date,
  source_url
)
```

Tasks:

- Build materialized/cached aggregation.
- Add cascade UI.
- Add hash or route deep links.
- Add `Sin datos` states for empty downstream nodes.
- Add source/freshness summary.

Verification:

- Deep link opens correct node.
- Ministry with no downstream records renders correctly.
- Mobile cascade remains readable.
- Query does not perform heavy joins on every request.

## Phase 5 — Senate Voting And Multilevel Pages

This phase comes from the PM plan and is broader than visual rework.

Tasks:

- Investigate Senate voting publication.
- Add ETL only after source format is verified.
- Add CCAA and municipal landing pages over existing `nivel1` and awarding-body data.
- Surface multilevel responsibility where resolved.

Verification:

- ETL tests with 1.5s delay.
- `--resume` support for long scrapes.
- No claims that coverage is complete until coverage is measured.

## Test Plan

Run for each meaningful slice:

```bash
cd web
npm run lint
npm run ui:audit
npm run content:audit
npm run build
```

For ETL/data slices:

```bash
cd etl
PYTHONPATH=src python -m pytest tests/
```

For search or route changes:

```bash
cd web
npm run search:routes
```

## Done Definition

- Root design artifacts remain current.
- UI uses `DESIGN.md` tokens and avoids stale red signal.
- Home exposes the portal map.
- Source/freshness metadata appears consistently.
- Priority detail pages have in-UI recovery.
- Flagship money route is navigable, source-backed, and mobile-readable.
- Audits pass.
