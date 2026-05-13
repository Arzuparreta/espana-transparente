# 🜁 Acción Humana

> *“El Estado no existe fuera de las personas que lo conforman.”*  
> **Acción Humana** es una máquina de transparencia radical, políticamente agnóstica, que traduce los datos públicos al lenguaje del ciudadano y expone la maquinaria estatal sin un solo marco ideológico.  
> El sitio es completamente *open source*, se despliega con coste cero y está diseñado para que cualquier persona pueda entender, navegar y anotar la realidad política y económica de España sin los filtros de los medios.

---

## 🧭 Visión y principios

- **Agnosticismo político**: No defendemos ningún partido, ni siquiera los que dicen ser liberales. Solo mostramos datos objetivos y relaciones entre ellos.
- **Ingeniería inversa narrativa**: El Estado produce cifras enrevesadas (prima de riesgo, IPC subyacente, déficit estructural…). Nosotros explicamos qué significan realmente y cómo leerlas sin trampas.
- **Transparencia radical**: Cada euro público, cada sueldo, cada contrato, cada voto estará enlazado a las personas que lo deciden.
- **Colaboración abierta**: Los usuarios podrán añadir anotaciones (estilo *hypothes.is*) que enriquezcan el contexto, sin adulterar los datos oficiales.
- **Coste cero y soberanía tecnológica**: Todo el stack se ejecuta en planes gratuitos (Vercel, Supabase, GitHub Actions) y cualquier persona puede levantar su propia instancia.

---

## 🏛️ Arquitectura

| Componente          | Tecnología                         | Plan gratuito              |
|---------------------|------------------------------------|----------------------------|
| Frontend            | Next.js 14 (App Router) + Tailwind + shadcn/ui | Vercel Hobby           |
| Backend/API         | Next.js API Routes, edge functions | Incluido                   |
| Base de datos       | Supabase (PostgreSQL)              | 500 MB, 2 proyectos        |
| Autenticación       | Supabase Auth (GitHub, email)      | 50.000 MAU                 |
| Almacenamiento      | Supabase Storage                   | 1 GB                       |
| ETL / Scraping      | Python (httpx, BeautifulSoup, pandas) + GitHub Actions | 2000 min/mes   |
| Búsqueda semántica  | Meilisearch en Oracle Cloud Always Free (4 vCPU ARM, 24 GB) | 0 €           |
| Anotaciones         | Hypothesis (embebido) o tabla propia en Supabase | 0 €                 |
| Gráficos            | Recharts / Observable Plot         | Open source                |
| CI/CD               | GitHub Actions                     | Gratuito                   |

---

## 🗓️ Fases de desarrollo

### Fase 0 – Fundación (2 semanas)

**Objetivo**: Repositorio público, esqueleto de la aplicación y base de datos vacía desplegada.

**Tareas**:

- [ ] Crear monorepo en GitHub: `accion-humana/web` y `accion-humana/etl`, licencia MIT.
- [ ] Inicializar Next.js (App Router) con Tailwind y shadcn/ui.
- [ ] Configurar Supabase: crear tablas base (`politicians`, `parties`, `coalitions`).
- [ ] Conectar Supabase desde Next.js (usando `@supabase/supabase-js`).
- [ ] Desplegar en Vercel y verificar que el pipeline CI/CD funciona.
- [ ] Añadir Hypothesis como script externo, comprobando que se puede activar/desactivar un botón de “Anotaciones”.
- [ ] Redactar `README.md` atractivo llamando a colaboradores.
- [ ] Diseñar el logo (A dentro de H, en círculo, guiño al símbolo anarquista) en SVG y añadirlo al layout.

---

### Fase 1 – Políticos y dinero (4-6 semanas)

**Objetivo**: La base de datos de actores políticos y sus remuneraciones. Primer gran atractivo.

**Fuentes de datos**:

- Portal de Transparencia (retribuciones altos cargos): CSV en `transparencia.gob.es`
- Congreso de los Diputados: datos abiertos de diputados y declaraciones de bienes.
- Senado (similar).
- Parlamentos autonómicos (priorizar los más poblados: Andalucía, Cataluña, Madrid, C. Valenciana).
- Apispain (contratos públicos y subvenciones) – API unificada con buscador semántico.

**ETL (scripts en Python)**:

- Descarga diaria de CSVs y APIs.
- Normalización de nombres (usar `thefuzz` para fuzzy matching).
- Cruce automático: si un contrato lo firma “María Pérez”, buscar si es un político con cargo y linkar.
- Insertar en Supabase.

**Frontend**:

- [ ] Página de inicio con buscador unificado.
- [ ] Ficha de político: foto, partido, cargos (timeline), retribuciones (tabla y gráfico), contratos que ha firmado, declaración de bienes.
- [ ] Navegación rizomática: de un contrato al firmante, al partido, a la partida presupuestaria (cuando exista).
- [ ] Capa de traducción: tooltips que expliquen qué es una “dieta”, “complemento específico”, “declaración de bienes” (con link a la ley).
- [ ] Botón de “Anotaciones” en cada ficha, cargando Hypothesis.
- [ ] Gráfico comparativo: sueldo vs. salario medio en España.

