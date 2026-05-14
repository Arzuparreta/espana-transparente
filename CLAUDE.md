# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A Spanish political transparency portal. It exposes raw data — politicians, individual votes, power chains, revolving-door cases, electoral distortion — and lets the numbers speak. **No editorializing, ever.** See `AGENTS.md` for the full content policy; the short version: show data, use factual labels, never put methodology or value judgments in the UI.

## Commands

All frontend commands run from `web/`:

```bash
npm run dev      # dev server → http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm run ui:audit # UI consistency audit (scripts/ui-audit.mjs)
```

ETL commands run from `etl/`:

```bash
pip install -r requirements.txt
PYTHONPATH=src python -m src.congreso.diputados   # ingest politicians
```

Schema changes:

```bash
npx supabase db push   # apply migrations in supabase/migrations/
```

## Architecture

```
web/       Next.js 14 App Router frontend (TypeScript, Tailwind, shadcn/ui)
etl/       Python 3.12 scrapers that populate Supabase
supabase/  SQL migrations (PostgreSQL with RLS and pg_trgm full-text search)
```

### Frontend data flow

Pages in `web/src/app/` are Server Components that query Supabase directly via `web/src/lib/supabase/client.ts`. There is no API layer — DB calls happen server-side and results are passed as props to client components.

Component layers:
- `components/ui/` — shadcn/ui primitives (don't edit directly, regenerate via `npx shadcn add`)
- `components/domain/` — shared domain widgets (badges, stat grids, page headers)
- `components/politicians/`, `components/indicators/`, etc. — feature-specific components

Styling: Tailwind utility classes + `web/src/lib/domain-style.ts` for party/vote color mappings. Party colors and factional styles are centralized there.

### Key pages

| Route | What it shows |
|-------|--------------|
| `/diputados` | Politician list with search |
| `/votaciones` | Vote sessions; divergences highlighted |
| `/distorsion` | D'Hondt electoral distortion charts |
| `/puertas-giratorias` | Revolving-door cases |
| `/partidos` | Party breakdown |
| `/indicadores` | Aggregated indicators |

### ETL layout

```
etl/src/congreso/   scrapers for Congress votes and politician data
etl/src/common/     DB client (psycopg2), name normalization utilities
etl/src/ine/        INE data scrapers
```

### Database

Supabase (PostgreSQL). Migrations are sequential in `supabase/migrations/`. The divergence detection logic lives in a DB function (`20260513170000_divergence_function.sql`). Power structures (who controls whom) are in their own migration. RLS is active — check policies before adding new tables.

## Content rules (from AGENTS.md)

- UI text must be purely factual: "Diputados", "Votaciones", "Divergencias detectadas" — not methodology
- Never reference Austrian Economics, the project's internal principles, or any value judgment in the UI
- Highlight exceptions (politicians who deviate from their group), not uniformity
- Every data point should be traceable to a specific person, not attributed to a party as an agent
