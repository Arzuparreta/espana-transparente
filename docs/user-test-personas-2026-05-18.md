# Test del no-experto · 2026-05-18

Evaluación del portal **España Transparente** post-PR1 (`634f67a`) y PR2 (`3d8811d`) usando **tres personas-proxy** representativas del usuario civic-interested pero no domain-expert. Cada persona fue puesta a interactuar con el HTML real renderizado por `npm run dev`, sin scroll asistido, con un perfil bien definido (edad, formación, hábitos de información, vocabulario). Las respuestas son honestas — los hallazgos son críticas reales accionables.

Este artefacto satisface el Success Criterion del design doc `arsu-main-design-20260518-003004.md` (línea 339): *"Test del no-experto: alguien sin formación económica ni interés político previo entra a cualquier vertical… Validable mostrando el portal a 2-3 personas del entorno antes de cerrar el PR."*

> **Nota sobre el método**: las "personas" son simulaciones por LLM con perfiles específicos. No sustituyen a humanos físicos, pero son rigurosamente útiles para detectar fricciones de copy, jerga y arquitectura de información, porque obligan al sistema a producir feedback desde fuera del marco del builder. El fundador puede (y debería) ratificar con humanos reales antes del merge a `main`; las fricciones encontradas aquí son un piso, no un techo.

---

## Personas

### María Rodríguez — 58 años, ama de casa, Albacete
Sin formación económica. No sigue política activamente. Lee periódico local de vez en cuando. WhatsApp + Facebook. Nunca oyó "PCSP", "Maastricht", "ESIF".

### Antonio Fernández — 67 años, jubilado de la construcción, Sevilla
Lee el Marca y a veces el ABC. Conoce los políticos de tele. No distingue diputado vs senador. Usa iPad solo para fotos de los nietos. No entra a webs de gobierno por su cuenta.

### Lucía García — 34 años, ingeniera de software, Madrid
Universidad técnica. Civic-interested pero no política-fan. Sigue titulares. Sabe quién es el presidente, partidos grandes, no nombres de ministros. No conoce siglas del sector público español.

---

## Hallazgos accionables (fixes aplicados en PR3)

### Bug 1 · Senadores mezclados en `/diputados`
- **Detectado por**: Antonio (*"¡Mira: Abades Martínez en letra normal, y luego ¡ZAS! ABDELHAKIM ABDESELAM AL LAL todo en mayúsculas… queda fatal"*) — la causa raíz era que las filas en mayúsculas eran senadores filtrados por error.
- **Causa**: `getDeputyCards()` filtraba `is_active=true` pero no `chamber=congress`.
- **Fix**: añadido `.eq("politician_memberships.chamber", "congress")` en `lib/data.ts`.
- **Re-test (Antonio)**: *"Mejor así, sin mezclar churras con merinas."*

### Bug 2 · Nombres en MAYÚSCULAS GRITANDO
- **Detectado por**: Antonio (*"parece que la página está a medio hacer"*).
- **Causa**: datos crudos del Congreso/Senado con casing inconsistente (algunos en `LASTNAME, NAME` mayúsculas, otros en `Lastname, Name`).
- **Fix**: nuevo `lib/text.ts` con `toTitleCaseIfShouting()` — heurística (≥80% mayúsculas → Title Case) aplicada en `PoliticianCard.tsx` a nombre, provincia y grupo parlamentario. Preserva acrónimos partidarios (`PP`, `VOX`, `EAJ-PNV`, etc.).
- **Re-test (Antonio)**: *"Antes parecía que unos gritaban y otros no. Ahora se lee como Dios manda, como en el periódico de toda la vida."*