---

### Fase 2 – Presupuestos y gasto público (4 semanas)

**Objetivo**: Visualizar el dinero desde los PGE hasta la ejecución real, enlazando con los políticos de la Fase 1.

**Fuentes**:

- Presupuestos Generales del Estado (datos.gob.es).
- Ejecución presupuestaria (liquidación).
- Civio “Donde van mis impuestos” tiene parser open source (reutilizable).
- Apispain para subvenciones (BDNS).

**Tareas**:

- [ ] ETL que procese presupuestos anuales y ejecución real por partida.
- [ ] Visualización interactiva de gasto: drill-down por ministerio, programa, beneficiario.
- [ ] Cada partida enlazada a su responsable político.
- [ ] “Traducción” de conceptos presupuestarios (ej: “transferencias corrientes”).
- [ ] Página de comparativa: presupuestado vs. ejecutado, con alertas de desviaciones.

---

### Fase 3 – Indicadores económicos con antídoto (3 semanas)

**Objetivo**: Mostrar los grandes números del telediario (IPC, PIB, prima de riesgo) y destripar su significado real.

**Fuentes**:

- INE (API: IPC, PIB, EPA, etc.)
- Banco de España / Tesoro Público (deuda, prima de riesgo)
- Eurostat (comparativas europeas).

**Tareas**:

- [ ] ETL que recolecte series temporales diarias/mensuales.
- [ ] Página por indicador con:
  - Gráfico histórico interactivo.
  - Apartado “¿Qué significa realmente?” (definición clara, cita de economistas).
  - Apartado “¿Cómo se manipula?” (cambios de base, ejemplos históricos).
  - Vinculación automática: si sube la deuda → link a presupuestos; si baja el paro → link a EPA y tasa de temporalidad.
- [ ] Anotaciones colaborativas habilitadas para que la comunidad pueda añadir contexto (ej: “Este IPC no incluye la vivienda en alquiler”).

---

### Fase 4 – Votaciones y promesas (3 semanas)

**Objetivo**: Seguimiento de la actividad parlamentaria y cumplimiento de programas electorales.

**Fuentes**:

- Datos abiertos del Congreso (votaciones).
- Proyecto ActionCheck (promesas electorales) – open source, se puede integrar.

**Tareas**:

- [ ] ETL para votaciones por diputado.
- [ ] Ficha de diputado enriquecida con su historial de voto.
- [ ] Matriz de voto por partido y por ley.
- [ ] Comparador de promesas vs. acciones (cruce con votaciones y presupuestos).

---

### Fase 5 – Comunidad y búsqueda avanzada (continuo)

**Objetivo**: Búsqueda semántica ultrarrápida, anotaciones personalizadas y contribuciones de la comunidad.

**Tareas**:

- [ ] Desplegar Meilisearch en Oracle Cloud e indexar todas las entidades (políticos, contratos, partidas…).
- [ ] Implementar búsqueda instantánea en el frontend.
- [ ] Sistema de anotaciones propio (si Hypothesis no es suficiente) guardando en Supabase, con posibilidad de reportar “pistas” (nuevas fuentes) que los mantenedores puedan integrar.
- [ ] Ranking de entidades más anotadas/comentadas (sin convertirlo en un foro caótico).

---

## 🛠️ Guía de contribución (para colaboradores externos)

- Revisa los issues etiquetados `good first issue`.
- El `README.md` incluye cómo levantar el proyecto localmente con `docker-compose` (opcional) o manualmente con Node.js y Python.
- Los scrapers deben ir en `etl/` con su propio `README` y fichero de dependencias.
- Toda contribución se hace mediante Pull Request y debe pasar los checks de CI (lint, formato, tests básicos).

---

## 📅 Roadmap resumido

| Fase | Nombre                | Entregable principal                        | Semanas |
|------|-----------------------|---------------------------------------------|---------|
| 0    | Fundación             | Repo, esqueleto, despliegue                 | 2       |
| 1    | Políticos y dinero    | Fichas de cargos + retribuciones + contratos| 4-6     |
| 2    | Presupuestos y gasto  | Visualización del gasto público enlazada    | 4       |
| 3    | Indicadores económicos| Páginas con “antídoto” de IPC, deuda, etc.  | 3       |
| 4    | Votaciones y promesas | Seguimiento parlamentario                   | 3       |
| 5    | Comunidad y búsqueda  | Meilisearch, anotaciones propias, feedback  | continuo|

---

## ⚖️ Nota sobre la neutralidad

**Acción Humana** no editorializa. Cada “traducción” estará basada en definiciones técnicas de economistas y juristas de todas las escuelas. Las anotaciones de los usuarios son un espacio independiente y moderado solo contra spam. El código fuente abierto garantiza que cualquiera pueda auditar cómo se procesan los datos.

---

*Plan iniciado el 13 de mayo de 2026. Este documento evolucionará con el proyecto.*
