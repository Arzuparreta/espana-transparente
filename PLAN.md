# España Transparente

> *"El Estado no existe fuera de las personas que lo conforman."*
**España Transparente** es un portal de datos públicos sobre la política española. Reúne diputados, votaciones, contratos, subvenciones, declaraciones y relaciones de poder con contexto verificable y sin editorialización.

---

## Visión y principios (guía interna de producto)

Estos principios determinan QUÉ datos recogemos y CÓMO los estructuramos.
**NUNCA aparecen como texto en la web.** El ciudadano ve datos crudos; la
metodología es invisible.

- **Personas, no abstracciones**: el dato útil no es "el partido votó", sino qué persona votó, con qué disciplina y bajo qué cadena de mando.
- **La excepción es la información**: la UI debe resaltar divergencias, ausencias relevantes y casos atípicos, no esconderlos en agregados.
- **Trazabilidad radical**: cada registro importante debe enlazar origen, responsable y fuente pública.
- **Sin editorializar**: el producto expone hechos, relaciones y series; el usuario saca sus conclusiones.
- **Determinismo operativo**: ETLs reproducibles, fuentes priorizadas, refresh automáticos y salidas estables en base de datos y frontend.

---

## Arquitectura

| Componente | Tecnología | Estado |
|-----------|-----------|--------|
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui | En producción en Vercel |
| Base de datos | Supabase (PostgreSQL) | Esquema activo + migraciones SQL |
| ETL / Scraping | Python 3.12 (`psycopg2`, `httpx`, `BeautifulSoup`, Pillow) | Pipelines diarios y semanales |
| Storage de medios | Supabase Storage | Fotos versionadas e inmutables |
| Anotaciones | Tabla propia en Supabase | Activo |
| CI/CD | GitHub Actions + Vercel | Activo |

---

## Fuentes de datos

| Fuente | Estado | Datos |
|--------|--------|-------|
| **Congreso Open Data + directorio web** | ✅ | Diputados activos, `codParlamentario`, votaciones, iniciativas, declaraciones, fotos oficiales |
| **INE API** | ✅ | IPC, PIB, EPA, deuda y otras series económicas |
| **datos.gob.es** | ✅ | Catálogo de datasets de la Administración |
| **PCSP** | ✅ | Contratos públicos vía feeds ATOM/XML |
| **BDNS / infosubvenciones.es** | ✅ | Subvenciones públicas |
| **Civio (GitHub)** | ✅ | Referencias para presupuestos y scraping cívico |
| **Portal de Transparencia** | ⚠️ | Accesible pero cambiante; preferir fuentes derivadas o catálogo |
| **Wikidata / Commons** | ✅ | Fallback secundario para fotos cuando no hay imagen oficial |
| **Senado** | ❓ | Pendiente evaluar integración útil |

---

## Modelo de datos

### Tablas principales

| Tabla | Qué almacena |
|-------|-------------|
| `politicians` | Personas con identidad pública, `cod_parlamentario`, foto activa y variantes |
| `politician_photo_versions` | Versiones candidatas/activas de foto con fuente, hashes, metadatos y promoción |
| `parties` | Partidos políticos (nombre, acrónimo, color) |
| `legislatures` | Legislaturas I-XV |
| `politician_memberships` | Diputado en cada legislatura (partido, circunscripción) |
| `voting_sessions` | Sesiones de votación (fecha, título, expediente) |
| `votes` | Voto individual por diputado y sesión |
| `initiatives` | Iniciativas legislativas y trazabilidad |
| `power_relationships` | Relaciones de mando y dependencia política |
| `revolving_door` | Casos publicados de puertas giratorias |
| `revolving_door_candidates` | Candidatos pendientes de revisión |
| `revolving_door_sources` | Fuentes públicas asociadas a candidatos/casos |
| `organizations` | Empresas, organismos y entidades enlazadas |
| `annotations` | Anotaciones de usuarios por entidad |
| `contracts` | Contratos públicos |
| `grants` | Subvenciones públicas |
| `economic_indicators` | Series temporales del INE |

### Función SQL destacada

`get_divergences()` detecta votos donde un diputado votó distinto a la mayoría
de su grupo parlamentario. Excluye ausencias (`No vota`) y alimenta la capa de
divergencias del frontend.

---

## Estado actual y roadmap

### Completado

