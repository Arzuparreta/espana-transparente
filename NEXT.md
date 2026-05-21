# NEXT.md — España Transparente

This is the current execution map for the project. It replaces shipped sprint
plans and stale root notes. Use it with `README.md` for public orientation,
`AGENTS.md` for editorial constraints, `CLAUDE.md` for agent operations, and
`DESIGN.md` for visual/UI decisions.

## Current State

España Transparente is no longer a prototype. The repo contains:

- A Next.js public app with pages for deputies, Senate, government, parties,
  institutions, voting, initiatives, budgets, public money traceability,
  contracts, subsidies, EU funds, organizations, indicators, search, profiles,
  annotations, and data status.
- Python ETL pipelines for Congreso, Senado, INE/Banco de España, PCSP, BDNS,
  budgets, Kohesio, photos, institutional appointments, government/responsible
  positions, and revolving-door candidates.
- Supabase migrations for the public schema, materialized public views/RPCs,
  search corpus, profile/auth scaffolding, ETL status, and public RLS.
- CI checks for web lint/build, editorial audit, UI audit, search route audit,
  ETL tests, and scheduled daily/weekly ETL jobs.

The strategic product value is integration: official records are scattered
across incompatible public sources, and this project makes them navigable from
people, money, decisions, organizations, and source documents.

## P0 — Start Flat

Goal: make the repo easy to understand and safe for future agents.

- Keep root docs flat and current:
  - `README.md`: public overview and setup.
  - `NEXT.md`: active roadmap and execution board.
  - `AGENTS.md`: editorial/product constraints.
  - `CLAUDE.md`: coding-agent operations.
  - `DESIGN.md`: visual system and UI primitives.
- Delete shipped sprint plans, stale screenshots/previews, and duplicated
  nested docs once their durable decisions are folded into the files above.
- Do not keep historical planning files in root after their work has shipped.
  Git history is the archive.
- Before calling a cleanup done, search for deleted roadmap, rework, brand,
  UI-system, legacy internal-basis, preview, and screenshot names:

```bash
rg "<deleted-doc-or-artifact-name>"
git status --short
```

The only acceptable matches after cleanup should be in historical git output,
not current project docs.

## P1 — Foundation First

These are the next work items before large expansion.

### ETL Reliability

- `src.congreso.asistencia` already accepts `--resume` and records ETL run
  chunks, so long runs are operationally consistent with contracts, subsidies,
  budgets, and Senate.
- Keep Congress/Senate request delays at 1.5s and do not parallelize those
  portals. They rate-limit aggressively.

### Search QA

- Treat search as a product contract, not just an RPC.
- Run `npm run search:check` after search/schema changes.
- Dogfood homepage autocomplete and `/buscar` in a browser session before
  declaring search work shipped.
- Preserve the split:
  - `search_suggestions` for fast live autocomplete.
  - `search_documents` / `search_global` for full results.
  - No answer-engine layer unless explicitly planned.

### Design Consistency

- `DESIGN.md` is the visual source of truth.
- The active direction is dark, sharp, data-dense, and source-led.
- Numeric data, IDs, dates, percentages, and amounts use Geist Mono.
- Keep radius at 2px for new UI. Existing drift should be cleaned up in focused
  passes with `npm run ui:audit` and browser screenshots.
- Do not reintroduce the old red signal palette. The current signal color is
  acid green.

## P2 — Product/Data Closure

These are the highest-value product closures after P1.

### Public Money Traceability v2

Current `/dinero-publico` connects budget sections/programs to responsible
ministries, contracts, and subsidies.

- Contract awarding bodies are linked to organizations (97.3%).
  Contractor org links exist when source data includes contractor names
  (178 of 3,803 contracts have contractor data; all linked).
- Subsidy beneficiaries linked to organizations (47.3% of 515 subsidies).
- EU fund beneficiaries now linked to organizations via the
  `beneficiary_organization_id` FK on `eu_funds` (30,000/30,000 linked).
  The bridge is name-based: each Kohesio beneficiary label is normalized and
  matched against `organizations.normalized_name`. No fake ministry-level
  EU-fund join is created — the source does not provide ministry attribution.
- Empty nodes are explicit with `Sin datos`. Source/freshness metadata
  visible on every page.
- Remaining: add EU fund beneficiaries to the `dinero-publico` cascade UI
  when a defensible route exists (e.g., through organization pages, not
  through ministries).

### Senate Votes

The Senate vote ETL parses official static XML exports such as
`/legis15/votaciones/ses_N.xml`, including individual senator votes and
absences.

- 60 sessions processed, 155,164 vote rows in the database (0 unmatched).
- Historical senator coverage resolved: all 21 previously unmatched names from
  session 2 were former senators who left during the legislature. The new
  `senado.bajas` ETL scrapes the Senate's "altas y bajas" page to backfill
  former senators with `politicians` rows and `politician_memberships` entries
  (`is_active=false`, `end_date` set to departure date).
- The audit table `senate_vote_unmatched_names` retains historical records for
  traceability; re-running `votaciones.py` for the affected sessions rematches
  votes against the expanded politician index.
- Run: `PYTHONPATH=src python -m src.senado.bajas` (one-off or periodic), then
  re-run `python -m src.senado.votaciones --from-session N --max-session N` for
  any session range that had unmatched names.

### CCAA And Municipal Drilldowns

Current `/ccaa` and `/municipios` expose drilldowns built from published
territory fields.

- Autonomic contract coverage: **89.8%** resolved (up from ~83%).
- Municipal contract coverage: **98.6%** resolved (up from ~95%).
- Subsidies remain at 100% for both levels (BDNS `nivel2` is well-populated).
- Territory inference now extracts region and administration level from
  awarding body names when the source XML omits these fields. The expanded
  `infer_contract_administration_level()` covers 40+ entity patterns
  (ministries, regional governments, universities, port authorities, etc.).
- Remaining gap: ~79 autonomic and ~21 municipal contracts without region
  (unusual awarding body names or genuinely missing location data).

### Profiles And Annotations

Profiles and annotations should mature as factual context surfaces.

- Keep public profiles useful for attribution and saved context.
- Keep annotations tied to verifiable records.
- Avoid ranking/scoring public officials or turning comments into partisan
  debate surfaces.

## How We Work

- Source first: do not create UI claims that the data cannot support.
- Public UI stays factual and non-editorial.
- Migrations are forward-only; do not edit old migrations after they have
  shipped.
- Prefer shared primitives and data-layer helpers over one-off page fixes.
- Every feature needs an acceptance bundle appropriate to its risk:
  - Web: `npm run content:audit && npm run ui:audit && npm run lint && npm run build`
  - Search: `npm run search:check`
  - ETL: `PYTHONPATH=src python -m pytest tests/`
  - Data: direct source/sample verification and visible freshness/coverage
  - UX-critical pages: browser check on mobile and desktop

## Done Means

- The feature works from the user-facing route, not only from a helper/query.
- Source and freshness are visible or the absence is explicit.
- Empty states are factual and recoverable.
- The route can be found through navigation/search.
- The implementation passes the relevant checks above.
- The docs that future agents read are updated, and stale sprint docs are gone.
