<p align="center">
  <img src="web/public/brand/github-banner.svg" alt="España Transparente — datos públicos de la política española" />
</p>

<p align="center">
  <strong>Portal de datos públicos sobre la política española.</strong><br/>
  Diputados, votaciones, contratos, subvenciones, puertas giratorias y cadenas de responsabilidad — con trazabilidad hasta la fuente.
</p>

<p align="center">
  <a href="https://spaintransparencia.info"><strong>spaintransparencia.info →</strong></a>
</p>

<p align="center">
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" />
  <img alt="Python 3.12" src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white" />
  <img alt="License MIT" src="https://img.shields.io/badge/License-MIT-blue" />
</p>

---

## Qué es esto

España Transparente reúne en un mismo sitio los datos que ya son públicos pero viven dispersos entre el Congreso, el INE, la Plataforma de Contratación, la BDNS y otros registros oficiales. Los normaliza, los enlaza por persona y los presenta sin editorializar: cada cifra apunta a su fuente original.

> El producto es un **portal de datos**, no un manifiesto. Las reglas editoriales viven en [`AGENTS.md`](AGENTS.md), la hoja de ruta activa en [`NEXT.md`](NEXT.md), y la interfaz solo muestra hechos.

## Qué incluye hoy

- **XV Legislatura** — 350 diputados activos con partido, circunscripción, biografía y foto oficial.
- **Votaciones nominales** — votos individuales enlazados a cada diputado, sesión a sesión.
- **Cadenas de responsabilidad** — cargos estatales, autonómicos y municipales conectados al gasto público.
- **Contratos y subvenciones** — PCSP (Plataforma de Contratación) y BDNS (`infosubvenciones.es`).
- **Indicadores macro** — IPC, PIB, EPA y deuda desde la API del INE.
- **Puertas giratorias** — pipeline de tres fases con curación humana obligatoria antes de publicar.
- **Divergencias** — detección automática de votos contra el grupo parlamentario.
- **Anotaciones** — sistema propio para que la comunidad añada contexto verificable.

## Arquitectura

```
Fuentes públicas  →  etl/src/<source>/   →  Supabase (Postgres)  →  web/src/lib/data/  →  Next.js (App Router)
```

| Capa            | Tecnología                                            | Carpeta              |
| --------------- | ----------------------------------------------------- | -------------------- |
| Frontend        | Next.js 14 · App Router · Tailwind · shadcn/ui        | `web/`               |
| ETL             | Python 3.12 · psycopg2 · httpx                        | `etl/`               |
| Base de datos   | Supabase (PostgreSQL) · 15+ tablas, vistas y RPCs     | `supabase/migrations/` |
| Datos curados   | YAML revisado vía PR (liderazgos, responsables)       | `etl/data/`          |
| CI/CD           | GitHub Actions · cron diario y semanal · Vercel       | `.github/workflows/` |

## Arranque rápido

### Frontend

```bash
cd web
npm install
npm run dev            # http://localhost:3000
npm run build          # build de producción
npm run lint           # next lint
npm run ui:audit       # primitives de layout y reglas responsive
npm run content:audit  # reglas editoriales (ver AGENTS.md)
```

Variables requeridas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (formato `sb_publishable_…`; los JWT legacy no funcionan).

### ETL

```bash
cd etl
pip install -r requirements.txt

# Todos los pipelines se ejecutan como módulos desde src/
PYTHONPATH=src python -m src.congreso.diputados
PYTHONPATH=src python -m src.ine.indicadores
PYTHONPATH=src python -m src.contratacion.contratos
PYTHONPATH=src python -m pytest tests/
```

Las escrituras requieren `DATABASE_URL` (URI directo de Postgres desde Supabase → Settings → Database). Todas las escrituras pasan por `common.db.get_pg_conn()` — el SDK de Supabase solo se usa para lecturas.

### Puertas giratorias (3 fases)

```bash
# 1. Ingesta de candidatos (CSV o descubrimiento BORME)
PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv puertas.csv --dry-run

# 2. Revisión humana
PYTHONPATH=src python -m src.puertas_giratorias.review list
PYTHONPATH=src python -m src.puertas_giratorias.review reject <id>

# 3. Publicación (exige ≥1 fuente "primary")
PYTHONPATH=src python -m src.puertas_giratorias.review publish <id> --reviewed-by <nombre>
```

Nada se publica automáticamente. El frontend público lee exclusivamente de `revolving_door` y `v_revolving_door_public`; los candidatos no son accesibles por anon.

### Migraciones

```bash
cd etl
python apply_migration.py ../supabase/migrations/<archivo>.sql
# o, alternativamente:
npx supabase db push
```

## Fuentes de datos

| Fuente                                                              | Uso                                      |
| ------------------------------------------------------------------- | ---------------------------------------- |
| [Congreso Open Data](https://www.congreso.es/es/opendata)           | Diputados, votaciones, iniciativas       |
| [INE API](https://www.ine.es/dyngs/DataLab/manual.html?cid=66)      | IPC, PIB, EPA, deuda                     |
| [PCSP](https://contrataciondelestado.es)                            | Contratos públicos (ATOM/XML)            |
| [BDNS · infosubvenciones.es](https://www.infosubvenciones.es)       | Subvenciones (organizaciones)            |
| [datos.gob.es](https://datos.gob.es)                                | Catálogo abierto de la AGE               |
| [Civio](https://github.com/civio)                                   | Parsers de presupuestos (EUPL)           |
| [Wikidata](https://www.wikidata.org)                                | Fallback de fotos para diputados         |

> El portal del Congreso aplica rate-limit agresivo (403 tras pocos requests). Los scrapers usan `curl` vía `subprocess` con `REQUEST_DELAY = 1.5s`. **No bajar el delay ni paralelizar peticiones al Congreso.**

## Reglas duras (auditadas en CI)

- **Editorial** (`npm run content:audit`) — la UI no contiene metodología, juicios de valor, ni referencias filosóficas. Solo etiquetas factuales.
- **UI** (`npm run ui:audit`) — `grid-cols-N` requiere variante responsive; `flex items-center justify-between` requiere `min-w-0`; los colores de voto/partido se importan de `lib/domain-style.ts`; los tabs viven en `components/domain/SectionTabs.tsx`.

Detalles completos en [`CLAUDE.md`](CLAUDE.md), [`DESIGN.md`](DESIGN.md) y [`NEXT.md`](NEXT.md).

## Contribuir

1. Lee [`AGENTS.md`](AGENTS.md) — es obligatorio antes de tocar código o copy.
2. Revisa los [issues abiertos](https://github.com/Arzuparreta/espana-transparente/issues).
3. Haz fork, crea una rama, abre un PR. CI debe pasar (`lint` + `build` + auditorías).
4. Para añadir datos curados (responsables, liderazgos), edita el YAML correspondiente en `etl/data/` y deja el `last_verified` actualizado.

## Licencia

[MIT](LICENSE) · El código es libre. Los datos provienen de fuentes públicas; cada vista enlaza a su origen.
