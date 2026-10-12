# Auditoría de la matriz ciudadana: áreas, colecciones y fichas

Trabajo en curso; no acredita cierre del plan. Referencia: sección 7 del [criterio ciudadano](2026-10-11-criterio-ciudadano.md) y entregas del [plan](2026-10-11-plan-ciudadano.md). La auditoría incluye todas las filas, los cinco accesos de área, búsqueda, estado de datos y páginas auxiliares. Una fuente ausente o evidencia indirecta no cuenta como requisito completado.

Para cada fila: pregunta/primera respuesta, medida y comparación, fecha y ámbito, personas con rol/documento/vigencia, fuente y límites, filtros/enlaces, estados vacío/error, móvil/teclado. Registrar archivo y comportamiento comprobado, reparación y checks del commit. Los contratos de pilotos complementan esta revisión; no prueban por sí solos todas las fichas.

## Primer bloque: Personas y Decisiones

- Pregunta Personas: ¿quién ocupa el cargo competente y dónde puedo comprobar su mandato? La entrada actual presenta directorio y recuentos; no acredita competencia específica de cada persona mediante el mero nombre del departamento.
- Respuesta prevista: cargos y mandatos documentados, fecha de inicio y fuente cuando consten; acceso a representación territorial y al recorrido temático de vivienda. Nombramiento, competencia y firma son evidencias diferentes. Los filtros de cada colección conservan su propio alcance.
- Pregunta Decisiones: ¿qué actuaciones se registran sobre vivienda y cómo se comprueba su fase? La entrada actual es un directorio. El piloto de actividad y sus documentos ya existe: llevar la primera respuesta antes del catálogo, con periodo y cobertura, sin equiparar iniciativa o intervención a ley vigente.
- Fuente: fuentes y fechas del modelo actual de mandatos y piloto parlamentario; no inventar datos de actuaciones personales. Un recuento del directorio no mide trabajo, honestidad ni efectos sobre precios.
- Aceptación: respuesta antes del directorio, enlaces a evidencia/persona/tema, cero y consulta fallida diferenciados, contexto de periodo, móvil y teclado. No presentar una selección de mandatos como todo el Gobierno si no se prueba el perímetro.

## Estado por ámbito

| Ámbito | Evidencia inspeccionada | Resultado actual |
|---|---|---|
| Personas | `web/src/app/personas/page.tsx`, `ThreadLanding.tsx`, `data/gobierno.ts` | Primera respuesta implementada antes del directorio: puesto, persona, inicio registrado, documento concreto o ausencia explícita. No valida por sí sola competencias ni vigencia de toda la fuente |
| Decisiones | `web/src/app/decisiones/page.tsx`, tema vivienda | Primera respuesta implementada sobre vivienda, sesiones por año, fase, documentos y alcance; filtro propio conserva año al entrar en tema |
| Contratos | Página, lector y schema CPV/adjudicación | Pregunta y fase visibles, pero objeto por CPV y competencia agregada aún sin primera respuesta; identidad oficial, lotes, resultados y monedas reparados en [bloque de contratos](2026-10-12-identidad-contratos.md); primera respuesta agregada y cobertura pendientes |
| Territorio | `web/src/app/territorio/page.tsx`, `TerritoryAtlas`, `TerritorySpendingGrid` | Enlaces a liquidaciones y financiación con ámbito propio. Reparado: el atlas ya no ofrece «Ambas» (sumaba presupuesto de licitación e importe concedido) ni se titula «Mapa del gasto»; la rejilla local muestra concedido y licitado por separado; los parámetros de URL no válidos se nombran en un aviso en vez de sustituirse en silencio; el importe por habitante se explica como cociente, no dinero recibido por persona |
| Economía | `web/src/app/economia/page.tsx`, `PurchasingPowerAnswer` | Primera respuesta antes de los indicadores: variación del salario medio bruto (EAES) frente a la variación de la media anual del IPC, por año y acumulada desde el primer año común (2008), con año en URL. Comprobado con datos servidos: 2024, salario +5,31 %, precios +2,77 %; 2022, +4,06 % frente a +8,39 %. Limita la lectura: media y composición del empleo, bruto, cesta media, sin causalidad política |
| Subvenciones/finalidades | Estudio BDNS y PR #80 | Se repara la afirmación de organizaciones verificadas y se documenta cobertura excluida. Fuente parcial no permite prometer todas las ayudas a hogares |
| Resto de matriz | Aún no auditado en este documento | Pendiente de inspección y reparación; no se considera completado |

## Separación de aceptación

Los checks técnicos, renders y consultas prueban su ámbito concreto. Las sesiones de comprensión con 5–8 personas reales siguen pendientes; no se sustituirán por opiniones de agentes o pruebas sintéticas. Despliegue y frescura se verificarán por revisión servida y estado real de pipelines, por separado del merge.

## Evidencia del primer bloque

La vista `v_gobierno_actual` incluye puestos estatales del Gobierno identificado por el registro, con `start_date <= current_date` y `end_date IS NULL`. Ese criterio no demuestra que todos los ceses reales estén actualizados. La entrada usa nombres y fuentes existentes sin afirmar que un puesto firme todas las operaciones asociadas. El lector de mandatos tiene plazo de consulta de cinco segundos; error y ausencia son distintos.

Inspección local con lectura de datos públicos: 23 registros de puesto, con fuentes concretas en parte del corpus; tres enlaces apuntan a la portada genérica del BOE. Esa portada ya no se etiqueta como documento del mandato. Se muestran fechas registradas, sin declarar verificación legal de cada fecha. Reparar las fuentes y actualizar los mandatos sigue pendiente en la auditoría transversal.

Decisiones usa la misma consulta reconciliada que vivienda. En 2024 hay 510 intervenciones y 35 registros de votación seleccionados entre 16.842 registros publicados; en 2025, 492 y 30 entre 15.781. Los tres registros recientes son muestra visible de la selección, no tres medidas distintas ni tres leyes. El enlace al tema conserva año y permite consultar el resto y sus personas.

Se detectó en navegador un fallo temporal guardado en caché para 2025. Una lectura independiente de las 522 filas y su metadata pasó el validador. Se mueve la captura del error fuera de la caché, con prueba que simula fracaso, recuperación y conservación de caché exitosa. El error no se disfraza de cero ni se guarda durante una hora.

Revisión móvil 390×844 con datos consultados, sin fixtures temporales: cliente/contenido 375/375 px; mandatos y fuentes legibles, actuaciones antes del directorio, selección 2024→2025→2024 enviada con Enter mantiene URL y cifras verificadas. No acredita comprensión humana. Las pestañas temporales y el servidor de desarrollo se cerraron antes del build final.

Checks finales locales: 329 pruebas web pasan, TypeScript, lint y build pasan; auditoría UI 487 archivos y contenido 402 archivos, 29/29 indicadores. CI remoto pendiente antes del merge. El resto de filas sigue abierto; estas dos entradas no completan la fase 4.
