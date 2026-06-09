# Self-hosted Supabase production

Production uses the Supabase stack on `desktop-ruben`. Vercel reaches its HTTP
API through Tailscale Funnel; ETL and migration jobs run on the same machine
through the `desktop-ruben` GitHub Actions runner and connect to PostgreSQL on
`127.0.0.1:54322`.

The old `zktpodkvlgciluhbulwr.supabase.co` project is not part of the production
data path. Do not add it back as a fallback: a reachable but obsolete project
looks like an empty database and hides configuration drift.

## Production topology

```text
Browser / Vercel
  -> https://desktop-ruben.taileed0d5.ts.net
  -> Tailscale Funnel
  -> Supabase Kong on 127.0.0.1:54321

GitHub Actions ETL / migrations
  -> self-hosted runner: desktop-ruben
  -> PostgreSQL on 127.0.0.1:54322
```

Repository variables:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
AUTH_EXPECTED_SUPABASE_HOST
```

Repository secrets:

```text
DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY
AUTH_BACKUP_ENCRYPTION_PASSPHRASE
```

Vercel production variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The runner is installed as the user service
`espana-transparente-runner.service`, with lingering enabled so it starts after
a reboot. Every push to `main` applies pending migrations before the next ETL
cycle. Daily and weekly ETLs run on this self-hosted runner because PostgreSQL
is not exposed publicly.

The runner uses `uv` to maintain a persistent Python 3.12 environment under
`RUNNER_TOOL_CACHE`. Do not use `actions/setup-python` on this CachyOS host:
the action does not provide CachyOS toolcache builds.

Scheduled operations:

```text
02:30 UTC daily   encrypted critical backup
03:15 UTC daily   read-only Auth health
04:00 UTC daily   daily ETL batch
06:00 UTC Monday  weekly ETL batch
```

Migrations, ETLs, database recovery, critical restore, and backups share the
`production-database-writer` concurrency group so only one writer runs at a
time.

## Critical backups

The `Auth backup` workflow creates a daily encrypted artifact retained for 30
days. It contains:

- Auth schema data, profiles, settings, annotations, and Storage metadata.
- The private `user-avatars` Storage files.
- Human review decisions for judicial links, CNMC lobbying, BORME matches,
  revolving-door candidates, and rejected photo candidates.

Mass public datasets are intentionally excluded. They are rebuilt from
migrations and ETLs.

The encryption key lives in the `AUTH_BACKUP_ENCRYPTION_PASSPHRASE` repository
secret and must also be stored outside GitHub in the owner's password manager.
Losing both copies makes the encrypted artifacts unrecoverable.

Every backup is decrypted into a temporary directory immediately after
creation, checked against `SHA256SUMS`, and inspected with `pg_restore --list`
before upload.

### Validate or restore

Run the `Critical restore` workflow with the producing backup run ID:

- `dry-run` downloads, decrypts, checks hashes, validates the dump, and resolves
  every review decision by natural key without changing data.
- `apply` additionally requires the exact confirmation `RESTORE_CRITICAL`.

The apply path replaces Auth/profile/Storage metadata from the dump, restores
the private avatar files, and reapplies review decisions. Any missing or
ambiguous natural-key reference aborts before mutation.

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
python -m src.congreso.power_relationships # 550+ power relationships (cadena de mando)
python -m src.ine.indicadores              # 720 IPC data points
python -m src.ine.indicadores_ampliados    # 380 GDP/unemployment/etc
```

### 2. Congress data (medium, ~2-5 min each)

```bash
python -m src.congreso.iniciativas         # 439 legislative initiatives
python -m src.congreso.declaraciones --skip-actividades  # 800 declarations
python -m src.congreso.declaraciones_ocr --limit 50      # OCR-scanned declarations
python -m src.congreso.opendata_intereses              # financial interests registry
python -m src.congreso.asistencia --resume # 131 voting sessions, 629K votes
python -m src.congreso.cods --resume       # congressional records
```

### 3. Senate data (medium, ~4 min)

```bash
python -m src.senado.senadores             # 266 senators
python -m src.senado.bajas                 # former senators (needed for historical votes)
python -m src.senado.votaciones            # senate voting sessions
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

### 10. Judicial / Transparency (medium)

```bash
python -m src.judicial.wikipedia           # corruption cases from Wikipedia
python -m src.judicial.cgpj                # judicial appointments (CGPJ)
python -m src.borme.officers --limit 200    # BORME company officers
python -m src.lobbying.rgi                 # lobbying register
python -m src.public_bodies.boe_nombramientos --days 7  # BOE public appointments
```

### 11. Post-processing

```bash
# Clean any partial search data from failed runs:
psql "$DATABASE_URL" -f supabase/migrations/20260704000000_fix_vote_divergence_search_unique.sql
psql "$DATABASE_URL" -c "SELECT refresh_vote_divergences_cache(); SELECT refresh_search_documents('vote_divergence');"

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
| `20260701000000_lobbying_*.sql` → `20260701000001_lobbying_*.sql` | Renamed duplicate timestamp |
| `20260705000000_initiative_*.sql` → `20260705000001_initiative_*.sql` | Renamed duplicate timestamp |
| `20260708010000_fix_declarations_page_rpc.sql` | Removed ambiguous output-column references and made numeric parsing tolerant |
| `20260708020000_restore_reviewed_revolving_doors.sql` | Restores the reviewed 20-case dataset and public sources on migration-only databases |
| `etl/src/common/db.py` | Fixed port normalization (was corrupting local port 54322) |
| `etl/src/congreso/asistencia.py` | Added `chamber` column to voting_sessions ON CONFLICT |
| `etl/src/contratacion/contratos.py` | Skip empty organization names instead of crashing |
| `etl/src/bdns/subvenciones.py` | Fixed pagination parameter: `pageNumber` → `page` (BDNS API bug) |
| `etl/src/common/search_refresh.py` | Fixed empty string UUID comparison |
| `refresh_vote_divergences_cache()` | Added DISTINCT ON to prevent duplicate cache entries |
| `refresh_search_documents(text)` | Added DISTINCT ON to vote_divergence CTE (`20260704000000`) to prevent duplicate entity_ids |
| `refresh_search_person_aliases()` | Truncated alias values to 500 chars to avoid btree index size limit |
| `.github/workflows/ci.yml` | Runs daily/weekly ETLs on `desktop-ruben` with a persistent `uv` Python 3.12 environment |
| `.github/workflows/auth-backup.yml` | Daily encrypted critical backup with 30-day retention and restore validation |
| `.github/workflows/critical-restore.yml` | Dry-run/apply recovery workflow with natural-key review restoration |
| `.github/workflows/ci.yml` | Added `congreso.power_relationships` to weekly ETL job |
| `SELF_HOSTED_SUPABASE.md` | Documented all missing ETL scripts (senado.bajas, declaraciones_ocr, opendata_intereses, borme.officers, lobbying.rgi, judicial.cgpj, public_bodies.boe_nombramientos) |
| `web/src/lib/etl-pipelines.ts` | Added missing pipeline labels for /estado-datos page |

## Notes

- The migration chain must stay reproducible from an empty database.
- Avoid migrations that depend on rows produced by historical ETL runs.
- Keep Tailscale Funnel and the GitHub runner online; `/api/health` verifies the
  public path after every production deployment.
- `/api/health` checks availability only. Data freshness is reported separately
  on the home page and `/estado-datos`: 36 hours for daily critical sources and
  9 days for weekly critical sources.
- Never point Vercel or Actions at a hosted Supabase project as an availability
  fallback. Recovery must restore this instance or promote an explicit backup.
