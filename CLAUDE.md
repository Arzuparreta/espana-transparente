# CLAUDE.md

Guía para Claude Code (claude.ai/code) cuando trabaje en este repositorio.

## Qué es este proyecto

Portal de transparencia política española. Expone datos crudos —diputados, votos individuales, cadenas de poder, puertas giratorias, distorsión electoral, contratos, indicadores económicos— y deja que los números hablen. **Nunca editorializa.**

Política de contenido (obligatoria): `AGENTS.md`. Marco interno de producto (no aparece en UI bajo ninguna circunstancia): `BASES_FILOSOFICAS.md`. Roadmap: `PLAN.md`.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui (`web/`).
- **ETL**: Python 3.12 + psycopg2 + httpx + BeautifulSoup (`etl/`).
- **Base de datos**: Supabase (PostgreSQL) con RLS y `pg_trgm` (`supabase/migrations/`).
- **CI/CD**: GitHub Actions → Vercel Hobby + Supabase Free.

## Comandos

Desde `web/`:

```bash
npm run dev           # dev server → http://localhost:3000
npm run build         # production build
npm run lint          # ESLint
npm run ui:audit      # auditoría de consistencia UI (scripts/ui-audit.mjs)
npm run content:audit # auditoría de reglas de contenido (scripts/content-audit.mjs)
```

Desde `etl/`:

```bash
pip install -r requirements.txt
PYTHONPATH=src python -m src.congreso.diputados              # diputados activos
PYTHONPATH=src python -m src.congreso.asistencia --from-date 20250101
PYTHONPATH=src python -m src.congreso.votaciones             # votos individuales
PYTHONPATH=src python -m src.congreso.fotos                  # fotos vía Wikidata
PYTHONPATH=src python -m src.contratacion.contratos          # PCSP
PYTHONPATH=src python -m src.ine.indicadores                 # INE
PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv ... --dry-run
PYTHONPATH=src python -m src.puertas_giratorias.review list
```

Schema:

```bash
npx supabase db push   # aplica migrations
```

## Arquitectura

```
web/       Next.js 14 App Router (TS, Tailwind, shadcn/ui)
etl/       Scrapers Python 3.12 que escriben en Supabase
supabase/  Migrations SQL secuenciales (Postgres + RLS + pg_trgm)
```

### Flujo de datos frontend

Las páginas en `web/src/app/` son Server Components que consultan Supabase vía `web/src/lib/supabase/client.ts`. **No hay API layer** — la query es server-side y se pasa por props al cliente.

### Mapa de subsistemas

**Rutas (`web/src/app/`)**

| Ruta | Qué muestra |
|------|-------------|
| `/` | Home: buscador + hero "350 personas bajo la lupa" |
| `/diputados` | Listado con búsqueda |
| `/diputados/[id]` | Ficha individual: partido, trayectoria, cadena de mando, voto, declaraciones, revolving door |
| `/votaciones` | Sesiones de votación con badge de divergencias |
| `/votaciones/[id]` | Desglose por partido con divergencias destacadas |
| `/partidos` | Listado de partidos con representación |
| `/puertas-giratorias` | Casos verificados de paso público → privado |
| `/indicadores` | Series del INE (IPC y otros) |
| `/distorsion` | D'Hondt, votos por escaño, umbral provincial |
| `/contratos` | Licitaciones PCSP ordenadas por importe |

**Componentes (`web/src/components/`)**

- `ui/` — primitivos shadcn/ui. **No editar a mano**, regenerar con `npx shadcn add`.
- `domain/` — widgets compartidos (badges, stat grids, page headers).
- `layout/` — Header, navegación, footer.
- `politicians/` — PoliticianProfile, PoliticianCard, PoliticianTimeline, PowerChain, VotingHistory, VoteStats, EconomicDeclaration, RevolvingDoorExplorer, RevolvingDoorList.
- `indicators/`, `votes/`, `contratos/`, `distorsion/`, `search/`, `annotations/`, `brand/` — específicos de feature.

**Lib (`web/src/lib/`)**

- `supabase/client.ts` — factoría del cliente.
- `domain-style.ts` — mappings centrales de color por partido y por tipo de voto. **Cualquier color de partido o estilo faccional vive aquí.**
- `utils.ts` — utilidades generales (`cn` de tailwind-merge).

**Tipos (`web/src/types/index.ts`)** — Politician, Party, Legislature, PoliticianMembership, EconomicDeclaration, Vote, VotingSession, Annotation, PoliticianWithMemberships.

**ETL (`etl/src/`)**

- `congreso/` — diputados, votaciones, asistencia, fotos (Wikidata SPARQL), power_relationships.
- `contratacion/` — contratos (PCSP ATOM feed mensual).
- `ine/` — indicadores (API JSON).
- `puertas_giratorias/` — pipeline 3 fases: `model.py` (shapes), `ingest.py` (CSV + BORME discovery), `db.py` (match_politician con Jaccard 0.92), `review.py` (CLI list/reject/publish).
- `presupuestos/` — placeholder vacío para Fase 2.
- `common/` — `db.py` (psycopg2 + bulk upsert), `utils.py` (normalización de nombres).

### Modelo de datos (migrations en orden cronológico)

