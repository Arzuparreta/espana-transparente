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

- [ ] Ampliar puertas giratorias con más fuentes primarias y menos dependencia de entradas manuales
- [ ] Declaraciones de actividades: diseñar extracción y modelo, hoy no tienen pipeline equivalente al de bienes/rentas
- [ ] Presupuestos Generales del Estado: ETL base y jerarquía ministerio -> programa -> partida
- [ ] Fondos UE trazados al receptor final
- [ ] Búsqueda avanzada / índice dedicado si el volumen empieza a penalizar las consultas
- [ ] Más cobertura institucional útil fuera del Congreso cuando el modelo de responsables ya esté estable

### Mejoras recientes del 15 mayo 2026

- [x] El ETL de diputados ya no depende de sondear fichas para descubrir `codParlamentario`
- [x] El directorio activo del Congreso se resuelve desde `searchDiputados` y el CSV actual se descubre dinámicamente
- [x] Las fotos oficiales usan la ruta vigente del Congreso (`/docu/imgweb/diputados/{cod}_{legislatura}.jpg`)
- [x] Se eliminó el hotlinking de terceros en `politicians.photo_url`: la URL pública siempre sale de Supabase Storage
- [x] El frontend consume `photo_variants` con `srcSet` y fallback estable a iniciales

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
- **Declaraciones de actividades**: el Congreso no ofrece un flujo tan limpio como bienes/rentas e intereses; sigue pendiente diseño específico.
- **Referencias YAML**: liderazgo de partido y algunos mapas de responsabilidad siguen siendo datos mantenidos como PR en `etl/data/` por falta de fuente estructurada única.
- **Presupuestos**: sigue sin haber pipeline estable equivalente al resto de verticales.

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

---

## Guía de contribución

- Revisa `README.md` para levantar el proyecto
- Los ETL se ejecutan como módulos con `PYTHONPATH=src`
- Las escrituras ETL van por PostgreSQL directo, no por el SDK de Supabase
- Toda contribución debe pasar tests ETL y build/lint web
- Leer `AGENTS.md` y `CLAUDE.md` antes de tocar producto o pipelines

---

*Plan actualizado el 15 de mayo de 2026. Refleja el estado real del repo y de los cron tras la refactorización de identidad y fotos de diputados.*
