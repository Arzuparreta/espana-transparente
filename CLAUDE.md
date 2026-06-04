# CLAUDE.md

This file provides guidance to coding agents working in this repository.

## Project

**España Transparente** (legacy repository name: *Acción Humana*) — public data portal on Spanish politics: deputies, votes, contracts, subsidies, revolving doors, declarations and responsibility chains. Monorepo with three tracks: a Next.js frontend (`web/`), Python ETL pipelines (`etl/`), and Supabase SQL migrations (`supabase/migrations/`).

Read **`AGENTS.md`**, **`NEXT.md`**, and **`DESIGN.md`** first. `AGENTS.md` carries editorial/product constraints, `NEXT.md` is the active execution map, and `DESIGN.md` is the visual source of truth.

## Commands

### Web (Next.js 14 / App Router)

```bash
cd web
npm install
npm run dev          # local dev server
npm run build        # production build
npm run lint         # next lint
npm run ui:audit     # enforces layout primitives & responsive rules
npm run content:audit # enforces editorial rules (see "Hard rules" below)
```

Required env vars (also wired in CI): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Anon key uses the new publishable format (`sb_publishable_…`); legacy JWT keys do not work.

### ETL (Python 3.12)

```bash
cd etl
pip install -r requirements.txt
PYTHONPATH=src python -m src.<module>     # all pipelines run as modules from src/
PYTHONPATH=src python -m pytest tests/    # tests
PYTHONPATH=src python -m pytest tests/test_responsibility.py::test_name  # single test
```

Daily pipelines (run via GH Actions cron `0 4 * * *`): `src.congreso.diputados`, `src.congreso.asistencia --from-date 20250101`, `src.ine.indicadores`, `src.contratacion.contratos`, `src.bdns.subvenciones`, `src.photos.run --refresh-missing`, then `common.search_refresh`.
Weekly (`0 5 * * 1`): `src.congreso.cods --resume`, `src.congreso.declaraciones`, `src.congreso.iniciativas`, `src.congreso.gobierno`, `src.congreso.responsables`, `src.photos.run --no-refresh-missing --max-age-days 30`, `src.presupuestos.presupuestos --year $(date +%Y) --resume`, `src.puertas_giratorias.ingest`, `src.instituciones.instituciones`, `src.kohesio.fondos_ue`, `src.senado.senadores`, `src.senado.votaciones`, `src.judicial.wikipedia --resume --extract-people`, `src.judicial.cgpj --resume`, `src.judicial.contract_links`, then `common.search_refresh`.

ETL writes need `DATABASE_URL` (direct Postgres URI from Supabase → Settings → Database). Reads use the publishable key. The Supabase Python SDK is only used for reads; **all writes go through `psycopg2` via `common.db.get_pg_conn()`** — do not try to write through the SDK.

### Migrations

```bash
cd etl
python apply_migration.py ../supabase/migrations/<file>.sql   # direct apply via psycopg2
# or
npx supabase db push                                          # via Supabase CLI
```

Migration files are sorted by timestamped prefix. Project ref is `zktpodkvlgciluhbulwr` (also in `.mcp.json` for the Supabase MCP server).

## Architecture

### Data flow

```
Public sources  →  etl/src/<source>/<pipeline>.py  →  Supabase (Postgres)  →  web/src/lib/data/  →  Next.js pages
```

Pipelines are independent modules under `etl/src/`:

- `congreso/` — Congress scrapers and directory sync: `diputados`, `directory`, `cods`, `asistencia` (session votes + attendance), `declaraciones` (assets/income PDFs), `power_relationships`, `responsables`, `gobierno`.
- `ine/` — INE statistics API (IPC, GDP, EPA, debt).
- `contratacion/` — PCSP public contracts (ATOM/XML feeds).
- `bdns/` — Subsidies from `infosubvenciones.es` (organizations only).
- `photos/` — versioned politician photo pipeline with official Congreso portraits first and Wikidata as fallback; uploads immutable responsive variants to Supabase Storage.
- `puertas_giratorias/` — 3-phase research pipeline (see below).
- `presupuestos/` — PGE budget pipeline: ingests spending lines from Civio CSVs (2016-2023) and SEPG prórrogas (2024+), normalizes ministry names, resolves person-level responsibility via `responsibility_positions`.
- `senado/` — Senate scrapers (active senators + memberships, `chamber='senate'`). Same 1.5s rate-limit policy as Congreso.
- `instituciones/` — institutional appointments (TC, CGPJ, RTVE, SEPI) loaded from `etl/data/instituciones_nombramientos.yml`; fuzzy-matches names to `politicians` (confidence ≥ 0.85).
- `kohesio/` — EU fund beneficiaries for Spain from the Kohesio API (ESIF 2014-2027); the API only serves `offset=0`, so each run ingests up to ~30K records.
- `common/` — shared `db.py`, `responsibility.py` (admin-level normalization & money traceability helpers), `organizations.py`, `etl_runs.py`, `utils.py`.

The Congress portal (`congreso.es`) rate-limits aggressively and returns 403 after bursts. Scrapers use `curl` via `subprocess` with a `Mozilla/5.0` UA and a `REQUEST_DELAY = 1.5s`. `searchDiputados` is now the canonical source for active deputy identity and `codParlamentario`, but it is still served by the same rate-limited domain. **Do not lower the delay or parallelize Congress requests.** INE and `datos.gob.es` do not have this constraint.

### Web

