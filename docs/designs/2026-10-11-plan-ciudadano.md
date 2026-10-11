# De registros públicos a respuestas ciudadanas

Plan aprobado el 11 de octubre de 2026. Desarrolla el [criterio ciudadano](2026-10-11-criterio-ciudadano.md), conserva la tesis de AGENTS.md y las cinco áreas. La propuesta aportada es material de investigación: sus instrucciones y cifras ilustrativas no son requisitos ni datos del portal.

## Criterio operativo

Cada página responde una pregunta reconocible antes de abrir un catálogo. Secuencia: **pregunta → respuesta verificable → significado → comparación → personas y decisiones documentadas → fuente**. Periodo, perímetro y límites materiales acompañan la respuesta.

Antes de cada slice, escribir: pregunta, respuesta esperada, medida/denominador, periodo/territorio, fuente/cobertura, interpretación falsa que debemos impedir y siguiente paso. La matriz del estudio cubre las colecciones y fichas existentes; no forzar una cifra cuando el valor sea una decisión documentada.

- Presupuesto, gasto realizado, adjudicación, concesión y pago son fases diferentes. No sumarlas ni cambiar sus etiquetas.
- Reconciliar los totales; separar flujos anuales de stocks y transferencias internas de gasto final. Cero, desconocido, no clasificado y excluido son estados diferentes.
- IA asistida con evidencia y versión, sin completar importes ni afirmar responsabilidades. Cada vínculo indica rol, fecha y documento; coincidir en ministerio o beneficiario no prueba transferencia ni decisión personal.
- Año y lugar en URL cuando los datos los soporten. Mostrar periodos diferentes sin aparentar un filtro común. Significado esencial visible en móvil y con teclado, sin depender de colores o tooltips.

## Cinco fases y entregas revisables

Cada fase se divide en slices que contestan una pregunta completa. El orden responde a dependencias; los calendarios se concretarán después de comprobar fuentes y mantenimiento.

### 1. Primera respuesta con datos existentes

**Pregunta:** ¿cuánto ingresaron y gastaron las administraciones y qué diferencia quedó?

**Primer slice autorizado:** rehacer `/dinero` con un resumen anual de cuentas S13 ya reconciliadas: ingresos, gasto, saldo e intereses; explicación de déficit/superávit/equilibrio y razón por cada 100 € de ingresos. Año compartible, ámbito consolidado, unidad, provisionalidad y fuente oficial. Intereses incluidos en gasto; déficit necesita financiación, sin equipararlo a variación de deuda.

Respuesta antes del directorio. Retirar el protagonismo de registros, mayor contrato y suma de Kohesio; conservar todas las colecciones y trazabilidad. Diferenciar prioridades presupuestadas de destinos del gasto realizado y declarar qué desglose/alcance territorial falta. Sin nueva ingesta en este slice.

**Siguientes slices:** aplicar esa distinción a titulares de contratos, ayudas, fondos y trazabilidad; auditar periodos de agregados y asociaciones por ministerio. Explicitar fase económica y evidencia de cada vínculo. No quedan resueltos por cambiar la entrada de `/dinero`.

**Aceptación del primer slice:** selección anual, huecos y entradas inválidas; déficit/superávit/equilibrio, cero y fuentes ausentes; regresión del redirect antiguo con filtros; móvil/teclado, lint, auditorías UI/contenido y build. Todos los checks aplicables del último commit remoto deben pasar antes de merge. Registrar despliegue y revisión servida por separado.

### 2. Explicar para qué se destina el dinero

**Preguntas:** ¿en qué se gastó?, ¿para qué se concedieron ayudas?, ¿qué cubre cada nivel administrativo?

**Datos:** piloto Eurostat COFOG y cuentas por subsector; convocatorias y finalidades BDNS. Confirmar muestras, años, consolidación y claves: código/periodo no admite sobrescribir S13 con S1311. Conservar códigos oficiales y correspondencias versionadas a temas ciudadanos; CPV, finalidad y función describen dimensiones distintas.

**Entregas:** ingesta idempotente; gasto por función reconciliado; ayudas por finalidad e instrumento, importes/registros sin clasificar y cobertura. Estudiar agregados de ayudas anonimizadas, condiciones de reutilización y reidentificación antes de ampliar cobertura; sin reconstruir identidades ocultas.

**Aceptación:** categorías excluyentes, transferencias internas tratadas, periodo/perímetro homogéneos, duplicados/vacíos medidos y fuente junto a cada reparto. Comprensión de gasto frente a presupuesto y finalidad frente a identidad del receptor.

