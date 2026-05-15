# Pipeline de puertas giratorias

Investigación → revisión humana → publicación. Nada se publica automáticamente.

## Modelo de datos (3 tablas, 1 vista)

- `revolving_door_candidates` — staging. Cada candidato lleva `status` (`needs_review` → `published` | `rejected`) y `confidence` (0–1).
- `revolving_door_sources` — fuentes asociadas (`primary` / `secondary` / `discovery`), reutilizadas tras publicar.
- `revolving_door` — casos verificados. Solo aquí lee el frontend.
- `v_revolving_door_public` — vista de lectura para anon: case + fuentes ordenadas.

Política RLS: anon ve solo casos verificados y sus fuentes; `authenticated` puede mirar candidatos en investigación.

## Flujo

### 1. Ingest

**CSV** (caso normal — investigación manual):

```bash
PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv data.csv --dry-run
PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv data.csv
```

Columnas aceptadas (con alias en español):

```
person_name, political_party, public_role, public_organization,
public_exit_date, private_role, private_organization,
private_start_date, authorization_date, sector,
source_url, source_name, source_type, title, published_at,
evidence_text, confidence, discovered_by, discovery_method
```

`source_type` debe ser `primary`, `secondary` o `discovery`. Para publicar, hace falta al menos una fuente `primary`.

**BORME** (scanner automático — parsea PDFs de Sección A):

```bash
# Watchlist completa contra el día anterior (modo cron):
PYTHONPATH=src python -m src.puertas_giratorias.ingest \
  --watchlist data/personas_vigiladas.yml

# Día concreto:
PYTHONPATH=src python -m src.puertas_giratorias.ingest \
  --watchlist data/personas_vigiladas.yml --borme-date 2026-05-13

# Nombres ad-hoc:
PYTHONPATH=src python -m src.puertas_giratorias.ingest \
  --names "Nombre Apellido" "Otro Nombre" --borme-date 2026-05-13
```

El scanner descarga los PDFs de Sección A (Actos inscritos) para cada provincia,
extrae líneas de `Nombramientos` y `Ceses/Dimisiones`, y hace fuzzy matching contra
el watchlist (tolerante a acentos y orden APELLIDO NOMBRE vs NOMBRE APELLIDO).

Cuando hay `Nombramientos`: `source_type=primary`, `confidence=0.65`.
Cuando solo hay `Ceses/Dimisiones`: `source_type=secondary`, `confidence=0.45`.

En ambos casos, el candidato entra en staging y requiere revisión humana antes
de poder publicarse. El rol privado queda pre-rellenado con el cargo detectado
en el BORME (ej: `Consejero`, `Adm. Unico`), pero `private_organization` requiere
que el revisor identifique la empresa concreta en el PDF enlazado.

### 2. Revisión

```bash
PYTHONPATH=src python -m src.puertas_giratorias.review list                # status=needs_review
PYTHONPATH=src python -m src.puertas_giratorias.review list --status published
PYTHONPATH=src python -m src.puertas_giratorias.review reject <id> --notes "..."
PYTHONPATH=src python -m src.puertas_giratorias.review publish <id> --reviewed-by ruben
```

`publish` valida:
- Al menos una fuente `primary` asociada.
- `public_role` y `public_organization` presentes.
- `private_role` y `private_organization` distintos de `Pendiente de revisar`.

Y entonces inserta en `revolving_door` con `verification_status='verified'`, copia las fuentes y marca el candidato como `published`.

## Por qué hay tres fases

La investigación toma tiempo y produce material inseguro. El staging permite:

- Ingresar pistas (BORME, OSINT, periodismo) sin contaminar la tabla pública.
- Adjuntar fuentes incrementalmente hasta tener una `primary`.
- Revisión auditable (`reviewed_by`, `reviewed_at`, `review_notes`).
- Rechazo explícito (las pistas falsas también se documentan).

## Requisitos del sistema

El scanner BORME usa `pdftotext` (parte de `poppler-utils`). En Debian/Ubuntu:
```bash
apt-get install poppler-utils
```
En GitHub Actions ya disponible en `ubuntu-latest`.

## Pendientes

- Backfill desde fuentes secundarias documentadas: hay casos conocidos en prensa
  especializada (El Confidencial, Civio) que podrían importarse vía CSV para
  arrancar el staging con más volumen.
- Ampliar `personas_vigiladas.yml` con más cargos intermedios (secretarios de
  estado, directores generales) cuando el ruido sea asumible.