- `web/src/app/` — App Router pages: `/`, `/diputados/[id]`, `/votaciones[/id]`, `/distorsion`, `/partidos/[id]`, `/puertas-giratorias`, `/contratos`, `/subvenciones`, `/indicadores`, `/organizaciones`, `/estado-datos`.
- `web/src/lib/data/` — shared boundary for Supabase reads. Page-level fetches should use the existing cached helpers or add new ones here instead of calling Supabase directly from page components.
- `web/src/lib/photos.ts` — helper for responsive `src`/`srcSet` selection from `photo_variants`.
- `web/src/lib/supabase/client.ts` — singleton Supabase client (publishable key only — read-only).
- `web/src/lib/domain-style.ts` — **single source of truth** for vote/party color tokens. Components must not redefine `VC`, `PC`, `PARTY_COLORS`, or `VOTE_COLORS` maps locally (enforced by `ui:audit`).
- `web/src/components/domain/` — `PageHeader`, `PartyBadge`, `VoteBadge`, `ExceptionBadge`, `StatGrid`, `SectionTabs`, `InfoPanel`, `SourceFootnote`, `ContextTrail`. **Reuse before adding inline alternatives.** See `DESIGN.md`.

### Schema

15+ tables under `supabase/migrations/`. Core: `politicians`, `politician_photo_versions`, `parties`, `legislatures`, `politician_memberships`, `voting_sessions`, `votes`, `initiatives`, `power_relationships`, `revolving_door` (+ `_candidates`, `_sources`), `organizations`, `annotations`, `contracts`, `grants`, `economic_declarations`. Key views: `v_attendance_summary`, `v_session_attendance`, `v_voting_session_summary`, `v_revolving_door_public`. Key function: `get_divergences()` — detects deputies voting against their parliamentary group (excludes "No vota" absences). This is an internal / deep-page analytical signal (at most relevant on an individual deputy's own profile the week it happens). **It is NOT homepage material** — never surface divergence counts on the home / front door. See AGENTS.md §2.

Multilevel responsibility (state / autonomic / municipal) is modeled across `responsibility_positions.yml` + `public_body_responsibility_map.yml` (in `etl/data/`) and materialized by `responsables.py` into Postgres for cross-linking spending to responsible officials.

### Puertas giratorias (revolving door)

Three-phase pipeline; **nothing auto-publishes**. See `etl/src/puertas_giratorias/README.md`.

1. **Ingest** → `revolving_door_candidates` (from CSV or BORME discovery; `confidence` 0–1).
2. **Review** → human curates via CLI (`python -m src.puertas_giratorias.review list|reject|publish`).
3. **Publish** → copies to `revolving_door` only when at least one `primary` source exists.

The public frontend reads exclusively from `revolving_door` and `v_revolving_door_public`. Anon users cannot see candidates.

### Data-as-PR

Some references live as YAML in `etl/data/` because no structured public source exists:
- `party_leadership.yml` — party leader → spokesperson → deputy chains (powers `power_relationships`).
- `responsibility_positions.yml`, `public_body_responsibility_map.yml`, `gobierno_historico.yml` — admin-level officials.

These are reviewed as PRs and re-ingested by their respective pipelines. Operational priorities and current known gaps are tracked in `NEXT.md`.

## Hard rules

### Editorial — enforced by `npm run content:audit`

The web is a **data portal**, not a manifesto. The following are forbidden anywhere under `web/src/` (in source code, comments, JSX, strings):

`austriac*`, `libertari*`, `anarcocap*`, `coerción`, `expolio/expoliar`, `Huerta de Soto`, `Mises`, `Hayek`, `Rothbard`, `fatal arrogancia`, `robo del estado`, `robar al`.

Also forbidden in UI: methodology phrases ("Unidad de lectura: la persona", "Señal prioritaria: la excepción", "descomponemos el Estado"), value judgments, irony. Use factual labels only ("Diputados", "Votaciones", "Divergencias detectadas"). The product lens in `AGENTS.md` is internal only, never user-facing copy.

### UI — enforced by `npm run ui:audit`

- No `grid-cols-3` without a responsive variant (`sm:`/`md:`/`lg:`/…).
- `flex items-center justify-between` requires `min-w-0` on the flexible block (and `shrink-0` on metadata) — otherwise long names break layouts.
- Do not redefine vote/party color maps locally; import from `lib/domain-style.ts`.
- Do not implement tabs outside `components/domain/SectionTabs.tsx`.
- No arbitrary `max-w-[Npx]` — use fluid layout / shared primitives.

### When adding new ETL

1. Module path `etl/src/<source>/<pipeline>.py` with a CLI entrypoint (`if __name__ == "__main__"`).
2. Reads via Supabase client OK; writes via `common.db.get_pg_conn()`.
3. Support `--dry-run` for CI smoke checks.
4. If it should run on a schedule, add it to `.github/workflows/ci.yml` under `etl-daily` or `etl-weekly` (with `DATABASE_URL` from secrets).
5. Heavy Congress scrapers: keep `REQUEST_DELAY = 1.5s` and respect the UA convention; do not parallelize.
6. If the pipeline publishes media, prefer immutable Storage paths by content hash and keep the public pointer in Postgres promotable/rollbackable instead of overwriting files in place.

## Operational notes

- The Supabase MCP server is configured in `.mcp.json` against project ref `zktpodkvlgciluhbulwr` — use it for schema introspection when available.
- Production hostname: `xn--espaatransparente-ixb.site` (IDN for "españatransparente.site"). Deployed on Vercel Hobby; DB on Supabase Free (500 MB).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, border radius, brand assets, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.

Key rules derived from DESIGN.md:
- Dark mode is the **default** — do not flip this without approval
- Signal color is `#C8FF00` (acid green) — not crimson, not red
- All numeric data (amounts, counts, IDs, dates) must use `font-family: var(--font-mono)` (Geist Mono)
- Display/hero type uses Cabinet Grotesk (load from Fontshare CDN)
- Border radius max 2px — no rounded cards
- Remove card hover-float animations — they conflict with the aesthetic
- Background grid pattern is removed — no `background-image` grid on `body`
