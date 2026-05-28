# Self-hosted Supabase recovery

This repo can run against a local Supabase stack when the hosted Free project is
unavailable or exhausted.

## Start local Supabase

```bash
cd /mnt/storage/Git-projects-storage/espana-transparente
NPM_CONFIG_CACHE=/tmp/npm-cache npx supabase start
NPM_CONFIG_CACHE=/tmp/npm-cache npx supabase status
```

If `supabase start` hangs reading `.temp/project-ref`, delete `supabase/.temp` first:

```bash
rm -rf supabase/.temp
```

Local defaults:

```text
Studio: http://127.0.0.1:54323
API:    http://127.0.0.1:54321
DB:     postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Use the publishable and secret keys printed by `npx supabase status`; do not
commit machine-specific secrets to `.env.local`.

## Run the app against local Supabase

```bash
cd web
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH \
SUPABASE_SERVICE_ROLE_KEY=<secret-from-supabase-status> \
npm run dev -- --port 3002
```

## Rebuild ETL data (full procedure)

Run in this order. All commands from `etl/`:

```bash
cd etl
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
export PYTHONPATH=src
```

### 1. Core (fast, ~30s each)

```bash
python -m src.congreso.diputados          # 350 deputies, 12 parties
python -m src.congreso.gobierno            # 80 government positions
python -m src.ine.indicadores              # 720 IPC data points
python -m src.ine.indicadores_ampliados    # 380 GDP/unemployment/etc
```

### 2. Congress data (medium, ~2-5 min each)

```bash
python -m src.congreso.iniciativas         # 439 legislative initiatives
python -m src.congreso.declaraciones --skip-actividades  # 800 declarations
python -m src.congreso.asistencia --resume # 131 voting sessions, 629K votes
```

### 3. Senate data (medium, ~4 min)

```bash
python -m src.senado.senadores             # 266 senators
```

### 4. Institutions & appointments

```bash
python -m src.instituciones.instituciones  # 204 institutional appointments
```

### 5. Budgets (medium, ~30s per year)

```bash
python -m src.presupuestos.presupuestos --from-year 2016 --to-year 2026 --resume
```

### 6. EU funds (medium, ~2 min for full load)

```bash
python -m src.kohesio.fondos_ue            # 30K beneficiaries
```

### 7. Public contracts (heavy, ~30 min for full backfill)

```bash
python -m src.contratacion.contratos --backfill  # ~50K contracts
```

### 8. Subsidies (heavy, varies by date range)

```bash
# Daily mode (last 30 days, fast):
python -m src.bdns.subvenciones

# Backfill by date ranges:
python -m src.bdns.subvenciones --from-date 2024-01-01 --to-date 2024-06-30
```

### 9. Lobbying (medium)

```bash
python -m src.lobbying.rgi --limit 100     # or remove --limit for all ~1,200
```

### 10. Judicial / Wikipedia (medium)

```bash
python -m src.judicial.wikipedia           # corruption cases from Wikipedia
```

### 11. Post-processing

```bash
# Clean any partial search data from failed runs:
psql "$DATABASE_URL" -c "TRUNCATE search_documents; TRUNCATE vote_divergences_cache; SELECT refresh_vote_divergences_cache();"

# Build the search index:
python -m src.common.search_refresh        # 148K search documents
```

## Verify

```bash
psql "$DATABASE_URL" -c "
SELECT 'budget_lines' AS tbl, COUNT(*) FROM budget_lines
UNION ALL SELECT 'contracts', COUNT(*) FROM contracts
UNION ALL SELECT 'economic_indicators', COUNT(*) FROM economic_indicators
UNION ALL SELECT 'eu_funds', COUNT(*) FROM eu_funds
UNION ALL SELECT 'initiatives', COUNT(*) FROM initiatives
UNION ALL SELECT 'politicians', COUNT(*) FROM politicians
UNION ALL SELECT 'search_documents', COUNT(*) FROM search_documents
UNION ALL SELECT 'subsidies', COUNT(*) FROM subsidies
UNION ALL SELECT 'votes', COUNT(*) FROM votes
UNION ALL SELECT 'voting_sessions', COUNT(*) FROM voting_sessions
ORDER BY tbl;
"
```

## Bug fixes applied

The migration chain has been patched for clean bootstrap from an empty database:

| File | Fix |
|------|-----|
| `20260515120001_revolving_door_real_sources.sql` | Made idempotent (only inserts sources for existing cases) |
| `20260516120000_rls_public_tables.sql` | Moved `eu_funds` RLS to the migration that creates the table |
| `20260521000000_eu_funds.sql` | Added RLS enable and policy |
| `20260525180000_section_index_add_corrupcion.sql` | Removed premature `refresh_section_index()` call |
| `20260528020001_voting_summary_chamber.sql` | Added `DROP VIEW IF EXISTS` before `CREATE OR REPLACE VIEW` |
| `20260701000000_fix_permissions_money_cache.sql` | Added DROP VIEW for dependent views; commented out VACUUM (not allowed in migration pipeline) |
| `20260526000000_*.sql` → `20260526000001_*.sql` | Renamed duplicate timestamp |
| `20260630000000_*.sql` → `20260630000001_*.sql` | Renamed duplicate timestamp |
| `etl/src/common/db.py` | Fixed port normalization (was corrupting local port 54322) |
| `etl/src/congreso/asistencia.py` | Added `chamber` column to voting_sessions ON CONFLICT |
| `etl/src/contratacion/contratos.py` | Skip empty organization names instead of crashing |
| `etl/src/bdns/subvenciones.py` | Fixed pagination parameter: `pageNumber` → `page` (BDNS API bug) |
| `etl/src/common/search_refresh.py` | Fixed empty string UUID comparison |
| `refresh_vote_divergences_cache()` | Added DISTINCT ON to prevent duplicate cache entries |
| `refresh_search_documents(text)` | Added DISTINCT ON to vote_divergence CTE to prevent duplicate entity_ids |
| `refresh_search_person_aliases()` | Truncated alias values to 500 chars to avoid btree index size limit |

## Notes

- The migration chain must stay reproducible from an empty database.
- Avoid migrations that depend on rows produced by historical ETL runs.
- If the hosted Supabase project comes back, dump and compare before discarding.
- The local stack is a recovery/dev stack, not a hardened production deployment.