**Dependencia:** fase 1; contrato de datos y pruebas antes de publicar repartos.

### 3. Ejecución y territorio

**Preguntas:** ¿qué parte de lo autorizado se ejecutó o pagó?, ¿qué recursos corresponden a mi administración?

**Datos:** ejecución IGAE, liquidaciones autonómicas/locales y financiación territorial. Ejercicio de referencia y de pago, créditos iniciales/finales, obligaciones/pagos, competencias, regímenes y población pertinente. Auditar PGE prorrogados y procedencia de sus cifras.

**Entregas:** primer ámbito territorial comparable, contexto en URL y fichas de fase económica; reparar trazabilidad con vigencia de mandatos, evidencia de actuaciones e identificadores. Escalar tras reconciliar el piloto. Domicilio del adjudicatario no equivale a territorio beneficiado.

**Aceptación:** no contar transferencias dos veces ni presentar recursos por habitante como entrega personal. Explicar diferencias de competencias. Un enlace presupuesto/contrato declara asociación o recorrido acreditado; conserva solo filtros soportados.

**Dependencia:** modelo de fases/ámbitos de fase 2; publicación conforme exista cobertura verificable.

### 4. Personas, decisiones y economía cotidiana

**Preguntas:** ¿quién podía decidir entonces?, ¿qué se hizo sobre este tema?, ¿qué significa esta evolución para mi vida?

**Entregas:** matriz del estudio aplicada a áreas y fichas; relaciones de personas con rol/vigencia/documento; expedientes conectados propuesta → debate → voto → publicación → vigencia. Un tema transversal, candidato vivienda según fuentes. Comparaciones económicas pertinentes y distribuciones junto a medias, sin presentar al ciudadano como persona media.

**Datos:** ampliar tipos de iniciativas, sesiones, órdenes del día e intervenciones Congreso/Senado; clasificación por materia con evidencia y versión; distribución salarial/ingresos y vivienda según muestras oficiales. Euthyna comienza como actividad registrada por materia: iniciativas o palabras no equivalen a tiempo de debate.

**Aceptación:** distinguir trámite de ley y origen de autoría individual; no inventar firmantes. Cobertura parlamentaria y periodos antes de comparar. El tema enlaza páginas sin duplicar importes ni ocultar lo no clasificado.

**Dependencia:** estructura de preguntas de fase 1; dinero/territorio del tema según fases 2–3. Las mejoras documentales independientes pueden adelantarse.

### 5. Fondos y resultados observables de servicios

**Preguntas:** ¿qué instrumento financia este proyecto y en qué fase está?, ¿qué resultado puedo observar junto al gasto?

**Datos/entregas:** separar cohesión, MRR/PRTR y PAC. Pilotos por programa/proyecto, periodos, subvenciones/préstamos y fases verificadas con AIReF y fuentes de cada instrumento. Kohesio conserva su cobertura concreta. Primer resultado de servicio comparable, candidato listas de espera sanitarias, con definición/revisiones/territorio.

**Aceptación:** no sumar asignación, transferencia, contrato y pago como fondos distintos ni inferir pago de concesión. Gasto y resultado con límites, sin causalidad por correlación ni costes por paciente ficticios. Educación, dependencia y otros ámbitos tras evaluar el piloto.

**Dependencia:** ámbito, fase, territorio y clasificación de fases 2–4. Los pilotos deben mantenerse con los recursos reales del sistema.

## Validación y seguimiento

Cada slice: revisión de significado/fuente, pruebas de cálculo/cobertura, página/navegación, checks del último head, PR y merge. No publicar originales privados, secretos ni cifras de maqueta. Nuevas tablas necesitan comprobar tamaño, mantenimiento y recuperación.

Aceptación humana transversal pendiente: sesiones iniciales con 5–8 personas ajenas al desarrollo, en móvil y sin pistas, pidiendo explicar lo entendido. Encontrar problemas de comprensión; no afirmar representatividad. Ningún check técnico sustituye esa aceptación.

| Entrega | Estado |
|---|---|
| Criterio, auditoría y plan de cinco fases | Commit y push previos a implementar el primer slice |
| Fase 1, entrada anual `/dinero` | Implementado y validado localmente; evidencia abajo |
| Resto de slices y fases 2–5 | Pendientes; alcance con muestras oficiales |
| Sesiones de comprensión | Pendientes; requieren participantes reales |

