# 🜁 Acción Humana

> *"El Estado no existe fuera de las personas que lo conforman."*
**Acción Humana** es una máquina de transparencia radical sobre la política española. Toma los datos públicos —votaciones, contratos, presupuestos, puertas giratorias— y los traduce al lenguaje del ciudadano. Sin editoriales, sin filtros ideológicos, sin tratar las instituciones como si tuvieran voluntad propia.

---

## 🧭 Visión y principios (guía interna de producto)

Estos principios determinan QUÉ datos recogemos y CÓMO los estructuramos.
**NUNCA aparecen como texto en la web.** El ciudadano ve datos crudos;
la metodología es invisible.

- **Individualismo metodológico**: El Estado, el Gobierno, los partidos no actúan. Actúan PERSONAS. Cada voto, cada contrato, cada decisión se enlaza a individuos concretos.
- **La excepción es la información**: 349 diputados votando en bloque no es noticia. 1 diputado votando contra su grupo SÍ lo es. La UI debe resaltar divergencias, no listar uniformidades.
- **Trazabilidad radical**: Cada iniciativa legislativa debe mostrar su origen real: ¿gobierno? ¿UE? ¿lobby? ¿veto presupuestario? El ciudadano sigue el hilo de QUIÉN decidió QUÉ.
- **Sin editorializar**: Los datos hablan solos. No decimos "esto está mal". Mostramos quién, cómo y por qué. El ciudadano infiere.
- **Coste cero y soberanía tecnológica**: Stack gratuito (Vercel, Supabase, GitHub Actions). Cualquiera puede levantar su instancia.

---

## 🏛️ Arquitectura

| Componente | Tecnología | Plan |
|-----------|-----------|------|
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui | Vercel Hobby |
| Base de datos | Supabase (PostgreSQL) | 500 MB Free |
| ETL / Scraping | Python 3.12 (psycopg2, httpx, BeautifulSoup) + GitHub Actions | 2000 min/mes |
| Anotaciones | Tabla propia en Supabase | Ilimitado |
| Autenticación | Supabase Auth | 50.000 MAU |
| CI/CD | GitHub Actions | Gratuito |

---

## 📊 Fuentes de datos

| Fuente | Estado | Datos |
|--------|--------|-------|
| **Congreso Open Data** | ✅ | Diputados (CSV/JSON), votaciones (JSON individual), iniciativas, declaraciones de bienes |
| **INE API** | ✅ | IPC, PIB, EPA, deuda. OpenAPI/Swagger. Series desde 2002. |
| **datos.gob.es** | ✅ | 112K datasets del Gobierno. Catálogo de todas las AAPP. |
| **Civio (GitHub)** | ✅ | `presupuesto-pge`: parser open source de PGE. `scraper-ccaa-budget-summaries`. |
| **Portal Transparencia** | ⚠️ | URLs cambiadas. Retribuciones accesibles vía datos.gob.es. |
| **Apispain** | ❌ | Muerto. Sustituir por scraping directo de contrataciondelestado.es. |
| **Senado** | ❓ | Pendiente verificar. |

---

## 🗄️ Modelo de datos

### Tablas principales

| Tabla | Qué almacena |
|-------|-------------|
| `politicians` | Personas con ID del Congreso, nombre, biografía |
| `parties` | Partidos políticos (nombre, acrónimo, color) |
| `legislatures` | Legislaturas I-XV |
| `politician_memberships` | Diputado en cada legislatura (partido, circunscripción) |
| `voting_sessions` | Sesiones de votación (fecha, título, número de expediente) |
| `votes` | Voto individual: Sí/No/Abstención/No vota. UNIQUE por (sesión, diputado) |
| `initiatives` | Iniciativas legislativas (tipo, proponente, trazabilidad UE) |
| `power_relationships` | Cadena de mando: quién controla a quién (líder → portavoz → diputado) |
| `revolving_door` | Puertas giratorias: cargo público → empresa privada |
| `annotations` | Anotaciones de usuarios por entidad |
| `contracts` | Contratos públicos (Fase 2) |
| `budgets` | Presupuestos (Fase 2) |
| `economic_indicators` | Series temporales del INE (Fase 3) |

