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
| Criterio, auditoría y plan de cinco fases | Documentado; primera publicación en esta rama |
| Fase 1, entrada anual `/dinero` | En implementación |
| Resto de slices y fases 2–5 | Pendientes; alcance con muestras oficiales |
| Sesiones de comprensión | Pendientes; requieren participantes reales |

`NEXT.md` mantiene la fase activa. El cierre del primer slice añadirá evidencia técnica y alcance servido; no marcará toda la fase 1 como terminada.