| Migration | Aporta |
|-----------|--------|
| `20260513140000_initial_schema.sql` | `parties`, `politicians`, `legislatures`, `politician_memberships`, `voting_sessions`, `votes`, `initiatives`, `economic_declarations`, `annotations`, `budgets`, `economic_indicators`; índices `pg_trgm`; RLS de lectura pública |
| `20260513140100_add_parties_unique.sql` | UNIQUE en `parties.name` |
| `20260513150000_voting_sessions_fix.sql` | `votacion_number` y UNIQUE compuesto |
| `20260513160000_power_structures.sql` | `power_relationships`, `revolving_door`; añade trazabilidad de origen a `initiatives` |
| `20260513170000_divergence_function.sql` | función `get_divergences()` (vota distinto a la mayoría del grupo, excluye "No vota") |
| `20260513180000_revolving_door_enhance.sql` | `person_id` nullable + `person_name`, `political_party` para casos históricos |
| `20260514000000_contracts.sql` | `contracts` (PCSP) |
| `20260514000002_attendance.sql` | vistas `v_session_attendance` y `v_attendance_summary` (derivadas de `votes`) |
| `20260514010000_revolving_door_pipeline.sql` | `organizations`; columnas extendidas en `revolving_door` (organization_id, public_exit_date, private_start_date, authorization_date, verification_status, primary_source_url); tablas `revolving_door_candidates` y `revolving_door_sources`; vista pública `v_revolving_door_public` |

### Modelo RLS

Política general: anon lee solo datos publicados; authenticated puede leer fases de investigación.

- `revolving_door_candidates` → solo `authenticated` (investigación interna).
- `revolving_door_sources` → anon ve únicamente fuentes ligadas a casos publicados (`revolving_door_id IS NOT NULL`).
- `revolving_door`, `organizations`, `politicians`, `votes`, etc. → lectura pública.
- Escrituras: siempre vía ETL con `DATABASE_URL` directa a Postgres (la `service_role` no se usa en runtime web).

### Scheduling ETL (`.github/workflows/ci.yml`)

Cron diario `0 4 * * *` UTC (job `etl-run`): `diputados`, `asistencia`, `indicadores`, `contratos`.

Manuales (todavía sin cron):
- `votaciones` — tiene sesión hardcoded, pendiente refactor a iteración sobre `voting_sessions`.
- `fotos` — Wikidata SPARQL, periodicidad baja.
- `power_relationships` — datos declarativos, leer de YAML versionado.
- `puertas_giratorias.ingest --source borme` — discovery semanal previsto.

## Reglas de contenido (resumen — fuente canónica: `AGENTS.md`)

- La UI muestra datos. **Solo datos.** El usuario saca sus propias conclusiones.
- Etiquetas factuales: "Diputados", "Votaciones", "Partidos", "Divergencias detectadas", "Cadena de mando".
- Resaltar excepciones (divergencias), no uniformidades.
- Cada dato apunta a una persona física, no a una entidad agregada con voluntad propia.
- Nunca exponer en UI: metodología del proyecto, juicios de valor, ironía, vocabulario filosófico interno.

**Términos PROHIBIDOS en UI** (`web/src/`, excluyendo comments). Auditados por `npm run content:audit`:

```
austriac*, libertari*, coerción, expolio, anarcocap*,
Huerta de Soto, Mises, Hayek, Rothbard,
"fatal arrogancia", "robo del estado", "robar al",
BASES_FILOSOFICAS
```

`BASES_FILOSOFICAS.md` es lectura interna para colaboradores. **Nunca** se enlaza desde la web, los meta tags o el sitemap.

## Convenciones

- **No reescribir lo que ya existe.** Antes de crear un componente o utility, buscar en `domain/`, `domain-style.ts`, `common/`. Ejemplo: para matchear nombres de políticos, usar `etl/src/puertas_giratorias/db.py:match_politician` (Jaccard 0.92).
- **Idempotencia ETL.** Los scrapers se reejecutan en cron — todos los upserts deben usar claves naturales (`congress_id`, `(politician_id, session_id)`, etc.).
- **Una migración por cambio de schema.** Numeradas con timestamp, jamás editar una migration ya commiteada.
- **Server Components por defecto.** Solo bajar a Client Component (`"use client"`) si hace falta estado o efectos.

## Checklist pre-PR

Desde `web/`:
1. `npm run lint`
2. `npm run build`
3. `npm run ui:audit`
4. `npm run content:audit` (debe salir con exit 0)

Desde `etl/` (si tocas un pipeline):
5. Probar el módulo modificado con `--dry-run` si lo soporta.

Si añades migration:
6. Aplicar local con `npx supabase db push` y verificar que no rompe migrations posteriores.

## Trabajo reciente (contexto de dirección)

- Pipeline 3 fases de puertas giratorias (candidato → fuente → publicado) con BORME como discovery channel y revisión humana obligatoria.
- Vistas de asistencia derivadas de `votes` (la "presencia" se infiere de haber emitido cualquier voto incluido "No vota" en una sesión).
- Integración Wikidata para fotos de diputados (matching por nombre/partido, threshold Jaccard ≥0.5).
- Contratos PCSP (ATOM feed mensual) ingestados pero **sin** vinculación todavía al político firmante.
- Distorsión electoral D'Hondt con cálculo en cliente (no requiere ETL).