### Función SQL destacada

`get_divergences()` — detecta votos donde un diputado votó distinto a la mayoría de su grupo parlamentario. Excluye ausencias ("No vota"). Es la base del feed de divergencias.

---

## 📅 Estado actual y roadmap

### ✅ Fase 0+1 — Fundación y políticos (COMPLETADO)

- [x] Monorepo (`web/` + `etl/`), licencia MIT
- [x] Next.js 14 (App Router) + Tailwind + shadcn/ui desplegado en Vercel
- [x] Supabase con schema completo (15 tablas, RLS, pg_trgm)
- [x] 350 diputados activos de la XV Legislatura ingeridos (CSV del Congreso)
- [x] 9 partidos clasificados con colores
- [x] Buscador unificado en home
- [x] Ficha de diputado con: partido, circunscripción, timeline de legislaturas, biografía
- [x] Cadena de mando: 473 relaciones de poder (líder → portavoz → diputado)
- [x] Puertas giratorias: 20 casos documentados (Wikipedia)
- [x] Página de distorsión electoral (D'Hondt, votos por escaño, umbral provincial)
- [x] Sistema de anotaciones propio en Supabase
- [x] Sistema de marca SVG: símbolo, favicon, iconos app, Open Graph y banner GitHub
- [x] CI/CD con GitHub Actions (lint + build + ETL en cron)

### ✅ Fase 4 — Votaciones (COMPLETADO)

- [x] ETL de votaciones: 4.200 votos individuales de la sesión 177 (30 abril 2026)
- [x] Página `/votaciones`: listado de sesiones con badge de divergencias
- [x] Página `/votaciones/[id]`: desglose por partido con barras + divergencias destacadas
- [x] Función SQL `get_divergences()` para detección automática
- [x] Historial de voto individual en ficha de diputado

### 🔜 Fase 2 — Presupuestos y gasto público

- [ ] ETL de Presupuestos Generales del Estado (usando Civio `presupuesto-pge`)
- [ ] Visualización drill-down: ministerio → programa → beneficiario
- [ ] Cada partida enlazada a su responsable político
- [ ] Comparativa presupuestado vs ejecutado

### 🔜 Fase 3 — Indicadores económicos

- [ ] ETL del INE (API JSON verificada) para IPC, PIB, EPA, deuda
- [ ] Páginas con gráficos históricos + explicación sin jerga
- [ ] Vinculación automática entre indicadores

### 🔜 Fase 1 (pendiente) — Dinero

- [ ] Retribuciones de altos cargos (Portal Transparencia vía datos.gob.es)
- [ ] Contratos públicos (contrataciondelestado.es)
- [ ] Cruce automático: firmante de contrato ↔ político
- [ ] Declaraciones de bienes del Congreso

### 🔜 Fase 5 — Comunidad y búsqueda

- [ ] Meilisearch en Oracle Cloud Always Free
- [ ] Búsqueda semántica en frontend
- [ ] Moderación de anotaciones
- [ ] Fotos de diputados

---

## ⚠️ Problemas conocidos

- **Rate-limit del Congreso**: El servidor del Congreso bloquea IPs tras muchas peticiones. Los scrapers usan `curl` con User-Agent. Si fallan con 403, esperar. La web del Congreso es la única fuente bloqueable; INE y datos.gob.es no tienen este problema.
- **Supabase publishable key**: El proyecto usa el formato nuevo de claves (`sb_publishable_...`). Las JWT legacy no funcionan. Para escrituras ETL se usa PostgreSQL directo.
- **CI**: Necesita `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como env vars (son públicas). `DATABASE_URL` como secreto para el ETL.

---

## 🛠️ Guía de contribución

- Revisa los issues etiquetados `good first issue`
- `README.md` explica cómo levantar el proyecto
- Los scrapers van en `etl/` con `PYTHONPATH=src`
- Toda contribución por Pull Request, debe pasar CI (lint + build)
- Leer `AGENTS.md` antes de tocar código — contiene la visión y las reglas

---

*Plan actualizado el 13 de mayo de 2026. Refleja el estado real del proyecto.*