- [x] Monorepo `web/` + `etl/` + `supabase/migrations/`
- [x] Frontend público desplegado en Vercel
- [x] Esquema Supabase con tablas, vistas y funciones principales
- [x] 350 diputados activos de la XV Legislatura ingeridos y normalizados
- [x] Sincronización de `cod_parlamentario` desde `searchDiputados` del Congreso
- [x] 350/350 diputados activos con foto pública servida desde Supabase Storage
- [x] Pipeline de fotos determinístico con prioridad `congreso_oficial -> wikidata`
- [x] Versionado de fotos con variantes WebP responsivas y promoción anti-regresión
- [x] Ficha de diputado con biografía, legislaturas, partido, circunscripción y avatar responsivo
- [x] Página y detalle de votaciones con divergencias detectadas
- [x] Historial de voto individual en ficha de diputado
- [x] Vistas de asistencia derivadas de votos individuales
- [x] Contratos públicos ETL + cruce con responsables públicos
- [x] Subvenciones ETL + cruce con responsables públicos
- [x] Declaraciones de bienes/rentas e intereses económicos del Congreso
- [x] Puertas giratorias: pipeline candidato -> revisión -> publicación
- [x] Cadena de mando y responsables multinivel materializados en base
- [x] Indicadores económicos del INE ingeridos en pipeline diario
- [x] CI/CD con tests, build y cron ETL

### En curso / siguiente prioridad

- [x] Ampliar puertas giratorias: scanner BORME real — descarga PDFs de Sección A, extrae líneas `Nombramientos/Ceses`, fuzzy-match contra watchlist. Genera `source_type=primary` (confidence 0.65) en lugar del scanner de metadatos JSON anterior (que nunca encontraba nada).
- [x] Declaraciones de actividades: pipeline implementado — URL determinista `/docinte/registro_intereses_diputado_{cod}.pdf`, tipo `actividades` en `economic_declarations`, frontend actualizado. Ingest completo: 350/350 diputados, 1149 declaraciones.
- [x] Presupuestos Generales del Estado: ETL base implementado — jerarquía sección → programa → capítulo, 2016-2023 ingestados (~1.100-1.555 partidas/año). `program_name` enriquecido desde `estructura_funcional.csv`. Fuente: Civio scraper-pge. Frontend `/presupuestos` y `/presupuestos/[section]` desplegados.
- [x] Fondos UE trazados al receptor final — ETL Kohesio implementado. Entity ID de España en LOD graph: `Q7`. 72.344 beneficiarios ES, ESIF 2014-2027. Tabla `eu_funds`, vista `v_eu_funds_summary`, frontend `/fondos-ue`, cron semanal.
- [x] Búsqueda global full-text: función RPC `search_global` (tsvector + unaccent) sobre 5 entidades; página `/buscar`; atajo ⌘K en header.
- [x] Cobertura institucional — Gobierno: página `/gobierno` con vista `v_gobierno_actual`, gabinete completo con partido, gasto por ministerio y enlace a fichas de diputados.
- [x] Home rediseñada como dashboard: búsqueda, snapshot del gobierno, votaciones recientes con badge de divergencias, puertas giratorias verificadas.
- [x] Senado — ETL implementado: scraping HTML letra a letra (A-Z+Ñ) del portal del Senado + ficha individual vía meta tags. Migración `senate_chamber` añade `senate_id` a `politicians` y `chamber` a `politician_memberships`. Página `/senado` desplegada. Cron semanal añadido.
- [x] Cobertura institucional: Tribunal Constitucional, CGPJ, RTVE, SEPI — 63 nombramientos activos con partido, organismo proponente y fuente BOE. Página `/instituciones` con cross-link a puertas giratorias.

### Mejoras recientes del 15 mayo 2026

- [x] El ETL de diputados ya no depende de sondear fichas para descubrir `codParlamentario`
- [x] El directorio activo del Congreso se resuelve desde `searchDiputados` y el CSV actual se descubre dinámicamente
- [x] Las fotos oficiales usan la ruta vigente del Congreso (`/docu/imgweb/diputados/{cod}_{legislatura}.jpg`)
- [x] Se eliminó el hotlinking de terceros en `politicians.photo_url`: la URL pública siempre sale de Supabase Storage
- [x] El frontend consume `photo_variants` con `srcSet` y fallback estable a iniciales

### Mejoras recientes del 15 mayo 2026 (sesión tarde)