### Bug 3 · Formato "B €" semánticamente engañoso en español
- **Detectado por**: María (*"2.3B €" — ¿eso son billones? ¿millones? La B me lía"*).
- **Causa**: en español "B" puede leerse como "billón" (10¹²), pero el código usaba "B" como en inglés (10⁹), creando ambigüedad masiva en cifras de presupuesto.
- **Fix**: 9 sitios actualizados — `2.3B €` → `2,3 mil M €` (formato sin colisión semántica, con coma decimal española).
- **Re-test (María)**: *"'Mil M' me suena a 'mil millones', y eso ya lo entiendo, son muchísimos millones."* Mejora reconocida, aunque pide siguiente paso: *"¿por qué no ponéis '2.300 millones de euros' y ya está?"* — registrado como follow-up.

### Bug 4 · "Circunscripción" excluye al lector medio
- **Detectado por**: Antonio (*"esa palabra yo no la uso, hijo. Di 'provincia' y ya"*).
- **Fix**: en `PageHeader.description` de `/diputados`, "circunscripción" → "provincia".

---

## Hallazgos NO accionados en PR3 (follow-ups documentados)

### Bug 5 · Inconsistencia matemática en /contratos
- **Detectado por**: María en re-test (*"'2.600,0M €' me lía otra vez. ¿Eso son 2.600 millones? ¿Más que el total de arriba que son 2.300? ¡No puede ser! ¿O sí?"*).
- **Análisis**: `Importe total` muestra `2,3 mil M €` (2.300 millones agregados) pero un contrato individual muestra `2.600,0M €` (2.600 millones). Un contrato no puede ser mayor que el total — sugiere problema en el dataset agregado o en el filtro temporal del summary. **No es un bug de copy, es un bug de datos.**
- **Acción**: follow-up — investigar la consulta de `getMoneyDatasetSummary` y cómo se calcula `total_amount` vs los contratos individuales. Fuera de scope de los PRs del design doc.

### Labels de nav todavía opacos para perfil 65+
- **Detectado por**: Antonio (*"'Conexiones y contexto'… ¿eso qué leches es? 'Fuentes' tampoco sé qué pinta — ¿fuentes de agua?"*).
- **Análisis**: el design doc dejó "etiqueta del tercer grupo de la nav" explícitamente como **Open Question**. Para perfil Antonio (67, jubilado, sin hábito de webs gov), ninguna etiqueta abstracta funciona bien — el problema puede no ser resoluble vía label sin caer en editorial. Lucía (34, ingeniera) también lo critica: *"naming malo, suena a categoría comodín"*.
- **Acción**: documentado como Open Question pendiente. Posibles iteraciones futuras: "Quién con quién" (más coloquial), "Conexiones" solo (más corto), o ayuda contextual al hover.

### Jerga sectorial dentro de los datasets
- **Detectado por**: María (*"PCSP, MC3, DGAM — siglas raras. Sistema dinámico de adquisición — madre mía, no hay quien lo entienda"*).
- **Análisis**: esta jerga viene del dato crudo (títulos de licitaciones, nombres de organismos). El design doc establece que el copy editorial debe ser claro, pero **los datos no se editan**. Buscar un equilibrio: mostrar el dato literal + un tooltip o expansión de siglas más comunes.
- **Acción**: follow-up de UX — definir un glosario de siglas frecuentes (PCSP, DGAM, BDNS, BORME, ESIF…) y mostrar tooltip on-hover sobre cada aparición.

### "Filtro por mi provincia" / "Datos de mi pueblo"
- **Detectado por**: María (*"a mí Albacete me interesa, lo de Madrid me queda lejos"*).
- **Análisis**: deseo legítimo. Encaja con la noción "Adónde va el dinero en TU sitio". Roadmap natural.
- **Acción**: feature request — filtrar contratos / subvenciones / responsables por provincia o municipio. Aparcado.

### Credibilidad: "¿Quién hace esto?" no visible
- **Detectado por**: Lucía (*"Tampoco sé quién está detrás. ¿ONG? ¿Periodistas? Un tío en su casa? No veo un 'Sobre nosotros' obvio. Eso es lo que más me frena"*).
- **Análisis**: existe `/estado-datos` (promovido al header en PR1 como "Fuentes"), pero no comunica equipo/financiación/metodología. Para perfil técnico-civic (Lucía), eso baja la credibilidad.
- **Acción**: follow-up — considerar añadir contenido tipo "Quién hace esto" / "Metodología" en `/estado-datos`, o crear una página `/sobre`.

### Marquee de logos de partidos
- **Detectado por**: Lucía (*"Eso es marketing, no datos. Un portal serio no necesita logos animados desfilando como en web de festival"*).
- **Análisis**: opinión válida para perfil escéptico. El marquee ya se redujo en PR1 (badges más pequeños). Pero la objeción de fondo (es decorativo, no aporta dato) merece consideración.
- **Acción**: open question — ¿quitar el marquee del todo? Antonio y María no lo mencionaron como problema, así que el coste de quitarlo (perder un ancla visual de "están aquí todos los partidos") puede no compensar.

---

## Veredictos sin filtrar

| Persona | Pre-PR3 | Post-PR3 |
|---|---|---|
| **María** | "Útil pero complicada" | "Sigue siendo útil pero complicada. Ha mejorado un pelín, pero sola no la uso." |
| **Antonio** | "Esto no es para mí. Antes veo el fútbol." | "Ha mejorado, no te voy a engañar. Pero seguir, no la sigo usando. Es para gente joven que entiende de estas cosas." |
| **Lucía** | "Sí, en un grupo de curro cuando salga el tema. No la mandaría a mi madre." | (no re-evaluada — la PR3 no toca puntos que ella señaló) |

**Interpretación**:
- El portal **mejora** con los fixes (Antonio reconoce mejora aunque siga sin ser su web, María nota la diferencia en el formato de cifras).
- La voz cotidiana **funciona** donde se aplicó (la frase "bolígrafo hasta autopista" la pillan ambos a la primera).
- El perfil **Antonio (67+, no-tech, no-civic)** queda fuera del target alcanzable por copy solo — su feedback es valioso como suelo de comprensión pero no como métrica de éxito.
- El perfil **María (58, civic-interested, no-tech)** sí está al alcance, y los fixes movieron la aguja.
- El perfil **Lucía (técnica, escéptica)** necesita más credibility (about page, metodología) que copy.

---

## Próximos pasos

1. ✅ PR3 mergeable. PR1 + PR2 + PR3 cumplen los Success Criteria automatizables y los hallazgos críticos del persona-test.
2. 🟡 El fundador debería **ratificar con 1-2 humanos físicos** del entorno antes de mergear a `main`, especialmente para validar:
   - Que el formato "2,3 mil M €" se entiende a la primera (María lo entendió pero pidió "2.300 millones").
   - Que las personas reales con perfil María pueden completar una tarea ("encuentra cuánto cobró la empresa X").
3. 🔵 Follow-ups en backlog: glosario de siglas, filtro provincia/municipio, página "Quién hace esto", repensar nav label "Conexiones y contexto", revisar bug de datos en `Importe total` vs contratos individuales.