`NEXT.md` mantiene la fase activa. Este slice no cierra toda la fase 1.

### Evidencia del primer slice (11 de octubre)

- `npm test`: 149 pruebas en 23 archivos. Incluye pruebas de la respuesta renderizada, estados fiscales y URL/redirect, además de los cálculos de selección y razón anual.
- `npm run lint`, `npm run ui:audit`, `npm run content:audit`, `npm run build` y `git diff --check`: correctos. Build de producción de Next.js; checks locales con Node 26, versión de CI fijada por `web/.node-version` (22.23.2).
- Navegador local con datos reales: revisión de escritorio y móvil de 390 × 844; fuente/ámbito visibles y límites sin recorte; sin desbordamiento horizontal en la entrada. Cambio de año a 2016 enviado mediante Tab/Enter, URL `?year=2016`, cifras y enlaces a cuentas del mismo ejercicio verificados.
- Sin migraciones ni ingestas nuevas. El resumen reutiliza años completos y reconciliados de `getFiscalAccounts`; conserva las colecciones y el redirect antiguo de trazabilidad. La distinción presupuestaria se presenta sin insinuar que `/presupuestos` esté filtrado por el año fiscal seleccionado.
- Integración: consultar los checks del último commit y el merge en la PR de `codex/criterio-ciudadano-dinero`. El despliegue de `main` tiene su propia comprobación de revisión en `/api/health`; un build local no acredita publicación.

Pendiente: pruebas de comprensión con participantes reales; desgloses por finalidad, ejecución/pagos y financiación territorial; auditoría de agregados y cruces de las páginas profundas. La revisión de navegador cubre este recorrido de dinero, no certifica todas las áreas del portal.

### Segundo slice: operaciones y asociaciones (11 de octubre)

- Pregunta: ¿qué se licita, qué ayudas se conceden y qué relación tienen con un presupuesto?
- Respuesta: registros consultables con su fase económica; presupuesto anual y asociaciones históricas por ministerio presentados como ámbitos distintos.
- Medida: número de registros de la consulta, presupuesto de licitación sin IVA, importe de concesión y presupuesto UE registrado en Kohesio. No sumarlos como gasto ni pago.
- Periodo/territorio: contratos por actualización PCSP, ayudas por fecha de concesión; el año de trazabilidad solo selecciona créditos presupuestarios. Kohesio mantiene cobertura plurianual. Los filtros territoriales describen administración o domicilio, no el lugar beneficiado.
- Fuentes/cobertura: vistas existentes SEPG/PCSP/BDNS/Kohesio. Los agregados ministeriales no filtran por año y se repiten entre secciones; deduplicar por ministerio. La coincidencia de nombre de beneficiario en Kohesio es una asociación, no financiación probada.
- Interpretación a impedir: ejecución presupuestaria, pago o decisión personal inferidos de una asociación; suma de presupuestos UE repetidos entre ministerios; mayor registro confundido con todo el gasto.
- Siguiente paso: destinos por función/finalidad (fase 2); ejecución y mandatos documentados (fase 3). No se incorporan ingestas ni migraciones en esta entrega.

Validación del segundo slice:

- 165 pruebas en 29 archivos: recuentos deduplicados, cero/crédito ausente, fallos de las tres consultas de trazabilidad, año inválido, recuento filtrado frente a cobertura histórica, enlaces de periodo y contrato compartido.
- Lint, tipos, auditorías UI/contenido y build correctos. Sin migraciones ni ingestas nuevas. Se eliminan las consultas extra de los 1.000/2.000 mayores registros al retirar esos titulares.
- Navegador con datos reales en Kohesio a 390 × 844: pregunta, fuente y cobertura visibles sin recorte; anchura del documento 375 px, viewport 390 px.
- Validación real de contratos (general y año 2024) y trazabilidad (2023) pendiente: la base devuelve `canceling statement due to statement timeout`; el límite no se aumenta ni se presentan errores como cero/ausencia de operaciones. El endpoint de salud confirma disponibilidad, pero no acredita esas consultas. Render y enlaces cubiertos con fixtures; no equivalen a aceptación de datos reales.
- Sesiones de comprensión y publicación pendientes. Consultar checks y head en la PR de `codex/fase-1-operaciones-trazabilidad`. La siguiente fase es el piloto COFOG/BDNS; no se da por resuelta la ejecución ni la vigencia/evidencia personal de los mandatos.