- [x] Vertical de Presupuestos: migración `budget_lines` + vistas `v_budget_summary`, `v_budget_by_program`, `v_budget_responsibility`
- [x] ETL `src.presupuestos.presupuestos` con parser Civio (`gastos.csv` + `estructura_organica.csv`), dry-run, resume y backfill por año
- [x] Datos ingestados: 2016, 2017, 2018, 2019P, 2021, 2022, 2023 (2020 sin fuente — España no aprobó PGE ese año)
- [x] Frontend `/presupuestos` (lista ministerios por año, selector 2016-2026) y `/presupuestos/[section]` (detalle con programas, capítulos y ministro responsable)
- [x] Cron semanal añadido: `src.presupuestos.presupuestos --year $(date +%Y) --resume`

### Mejoras recientes del 15 mayo 2026 (sesión noche)

- [x] `budget_lines.program_name` enriquecido desde `estructura_funcional.csv` de Civio — 8.020 registros actualizados (2016-2023)
- [x] Declaraciones de actividades verificadas end-to-end y ingestadas para 350/350 diputados (1.149 registros). Fix UI: "Sin fecha" → "Documento vigente" para declaraciones de actividades
- [x] Scanner BORME de puertas giratorias reescrito: parsea PDFs de Sección A reales en lugar de metadatos JSON (que nunca encontraba nada). Genera candidatos con `source_type=primary` y `confidence=0.65` cuando encuentra `Nombramientos`. Requiere `pdftotext` (poppler-utils)

---

## Fotos de diputados: política operativa actual

- Fuente principal: Congreso oficial
- Fallback: Wikidata / Commons solo si no hay imagen oficial válida
- Persistencia: objetos inmutables por hash en Supabase Storage
- Publicación: `politicians.photo_url` y `photo_variants` apuntan solo a la versión promovida
- Refresh:
  - Diario: cubrir faltantes
  - Semanal: revisar fotos existentes y refrescar candidatas antiguas
- Garantía operativa actual: `350/350` diputados activos con foto pública

Si una nueva foto falla validación o una fuente externa empeora, la versión
anterior sigue siendo la pública. No se pisa la foto activa con una candidata
peor.

---

## Problemas conocidos

- **Rate-limit del Congreso**: el portal del Congreso devuelve 403 tras ráfagas. Los scrapers usan `curl`, User-Agent explícito y `REQUEST_DELAY=1.5s`. No paralelizar peticiones al Congreso.
- **Declaraciones de actividades**: ~~pendiente~~ implementado. URL `/docinte/registro_intereses_diputado_{cod}.pdf` (un único PDF por diputado, sin fecha en URL, se actualiza in-place). Tipo `actividades` en `economic_declarations`. Ver `declaraciones.py`.
- **Referencias YAML**: liderazgo de partido y mapas de responsabilidad se mantienen como PR en `etl/data/`. Todos los YAMLs llevan marca `# Última verificación:` en la cabecera. Cadencia recomendada: mensual para `party_leadership.yml` y `gobierno_historico.yml` (cambian con relevos ministeriales), trimestral para `responsibility_positions.yml` y `public_body_responsibility_map.yml`, semestral para `personas_vigiladas.yml`.
- **Presupuestos 2020**: sin fuente disponible — España prorrogó el PGE 2018 en 2019 y 2020; Civio no publicó datos para ese año. Cobertura actual en web/DB: 2016-2026, con hueco en 2020.
- **Presupuestos 2024-2026**: cargados desde el ROM de SEPG como `budget_type='prorroga'`. El PGE en vigor sigue siendo 2023 y la UI lo muestra explícitamente.
- **Presupuestos 2027+**: pendiente de nueva fuente pública estructurada. Cuando SEPG publique nueva prórroga o proyecto, actualizar `BUDGET_YEAR_META` en `data.ts`, el registro de fuentes en `sources.py` y reingestar.
- **Fondos UE — implementado**: fuente Kohesio (`kohesio.ec.europa.eu/api/beneficiaries`). Entity ID de España: `https://linkedopendata.eu/entity/Q7`. 72.344 beneficiarios ESIF 2014-2027. ETL semanal activo. Ver `src.kohesio.fondos_ue`.

---

## Scheduling ETL actual

- Diario (`etl-daily`)
  - `src.congreso.diputados`
  - `src.congreso.asistencia --from-date 20250101`
  - `src.ine.indicadores`
  - `src.contratacion.contratos`
  - `src.bdns.subvenciones` (ventana diaria)
  - `src.photos.run --refresh-missing`
- Semanal (`etl-weekly`)
  - `src.congreso.cods --resume`
  - `src.congreso.declaraciones`
  - `src.congreso.gobierno`
  - `src.congreso.responsables`
  - `src.photos.run --no-refresh-missing --max-age-days 30`
  - `src.presupuestos.presupuestos --year $(date +%Y) --resume`
  - `src.kohesio.fondos_ue`

---

## Guía de contribución

- Revisa `README.md` para levantar el proyecto
- Los ETL se ejecutan como módulos con `PYTHONPATH=src`
- Las escrituras ETL van por PostgreSQL directo, no por el SDK de Supabase
- Toda contribución debe pasar tests ETL y build/lint web
- Leer `AGENTS.md` y `CLAUDE.md` antes de tocar producto o pipelines

---

### Mejoras del 15 de mayo de 2026 (sesión noche — consolidación)

- [x] Tests de humo añadidos para `bdns`, `contratacion`, `ine` y `puertas_giratorias` (31 tests nuevos; suite total: 90/90 ✅)
- [x] Todos los YAMLs de `etl/data/` tienen marca `# Última verificación: 2026-05-15`; cadencia documentada en "Problemas conocidos"
- [x] BORME scanner verificado estructuralmente: parsers `_extract_appointments` y `_best_match` cubiertos con fixtures reales de texto BORME; pipeline `--dry-run` disponible para validación operativa

---

### Mejoras del 15 de mayo de 2026 (sesión madrugada — vertical institucional)

- [x] Tabla `institutional_appointments` + vista `v_instituciones_actuales` (con cross-link revolving door)
- [x] YAML `instituciones_nombramientos.yml` con 63 entradas reales: 12 TC, 21 CGPJ, 15 RTVE, 15 SEPI (datos BOE verificados)
- [x] ETL `src.instituciones.instituciones` — upsert desde YAML con fuzzy-match a `politicians`
- [x] Frontend `/instituciones` — StatGrid + secciones por organismo + badges de partido + cross-link puertas giratorias
- [x] Enlace "Instituciones" añadido al header y menú móvil
- [x] Tests `test_instituciones.py` — 101/101 pasan (incluidos los 3 con YAML real)
- [x] ETL semanal añadido al CI (`src.instituciones.instituciones`)

---

---

### Mejoras del 16 de mayo de 2026 — coherencia visual del fondo

- [x] Causa raíz identificada: `--background` era crema amarillenta (`60 23% 97%`) y `--card` blanco puro — el tono rojizo dependía solo del gradiente radial en `top right`, que se veía mucho en páginas con contenido disperso (indicadores, diputados) y casi nada en páginas densas (subvenciones)
- [x] `--background` cambiado a `15 22% 97%` (crema rosada) y `--card` a `15 10% 99%` — la base de color ya lleva el matiz rojizo de forma uniforme
- [x] Gradiente del body cambiado de `circle at top right` a `ellipse 160% 80% at 90% 0%` — cubre todo el ancho con transición suave
- [x] Card component: opacidad por defecto normalizada de `bg-card/95` a `bg-card/80`
- [x] Eliminados ~25 overrides arbitrarios de opacidad (`/80`, `/85`, `/90`) en páginas y componentes — todos los Card usan ahora el default salvo excepciones intencionales (`hover:bg-card`, `bg-card/60`, `bg-card/70`)

---

---

### Mejoras del 16 de mayo de 2026 — Fondos UE (Kohesio)

- [x] Entity ID de España en el grafo LOD de Kohesio resuelto: `https://linkedopendata.eu/entity/Q7` (`countryCode=ES`)
- [x] Migración `eu_funds` + vista `v_eu_funds_summary`
- [x] ETL `src.kohesio.fondos_ue` — pagina 72.344 beneficiarios españoles ESIF 2014-2027, upsert con `--dry-run` y `--limit`
- [x] Frontend `/fondos-ue` con StatGrid, lista paginada ordenada por fondo UE, enlace a Kohesio por beneficiario
- [x] "Fondos UE" añadido al header desktop y menú móvil (grupo "Dinero público")
- [x] Cron semanal añadido al CI (`src.kohesio.fondos_ue`)

*Plan actualizado el 16 de mayo de 2026.*
