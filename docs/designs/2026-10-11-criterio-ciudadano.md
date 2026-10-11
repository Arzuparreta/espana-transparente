# Criterio ciudadano para presentar los datos de España Transparente

Estudio del 11 de octubre de 2026. Criterio adoptado y [plan de aplicación aprobado](2026-10-11-plan-ciudadano.md). Se apoya en la propuesta recibida de Pilar, su correo del 6 de octubre, la respuesta del 11 de octubre, el código actual y fuentes oficiales consultadas para comprobar los conceptos financieros. Las cifras de sus maquetas son ilustrativas y no se incorporan como datos.

## 1. La aportación que conviene convertir en criterio de producto

La propuesta identifica una tarea que el portal todavía deja al visitante: transformar registros dispersos en una respuesta comprensible. Reunirlos permite investigar, pero una persona sin conocimiento administrativo necesita además saber qué está viendo, por qué le importa y qué puede concluir de ello.

Pilar aporta una mirada ciudadana concreta: llega con una inquietud, espera una primera respuesta y necesita una explicación que le permita fiscalizar. Su idea de Euthyna —entender la actividad del Congreso por materia y a lo largo de la legislatura— confirma que ese criterio va más allá del dinero. La materia y el significado de la actividad son anteriores al catálogo de expedientes.

La recomendación es aplicar esta secuencia a todas las áreas:

**Pregunta reconocible → respuesta respaldada → explicación de su significado → comparación pertinente → personas y decisiones documentadas → evidencia.**

El ciudadano debe poder detenerse después de la primera respuesta y haber aprendido algo correcto. Quien quiera profundizar debe llegar al dato original conservando el tema, periodo, territorio y entidad que estaba consultando.

La lectura de diez segundos sirve como objetivo de orientación: reconocer la pregunta, entender una conclusión y encontrar el siguiente paso. No permite prometer que alguien comprenderá toda la financiación pública en diez segundos.

Este feedback es evidencia de una necesidad y una hipótesis de diseño valiosa. No acredita todavía qué quiere toda la ciudadanía. Las preguntas propuestas en este estudio deben contrastarse con personas ajenas al proyecto.

## 2. Qué recoge la propuesta y qué interpretación adoptamos

| Propuesta recibida | Criterio que aporta | Aplicación recomendada |
|---|---|---|
| Un titular con una cifra | La página debe contestar algo antes de pedir que explores | Primera respuesta contextualizada; en una ficha puede ser una decisión o situación documentada, sin forzar una cifra |
| Tres pasos para seguir el dinero | El orden debe reproducir el razonamiento del visitante | Recorridos de pocas preguntas por área; cada paso debe resolver una duda distinta |
| Año común | El contexto debe acompañar todo el recorrido | Selección conservada en la URL; cada módulo explicita el periodo que realmente cubre |
| Estado y comunidades diferenciados | El ciudadano debe poder atribuir responsabilidades | Perímetro y administración visibles; permitir un total consolidado correctamente identificado |
| Subvenciones por destino | La web debe hacer el trabajo de síntesis | Finalidades comprensibles antes de listas de beneficiarios; detalle accesible para seguir el dinero |
| Familias de fondos europeos | Instrumentos distintos requieren explicaciones distintas | Separar MRR, cohesión y PAC, sus periodos, fases y unidades |
| Explicaciones al tocar o pasar el cursor | La jerga no debe exigir conocimientos previos | Significado esencial visible; ampliaciones por toque, teclado y cursor |
| Sin clasificar visible | La transparencia incluye lo que falta | Cuantificar importes y registros sin clasificar, sin importe o fuera de cobertura, como conceptos diferentes |
| Contratos fuera de la pantalla principal provisionalmente | Un acceso necesita una pregunta ciudadana | Reubicar según su utilidad; conservar la pregunta sobre qué se compra y a quién se adjudica |
| Fuentes y límites junto a las cifras | La síntesis debe seguir siendo comprobable | Fuente, medida, periodo y límite material cerca del titular y también en lo compartido |

La tesis vigente de AGENTS.md permanece como marco: personas concretas, cadena fiscal defendible y afirmaciones verificables. La neutralidad política que propone el documento no sustituye esa decisión. Su cuidado de evitar señalar a personas se traduce en no inducir imputaciones que los datos no sostienen; presentar responsabilidades documentadas sigue siendo parte del producto.

Ordenar por finalidad y permitir después ver quién concede y recibe concilia comprensión y rendición de cuentas. Eliminar esos nombres del detalle impediría parte de la fiscalización que el proyecto persigue. Tampoco adoptamos una prohibición general de comparar: proponemos comparación contextualizada, sin convertir automáticamente un orden numérico en un juicio sobre buena o mala gestión.

## 3. Ajustes necesarios a las maquetas financieras

### Perímetro del Estado y Seguridad Social

El ETL fiscal actual consulta S13, el conjunto de administraciones públicas. La propuesta solicita Administración central, S1311. Seguridad Social tiene su propio subsector, S1314. No podemos cambiar la etiqueta del dato S13 a Estado ni presentar S1311 como si incluyera todas las pensiones y cotizaciones. Los PGE también tienen un perímetro propio que debe identificarse. [Eurostat, metodología de cuentas públicas](https://ec.europa.eu/eurostat/cache/metadata/en/gov_10a_main_esms.htm).

Recomendación: abrir con el panorama consolidado de todas las administraciones y permitir examinar Administración central, comunidades, entidades locales y Seguridad Social. El total consolidado elimina determinados flujos internos; no se obtiene sumando indiscriminadamente los subtotales. Una transferencia vista como salida del Estado y entrada de una comunidad no representa dos gastos finales distintos.

### Presupuesto y gasto realizado

La pregunta «¿en qué se gastó?» necesita gasto realizado por función. Un presupuesto contesta «¿para qué se autorizó dinero?». Ambos merecen presentación, pero el cambio entre ellos debe ser visible. No construir un gráfico continuo de ingresos realizados y créditos iniciales como si compartieran base contable.

Eurostat publica gasto por funciones COFOG en `gov_10a_exp`: permite una primera respuesta sobre protección social, salud, educación y otras funciones sin inferir su destino por el nombre del ministerio. Es una ampliación de máxima prioridad. Hay que comprobar años y detalle disponibles para España antes de definir el selector. [Eurostat, metodología COFOG](https://webgate.ec.europa.eu/eurostat/cache/metadata/en/gov_10a_exp_esms.htm).

### Intereses, principal y operaciones financieras

Una categoría genérica «deuda» puede mezclar intereses con devolución de principal. No son intercambiables. El presupuesto diferencia gastos financieros, activos financieros y pasivos financieros, y sus totales dependen de qué capítulos se incluyan. La maqueta de «cada 100 €» necesita una definición explícita del denominador y categorías excluyentes. [SEPG, resumen por capítulos](https://www.sepg.pap.hacienda.gob.es/Presup/PGE2025Prorroga/MaestroDocumentos/PGE-ROM/doc/HTM/N_25P_E_V_1_101_1_1_2_2_127_1_4.HTM).

En la cadena fiscal, los intereses ya forman parte del gasto. La deuda es un saldo en una fecha; el déficit es un flujo durante un periodo. La variación de deuda tiene ajustes adicionales. «La diferencia exige financiación» explica el déficit sin prometer una identidad entre déficit y aumento de deuda. [Eurostat, déficit y deuda](https://ec.europa.eu/eurostat/cache/metadata/en/gov_10dd_esms.htm).

### Financiación territorial

«Cuánto recibe mi comunidad» puede significar recursos del sistema de financiación, transferencias recibidas, inversión ejecutada en el territorio o pagos a beneficiarios allí domiciliados. Son medidas diferentes. Las últimas no se obtienen de las primeras.

La financiación autonómica incluye impuestos cedidos y mecanismos de entrega a cuenta y liquidación. Debe distinguirse el ejercicio al que corresponde un recurso del año en que se liquida o paga. El dinero del sistema no equivale a todo el gasto realizado en la comunidad. [Hacienda, régimen común](https://www.hacienda.gob.es/es-es/areas%20tematicas/financiacion%20autonomica/paginas/regimen%20comun.aspx).

Proponer recursos por habitante como orientación, acompañados por competencias y régimen. Si se evalúan necesidades de financiación, la población ajustada puede responder otra pregunta y requiere explicación propia. País Vasco y Navarra necesitan vistas de régimen foral; Ceuta y Melilla deben describirse según su encaje específico, sin excluirlas arbitrariamente del sistema común ni tratarlas como una comunidad ordinaria.

### Fondos europeos

El MRR vincula desembolsos a hitos y objetivos; explicarlo como un reembolso de cada gasto concreto resulta insuficiente. Distinguir transferencias y préstamos, prefinanciación y desembolsos, y la fase nacional de la llegada al destinatario. [Comisión Europea, MRR](https://commission.europa.eu/business-economy-euro/economic-recovery/recovery-and-resilience-facility_en).

AIReF permite estudiar destinos del PRTR, pero su Observatorio mide contratos formalizados y subvenciones concedidas. Esos importes no prueban por sí solos pagos efectivos, obras terminadas o resultados. La metodología también limita la cobertura a transferencias del PRTR. [AIReF, metodología](https://www.airef.es/wp-content/uploads/2024/04/PRTR/Metodologia-del-Observatorio-PRTR.-AIReF.pdf).

En agricultura intervienen organismos pagadores autonómicos además del FEGA en su ámbito nacional. La tabla propuesta que atribuye todo al nivel Estado necesita corregirse. [BOE, RD 1046/2022, artículo 9](https://www.boe.es/buscar/act.php?id=BOE-A-2022-23046).

No sumar como «total de Europa» presupuestos de proyectos, ayudas concedidas, pagos, préstamos y subvenciones. Un fondo europeo puede financiar un contrato o una ayuda: son vistas del mismo proceso, no cantidades adicionales que añadir al gasto total.

### Clasificación de subvenciones

El organismo convocante no debe ser la primera regla de destino: puede conceder ayudas para distintas finalidades y cambiar de estructura. Prioridad recomendada: finalidad oficial y objeto de la convocatoria, programa presupuestario documentado cuando exista, reglas sobre títulos como respaldo, y revisión de ambiguos. El sector económico del receptor es una dimensión diferente de la finalidad.

La documentación oficial de BDNS distingue finalidad, región de impacto y sector económico y ofrece integración API. Nuestro ETL todavía no integra esos campos de convocatoria. Está por medir su completitud y qué campos devuelve cada endpoint. [BDNS, guía oficial](https://www.infosubvenciones.es/bdnstrans/estaticos/ayuda/AYUDA%20-%20Sistema%20Nacional%20de%20Publicidad%20de%20Subvenciones%20y%20Ayudas%20P%C3%BAblicas%20v2023.pdf).

Mostrar cantidades por instrumento: un préstamo o aval no debe presentarse automáticamente como equivalente a una entrega dineraria. Para convocatorias con varias finalidades, separar tema principal para sumar sin duplicación y etiquetas adicionales para explorar. Registrar método, versión y evidencia de clasificación.

## 4. Qué permite realmente la implementación actual

Esta revisión acredita estructuras, consultas y reglas del código. No es un censo de la base de producción ni una comprobación de que todas las fuentes están completas. Los recuentos de las capturas corresponden a su consulta del 6 de octubre; no se utilizan como cifras actuales.

| Hallazgo comprobado | Evidencia en el repositorio | Consecuencia para la presentación |
|---|---|---|
| Las portadas de área presentan el directorio antes de los destacados | `web/src/components/domain/ThreadLanding.tsx` | La respuesta principal necesita un lugar anterior al índice; invertir el orden sin revisar el significado de los destacados no basta |
| Dinero destaca registros, mayor contrato y suma de presupuestos UE | `web/src/app/dinero/page.tsx` | Métricas de inventario y extremos ocupan el espacio de la respuesta al ciudadano |
| Hay siete series fiscales anuales S13 y reconciliación de ingresos, gasto y saldo | `etl/src/ine/fiscal.py`, `web/src/lib/fiscal.ts` | Se puede ofrecer una primera respuesta consolidada con la base existente; S1311 requiere datos propios |
| Los indicadores se guardan con identidad por código y periodo | `economic_indicators`, `etl/src/ine/fiscal.py` | Añadir sectores con los mismos códigos sobrescribiría series; ampliar la identidad y las consultas antes de ingerirlos |
| Presupuestos dispone de programas, capítulos y procedencia, no ejecución completa | `etl/src/presupuestos/presupuestos.py`, `web/src/lib/data/budget.ts` | Sirve para autorización por programas; no para afirmar qué se gastó o pagó |
| El catálogo incluye 2019 como proyecto no aprobado, no incluye 2020 y distingue prórrogas | `web/src/lib/data/budget.ts` | Evitar una serie continua de presupuestos aprobados sin huecos ni estados |
| El scraper asigna 2026 a la carpeta PGE2025Prorroga | `etl/src/presupuestos/scraper_sepg.py` | Auditar procedencia de 2026 antes de prometer un presupuesto oficial específico de ese ejercicio |
| El mayor contrato se ordena por `amount`; ese campo se obtiene del presupuesto de licitación | `web/src/lib/data/home.ts`, `etl/src/contratacion/contratos.py` | El destacado no acredita el mayor pago ni la mayor adjudicación; tampoco distingue acuerdos marco en esa selección |
| Contratos conserva CPV, importes de adjudicación y número de ofertas, entre otros campos | `etl/src/contratacion/contratos.py` | Hay una base para explicar objetos de compra y competencia; medir completitud antes de agregarlos |
| La ingesta BDNS rechaza beneficiarios que empiezan por asterisco o están vacíos | `etl/src/bdns/subvenciones.py`, `_is_organization` y `parse_record` | Las ayudas anonimizadas quedan fuera. Reclasificar las filas actuales no representa todo el reparto de ayudas a ciudadanos |
| BDNS almacena convocatoria y su número, pero no un modelo de finalidad de convocatoria | `subsidies`, `etl/src/bdns/subvenciones.py` | Recuperar metadatos oficiales y relacionar concesiones con convocatorias para explicar destinos |
| `eu_funds` representa beneficiarios y sus agregados; el fetch está limitado a 30.000 registros por descarga | `etl/src/kohesio/fondos_ue.py`, migración `20260521000000_eu_funds.sql` | La suma local no acredita todos los fondos recibidos por España; hacen falta proyectos, programas y cobertura |
| Los cruces de trazabilidad son asociaciones por ministerio o receptor, con agregados históricos | `20260527000000_program_money_flow.sql`, `20260530000000_section_eu_fund_summary.sql`, `web/src/lib/data/money-flow.ts` | El año del presupuesto no filtra todas las operaciones asociadas. Compartir receptor no demuestra que un fondo financió un contrato; un importe UE puede aparecer en varias secciones |
| La responsabilidad presupuestaria cruza mandatos que coinciden con el año y el flujo escoge un nombre | `20260525000000_budget_source_provenance.sql`, `20260527000000_program_money_flow.sql` | Un cambio de titular exige fechas y rol; no atribuir automáticamente aprobación, firma o ejecución a una persona |
| El ETL de iniciativas selecciona proyectos de ley, proposiciones de ley y propuestas de reforma | `etl/src/congreso/iniciativas.py`, `INGESTED_DATASETS` | La colección no representa toda la actividad del Congreso: preguntas, control e intervenciones requieren ampliación |
| El atlas distingue dirección territorial y reconoce cobertura limitada | `web/src/app/territorio/page.tsx`, `web/src/lib/data/multilevel.ts` | Aprovechar el contexto existente; domicilio del receptor no equivale a lugar de la obra o servicio |

También conviene revisar las explicaciones económicas: `indicator-explanations.ts` contiene reglas generales, como un umbral de crecimiento del PIB asociado a empleo, que necesitan evidencia específica o una redacción más acotada. Las cifras oficiales no vuelven automáticamente verificable toda frase explicativa que las acompaña.

## 5. Una estructura de lectura compartida

Cada página debe definir estas piezas antes de diseñarse:

1. **Pregunta principal.** Una inquietud que se puede expresar sin conocer el nombre del dataset.
2. **Primera respuesta.** Una frase respaldada por evidencia suficiente; si falta, delimitar lo que sí se puede responder.
3. **Contexto inmediato.** Periodo, administración o población, unidad, fuente y el límite que cambiaría la lectura.
4. **Explicación.** Una comparación o gráfico que muestre el mecanismo; datos y etiquetas comprensibles sin depender del color.
5. **Siguiente pregunta.** Un enlace cuya etiqueta diga qué se averiguará al abrirlo.
6. **Evidencia.** Desglose, metodología, relaciones, documentos y descarga para reproducir la respuesta.

No todas las páginas necesitan el mismo gráfico. Un indicador pide evolución; una decisión pide estado y cronología; una persona pide competencias, actuaciones y relaciones; una compra pide objeto y fases; un territorio pide servicios y administraciones responsables.

En fichas, el primer párrafo identifica qué es la entidad o expediente y por qué aparece aquí. Las estadísticas secundarias no deben desplazar esa explicación. En colecciones, los totales deben corresponder al filtro activo y a todas sus filas, no solo a la página visible o a una muestra ordenada por importe.

### Contexto temporal y accesibilidad

Proponer año de referencia para el resumen y rango histórico para estudiar cambios. Si COFOG, salarios y cuentas cierran en años distintos, cada módulo muestra su periodo y explica la diferencia; no fingir que un selector global ha cambiado datos que no lo admiten. La alternativa es una vista sincronizada con último año común, identificada como tal.

Fuente y límite esencial deben acompañar también a una tarjeta compartida, gráfico descargado o respuesta de búsqueda. El recuento de filas puede quedar en un bloque de cobertura; las omisiones que afectan al significado siguen visibles.

Explicaciones breves visibles antes de desplegar detalles. Ampliaciones accesibles por teclado y toque; evitar que el cursor sea el único camino. Mantener tablas alternativas, etiquetas, foco y enlaces de regreso existentes. No geolocalizar automáticamente para responder «mi zona»: selección explícita de localidad.

## 6. Preguntas y recorrido de las cinco áreas

| Área | Pregunta principal | Recorrido recomendado | Qué debe entender al salir |
|---|---|---|---|
| Dinero público | ¿Qué se financia con nuestro dinero y cómo se paga? | Recursos → destinos → ejecución y resultados → responsables y operaciones | Qué se gastó, en qué, con qué ingresos y qué falta por comprobar |
| Personas y entidades | ¿Quién tiene responsabilidad sobre esto y qué sabemos de su actuación? | Competencia y mandato → decisiones → intereses y relaciones documentadas | Qué podía decidir esa persona, qué hizo y qué evidencia existe |
| Decisiones | ¿Qué se está decidiendo sobre lo que me preocupa? | Materia → medida concreta → tramitación y voto → efecto y vigencia | Qué cambia, quién intervino y si llegó a entrar en vigor |
| Economía | ¿Qué cambia en mi capacidad para vivir y pagar? | Precios → ingresos reales → empleo y distribución → herramientas personales | Diferencia entre variación estadística y su caso particular |
| Territorio | ¿Qué se financia aquí, quién lo gestiona y qué servicios obtenemos? | Lugar → competencias → financiación y gasto → servicios → decisiones y representantes | Diferencia entre dinero dirigido a la zona, gasto de su administración y resultados |

Mantener las cinco áreas como navegación estable y añadir entradas por inquietudes: vivienda, salud, pensiones, educación, empleo, transporte. Esos temas cruzan las áreas; no necesitan seis nuevos silos ni una taxonomía que finja que gasto, CPV y materia legislativa son conceptos idénticos.

La portada `/` debe declarar la tesis, aportar una primera evidencia fiscal con fuente y permitir elegir pronto una pregunta sobre dinero, economía cotidiana o responsables. La Cadena sigue aportando la explicación fiscal; las entradas por inquietud deben ser visibles sin exigir leer antes todos sus capítulos. Cada portada de área desarrolla su propia pregunta. Evitar que la página inicial y Dinero repitan una explicación larga idéntica o compitan con dos respuestas de distinto perímetro.

### Ejemplo de recorrido sobre vivienda

Una persona abre vivienda en su comunidad. Ve primero qué aspectos podemos acreditar: gasto funcional, ayudas concedidas o precios oficiales, cada uno con su periodo. Desde ayudas llega a finalidad, convocatoria y administración concedente; desde una decisión llega al texto propuesto, sus firmantes documentados, fase, voto nominal y norma publicada si existe. Después puede consultar al cargo competente durante esa actuación.

Si todavía no tenemos ejecución de ayudas o viviendas entregadas, el recorrido termina con ese límite. No presentar ayuda concedida como vivienda construida ni cambios de precio como efecto probado de una ley. Esta es la misma praxis que organiza «Dinero público», aplicada a un asunto concreto.

## 7. Matriz por colección y ficha

Las siguientes son hipótesis de necesidad para diseñar y validar. Cada fila asigna un trabajo a páginas existentes y señala el dato que impide completarlo. Las fichas conservan una única URL aunque se alcancen desde diferentes temas.

### Dinero

| Páginas | Pregunta | Primera respuesta y profundización | Cobertura o cuidado |
|---|---|---|---|
| `/dinero` | ¿Qué se hace con nuestro dinero? | Panorama anual; destinos del gasto; financiación; acceso a mi territorio | Abrir con S13 identificado; destinos realizados requieren COFOG |
| `/cuentas-publicas` y series fiscales | ¿Ingresamos lo suficiente para cubrir el gasto? | Ingresos frente a gasto, saldo, evolución de deuda e intereses | Mismo perímetro y año; ampliar subsectores con identidad propia |
| `/presupuestos` | ¿Qué se autorizó financiar? | Políticas y programas con su presupuesto y estado jurídico | Separar proyecto, ley, prórroga y ejecución |
| `/presupuestos/[section]` | ¿Qué prioridades recoge esta sección? | Programas, capítulos, cambios y personas con responsabilidad temporal | No equiparar sección a una función ciudadana ni sumar transferencias dos veces |
| `/presupuestos/[section]/[program]` | ¿Qué pretende hacer este programa y se realizó? | Objeto, autorización, ejecución si existe y documentos | Nuevos datos IGAE y de resultados; vínculos a operaciones solo con evidencia |
| `/subvenciones` | ¿Para qué se conceden ayudas públicas? | Finalidades, importe concedido por instrumento, nivel y año; sin clasificar | Convocatorias BDNS y agregados que incluyan ayudas anonimizadas bajo un tratamiento adecuado |
| `/subvenciones/[id]` | ¿Qué ayuda es y para qué se concedió? | Convocatoria, finalidad, importe, fase y órgano; receptor cuando proceda | Concesión no acredita pago; acceso público no elimina límites de reutilización |
| `/contratos` | ¿Qué se compra con dinero público y cómo se adjudica? | Objetos de compra por CPV, administración y periodo; adjudicaciones y competencia documentada | Separar licitación, adjudicación, formalización y pago; acuerdos marco, lotes y deduplicación |
| `/contratos/[id]` | ¿Qué se compró, a quién y en qué condiciones? | Objeto en lenguaje claro, órgano, adjudicatario, importes etiquetados y fases | Modificaciones, ejecución y pagos pueden faltar; autoridad jerárquica no prueba firma |
| `/fondos-ue` | ¿Qué financiación europea se ha movilizado y para qué? | Familia de instrumento, programa, destino, fase y periodo | Kohesio actual cubre beneficiarios; PRTR y PAC requieren fuentes propias |
| `/fondos-ue/[id]` | ¿Qué sabemos de la financiación de este beneficiario? | Explicar que hoy es una ficha de beneficiario; proyectos y fases cuando estén disponibles | No llamar proyecto al agregado del beneficiario ni pago a presupuesto UE |
| `/dinero-publico` | ¿Qué relación acreditada hay entre una autorización y una operación? | Camino documentado con tipos de vínculo y huecos visibles | Cambiar la cascada aparente por relaciones probadas; asociación de ministerio no demuestra ejecución de programa |

### Personas y entidades

| Páginas | Pregunta | Primera respuesta y profundización | Cobertura o cuidado |
|---|---|---|---|
| `/personas` | ¿Quién responde por el asunto que me preocupa? | Entrada por competencia, territorio, tema y búsqueda de nombre | Mapas de competencias y mandatos, además de directorios |
| `/diputados`, `/senado` | ¿Quién me representa y qué decisiones tomó? | Circunscripción, cámara, mandato y decisiones por materia | Explicar representación colectiva de la circunscripción y diferencias entre cámaras |
| `/diputados/[id]`, `/senadores/[id]` | ¿Qué hizo esta persona sobre un tema? | Cargo, periodo, votos, iniciativas y actividad documentada | No convertir volumen de iniciativas o voto registrado en un índice de trabajo o honestidad |
| `/gobierno`, `/cargos/[id]` | ¿Quién ejerce esta competencia? | Titulares, funciones y fechas; decisiones y nombramiento | Responsabilidad política, competencia y firma son roles distintos |
| `/ministerios`, `/ministerios/[id]` | ¿Qué asuntos gestionan las personas de este ministerio? | Competencias, titulares por periodo, programas y actuaciones | Reorganizaciones ministeriales y series históricas comparables |
| `/instituciones`, `/instituciones/[id]` | ¿Quién ocupa sus puestos y cómo llegó a ellos? | Función, integrantes, nombramientos y relación legal de dependencia | No inferir control político por una mera coincidencia biográfica |
| `/organizaciones`, `/organizaciones/[id]` | ¿Qué papel tiene esta entidad en el dinero o decisión que sigo? | Órgano concedente/contratante, receptor o adjudicatario; operaciones y relaciones | Separar roles, periodos e identidades; NIF no debe convertirse en un identificador personal expuesto innecesariamente |
| `/partidos`, `/partidos/[id]` | ¿Qué personas se vinculan a este partido y qué votaron? | Representantes, órganos y actuaciones individuales agrupadas | Mostrar agregados como conjuntos; no atribuir una voluntad única ni culpa colectiva |
| `/declaraciones` y fichas de declaración/persona | ¿Qué intereses y bienes declaró el cargo? | Fecha, documento, actividades, valores comparables y cambios verificables | OCR, categorías y valoración; ausencia de declaración no significa ausencia de patrimonio |
| `/puertas-giratorias`, `/puertas-giratorias/[id]` | ¿Qué tránsito entre cargos públicos y privados está documentado? | Cronología, puestos, sectores y fuentes | Transición no acredita irregularidad; autorizaciones y restricciones requieren evidencia propia |
| `/grupos-de-interes`, `/grupos-de-interes/[id]` | ¿Qué intereses se representan y qué contacto conocemos? | Inscripción, intereses, entidades representadas y contactos publicados | Registro CNMC no representa todo el lobbying; reunión y efecto no se infieren de inscripción |
| `/corrupcion`, `/corrupcion/[id]` | ¿Qué hechos se investigan y cuál es su situación judicial? | Hechos atribuidos, actuaciones, personas y resolución con fecha | Distinguir investigación, acusación, condena y firmeza; revisión editorial por documento |
| `/rastro/[type]/[id]` | ¿Qué relación concreta une estas personas, entidades u operaciones? | Rol, documento, fechas y grado de verificación en cada enlace | Coincidencia de nombre o receptor no demuestra transferencia, intervención o causalidad |

### Decisiones

| Páginas | Pregunta | Primera respuesta y profundización | Cobertura o cuidado |
|---|---|---|---|
| `/decisiones` | ¿Qué se decide sobre vivienda, salud o empleo? | Materias, cambios propuestos, fase y decisiones recientes | Clasificación trazable y actividad legislativa y de control más completa |
| `/iniciativas`, `/iniciativas/[id]` | ¿Qué propone esta medida y qué ocurrió con ella? | Resumen fiel al texto, origen, firmantes, hitos, votos y norma resultante | Diferenciar iniciativa, trámite y ley vigente; origen UE y veto solo con documentación |
| `/votaciones`, `/votaciones/[id]` | ¿Qué se votó exactamente y qué decidió cada representante? | Objeto de la votación, fase, resultado y votos nominales | Un voto sobre una enmienda no es un voto sobre toda la ley; conservar texto concreto |
| `/asistencia` | ¿Qué participación registrada existe durante el mandato? | Denominador, periodo elegible y forma de registro | Falta de voto no prueba ausencia física ni mide todo el trabajo parlamentario |
| `/divergencias` | ¿En qué votación esta persona votó distinto del grupo? | Voto concreto, contexto y criterio de comparación | Superficie profunda; no usar como titular de portada |
| `/distorsion` | ¿Cómo se transformaron votos en escaños en mi circunscripción? | Resultado, reglas y comparación explicada | Contrafactuales identificados; cambio de regla no predice voto o gobierno alternativo |

### Economía y territorio

| Páginas | Pregunta | Primera respuesta y profundización | Cobertura o cuidado |
|---|---|---|---|
| `/economia` | ¿Qué está cambiando en mi capacidad de compra y empleo? | Precios, ingresos y trabajo, cada uno con su fecha y explicación | Complementar medias con distribución; no atribuir todo cambio a una decisión política |
| `/indicadores` | ¿Qué dato responde a mi duda económica? | Entradas por precios, salarios, empleo y actividad | Conservar catálogo de series como detalle |
| `/indicadores/[code]` | ¿Qué mide y qué significa su cambio? | Último dato, comparación pertinente, evolución y población medida | Frecuencia, nominal/real, media/mediana, revisiones y límites visibles |
| `/calculadoras` | ¿Cuánto necesito para mantener mi capacidad de compra? | Cálculo con IPC e importes elegidos; supuestos y periodo | IPC promedio no reproduce cada cesta personal; no almacenar importes personales innecesariamente |
| `/territorio`, `/territorio/tu-zona` | ¿Qué pasa con el dinero y servicios de mi zona? | Selector de lugar y competencias; mapa con medidas distintas | Ubicación administrativa, receptor y lugar de ejecución diferenciados |
| `/territorio/[scope]/[key]` | ¿Qué financia esta administración y qué resultado se observa? | Recursos, gasto, servicios, representantes y operaciones | Presupuestos y liquidaciones autonómicas/locales; resultados comparables por competencia y año |

### Búsqueda y páginas auxiliares

`/buscar` debe distinguir la búsqueda de una persona de la búsqueda de un asunto. Una consulta como vivienda necesita mostrar qué respuestas hay —ayudas, gasto, decisiones y series— y después los expedientes, sin prometer que todos los resultados están clasificados. Conservar búsqueda y filtros al entrar y salir de fichas.

`/estado-datos` debe explicar qué preguntas están cubiertas, qué años o administraciones faltan y qué excluye cada ingesta. Que un pipeline termine correctamente no acredita exhaustividad. `/perfil` y `/usuarios/[handle]` deben distinguir aportaciones de usuarios de registros oficiales; `/admin` sirve a la revisión y no es una entrada ciudadana. Autenticación y páginas técnicas cumplen su función operativa sin forzar un titular narrativo.

## 8. Cómo incorporar el sentido de Euthyna

El correo plantea entender a qué dedica su tiempo el Congreso por materia y durante la legislatura. La integración natural es una nueva capacidad de Decisiones, conectada a personas y temas. No hay código de Euthyna aportado en estos archivos; este estudio evalúa la idea, no su implementación.

Separar cuatro medidas: expedientes presentados, asuntos debatidos, intervenciones y duración de debate. Contar iniciativas no permite afirmar cuánto tiempo se dedicó a una materia. Una materia puede generar muchas preguntas breves o pocos debates largos. Las votaciones tampoco cubren por sí solas toda la actividad.

Primera ampliación: incorporar tipos de iniciativas de control y no legislativas, agenda, órdenes del día, diarios e intervenciones y relacionarlos por expediente y sesión. El Congreso publica [datos abiertos de intervenciones](https://www.congreso.es/es/opendata/intervenciones) y explica el acceso al expediente y sus publicaciones en sus [consultas frecuentes](https://www.congreso.es/es/cem/faqs).

Primera presentación defendible: «Actividad registrada sobre vivienda durante este periodo», separando iniciativas, debates e intervenciones y su cobertura. La duración solo se añade si existen tiempos verificables por segmento o una extracción revisada de fuentes oficiales; no estimarla por longitud del texto o número de filas y llamarla tiempo real.

Relacionar después propuesta → debate → voto → publicación → vigencia. Incorporar firmantes y participantes individuales cuando la fuente los identifica. Si el expediente atribuye la autoría a un grupo, conservar esa atribución oficial y explicitar que todavía no tenemos firmantes individuales; no asignarla al portavoz por defecto.

## 9. Cobertura que merece aumentar

El criterio de incorporación es: qué pregunta concreta hace posible, cómo se conecta con lo existente y qué confusión evita. Disponibilidad de una fuente o cantidad de registros no decide por sí sola la prioridad.

| Orden | Incorporación | Respuesta ciudadana nueva | Fuente y trabajo necesario |
|---|---|---|---|
| 1 | Gasto realizado por función y cuentas por subsector | En qué se gastó y qué administra cada nivel | Eurostat COFOG y cuentas; comprobar años, reconciliación, consolidación y nueva identidad de observaciones |
| 2 | Metadatos de convocatorias BDNS y cobertura agregada de ayudas anonimizadas | Para qué se concedieron ayudas, incluyendo ámbitos dirigidos a hogares | API y catálogos BDNS; clasificación versionada, instrumentos y tratamiento separado de identidad |
| 3 | Ejecución presupuestaria y liquidaciones | Qué parte de lo autorizado se reconoció y pagó | [IGAE](https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadPublica/CPE/EjecucionPresupuestaria/paginas/ejecucionpresupuestaria.aspx) y [Hacienda autonómica/local](https://www.hacienda.gob.es/es-ES/CDI/paginas/informacionpresupuestaria/InformacionPresupuestaria.aspx); distinguir crédito, obligaciones y pagos |
| 4 | Financiación autonómica y local | Qué recursos corresponden a mi administración | [Liquidaciones oficiales del sistema](https://www.hacienda.gob.es/es-ES/CDI/Paginas/SistemasFinanciacionDeuda/InformacionCCAAs/Informes%20financiacion%20comunidades%20autonomas2.aspx), entregas y población; registrar ejercicio de referencia y pago, competencias y regímenes |
| 5 | Materias y recorrido de decisiones; ampliar actividad parlamentaria | Qué se está haciendo sobre el asunto que me afecta | Congreso y Senado; expedientes, sesiones, intervenciones, textos y publicación BOE; clasificación con evidencia |
| 6 | PRTR por componente, inversión y territorio | Qué se ha movilizado y para qué desde este instrumento | [AIReF, descarga de microdatos](https://www.airef.es/es/datalab/herramientas-interactivas-de-la-airef/observatorio-del-prtr/); fuente propia por fase, préstamos separados y vínculos por identificadores |
| 7 | Proyectos y programas de cohesión y PAC | Qué proyecto o intervención explica una cifra europea | Kohesio/DG Fondos Europeos y fuentes PAC; estudiar granularidad, periodos y cobertura antes de prometer un total |
| 8 | Contratación por CPV, lotes, acuerdos marco y fases | Qué compramos y cómo se adjudicó | PCSP; aprovechar CPV existente y ampliar donde falten condiciones, lotes y modificaciones; no inferir pagos |
| 9 | Distribución de ingresos, salarios y vivienda | A quién describe una media y cómo cambia la vida cotidiana | INE: estructura salarial, EPA, condiciones de vida y fuentes oficiales de vivienda; evaluar tablas concretas antes de ingerir |
| 10 | Un primer ámbito de resultados de servicios | Qué resultado observable acompaña al gasto | Piloto de sanidad: listas de espera oficiales con definición y revisiones; después educación, dependencia o vivienda según disponibilidad comparable |
| Transversal | Competencias, mandatos, identidades y documentos de actuación | Quién tenía capacidad de decidir y cuándo | Normas organizativas, nombramientos y documentos de cada expediente; roles y fechas, sin inferencias de culpabilidad |

La recaudación por figuras de [AEAT](https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Informes_anuales_de_Recaudacion_Tributaria.shtml) complementaría la explicación de quién financia el gasto. AEAT gestiona ingresos por cuenta de varios niveles y sus series no sustituyen automáticamente los ingresos SEC: conservar atribución y base contable.

La [estructura salarial del INE](https://www.ine.es/dynt3/inebase/index.htm?capsel=4568&padre=4563) ofrece distribución además de medias. Es preferible incorporar esas diferencias antes de insinuar que el salario medio es el salario de una persona típica.

El [sistema de listas de espera de Sanidad](https://www.sanidad.gob.es/va/estadEstudios/estadisticas/inforRecopilaciones/listaEspera.htm) proporciona un candidato para resultados y documenta revisiones. No dividir gasto sanitario total entre personas en lista y llamarlo coste por paciente, ni atribuir a más gasto una mejora sin evaluación. Mostrar ambas evoluciones aporta contexto, no causalidad.

Antes de nuevas tablas voluminosas: comprobar descarga y licencia vigentes, campos, completitud en una muestra, tamaño y mantenimiento. Dar preferencia a series y metadatos que expliquen las operaciones ya existentes. No hace falta comenzar por millones de registros adicionales.

Para BDNS, revisar específicamente las condiciones vigentes de reutilización y el tratamiento de datos personales antes de ampliar la cobertura de ayudas a hogares. La guía consultada es de 2023; su aviso actual debe comprobarse al implementar. Un dato agregado no garantiza por sí solo disociación si permite reconocer a una persona en un grupo pequeño. La ampliación propuesta persigue representación de importes y finalidades, sin reconstruir identidades anonimizadas.

## 10. Clasificación y significado de los datos

No imponer una sola clasificación a todos los datasets. Gasto COFOG, programas presupuestarios, finalidad BDNS, CPV y materia legislativa describen dimensiones distintas. Mantener los códigos oficiales y construir correspondencias explícitas hacia temas ciudadanos, con evidencia y versión.

Para cada respuesta calculada conservar: medida, entidad/población, unidad, periodo, territorio y su significado, fase económica, fuente y fecha, cobertura, método y versión. En relaciones conservar: origen, destino, rol, evidencia documental, vigencia y tipo de comprobación. No resolver por nombre una entidad que tiene identificador verificable sin registrar el método.

Ejemplo: una ayuda concedida para rehabilitación energética puede tener tema principal Vivienda y etiqueta secundaria Energía. Se suma una vez en el reparto principal y puede aparecer en ambos recorridos de exploración. El gráfico explica esa diferencia. «Sin clasificar» mide la clasificación; «sin importe» mide cantidades desconocidas; las ayudas excluidas de la ingesta miden cobertura. Son vacíos distintos.

La IA puede proponer temas, explicaciones y vínculos, pero el objeto oficial y la evidencia deben conservarse. No publicar una inferencia como dato oficial ni generar importes o completar pagos ausentes. Cuando una clasificación no es suficientemente defendible, dejarla pendiente o sin clasificar.

### Reglas de cálculo

- Gasto por cada 100 € de ingresos: `100 × TE / TR`, con ambos del mismo ámbito y año. Redacción automática acorde a déficit, superávit o equilibrio; no fijar un titular deficitario para todos los periodos.
- En un rango, una razón de totales y una media de razones anuales son medidas diferentes. Elegir una, explicarla y no mezclarla con el dato del último año.
- Gasto por función: `100 × gasto_función / gasto_total` con categorías excluyentes, mismo perímetro y reconciliación. Los presupuestos usan su propio denominador y estado jurídico.
- Intereses: ya incluidos en gasto total; desglosarlos no crea gasto adicional. Deuda: saldo de cierre, no suma anual de stocks.
- Recursos por habitante: numerador de significado definido y población del periodo pertinente; no llamarlo importe que recibe personalmente cada vecino.
- Importes de contratación y ayudas: fase e instrumento homogéneos, IVA especificado, deduplicación por unidad real y cobertura temporal. Nunca sumar por comodidad licitación y adjudicación de la misma compra.
- No construir Sankey de dinero real con relaciones de asociación. La coincidencia de ministerio, receptor o nombre abre una investigación; no demuestra el recorrido de una cantidad.

## 11. Primer cambio concreto y fases siguientes

### Primera entrega con los datos existentes

Rehacer `/dinero` como una respuesta anual sobre ingresos, gasto, saldo e intereses S13, con fuentes y periodo visibles. Después ofrecer dos preguntas diferenciadas: destinos del gasto realizado, todavía pendientes del desglose funcional, y prioridades autorizadas, consultables en presupuestos. El directorio sigue siendo una herramienta de acceso, con el recuento como información de cobertura.

Retirar de ese papel protagonista el extremo del mayor contrato y el supuesto total de Europa. Ofrecer contratos como «qué se compra y a quién se adjudica» y fondos como la cobertura concreta de Kohesio mientras llegan las fuentes de instrumentos. No sustituir los extremos por otro número atractivo sin validar su significado.

Esta primera entrega puede mejorar comprensión antes de ampliar la ingesta. Debe declarar claramente que aún no contesta por completo qué se ejecutó ni qué llegó a cada comunidad. Ninguna cifra de la maqueta se usa como relleno.

### Segunda entrega para responder destinos

Incorporar COFOG y convocatorias BDNS. Construir vista por finalidad, instrumentos y nivel, incluyendo importes y registros sin clasificar. Corregir el tratamiento de cobertura de ayudas anonimizadas mediante una vía agregada sin exposición innecesaria de identidad. Mantener el detalle de operaciones y destinatarios que proceda mostrar.

### Tercera entrega para territorio y ejecución

Incorporar liquidaciones, ejecución y financiación territorial. Unificar la experiencia de contexto por año y lugar sin fingir igualdad de periodos. Validar regímenes y competencias y revisar los cruces de trazabilidad antes de presentarlos como relaciones financieras.

### Entregas posteriores

Aplicar la misma ficha de pregunta y evidencia a personas, decisiones y economía; abrir un primer tema transversal. Integrar actividad parlamentaria por materias y construir un piloto de resultados de servicios. Ampliar familias de fondos europeos por fases verificables.

## 12. Aceptación de la praxis

Definir para cada página, antes de implementarla, qué respuesta debería poder dar una persona tras verla y qué interpretación falsa sería grave. La aceptación requiere comprobar ambas.

Proponer sesiones iniciales con entre cinco y ocho personas de distintos perfiles, principalmente en móvil. Pedir primero su pregunta con sus palabras, observar el recorrido y solicitar que expliquen lo entendido. No dar pistas sobre qué tarjeta deben abrir. Esta muestra sirve para encontrar problemas, no para estimar preferencias de toda la población.

Tareas de ejemplo: explicar ingresos frente a gasto y su ámbito; distinguir presupuesto de gasto; encontrar una finalidad de ayudas; explicar qué representa una cifra territorial; localizar un voto sobre una medida; distinguir un trámite aprobado de una ley vigente; encontrar a la persona competente durante una actuación.

Criterios de una página lista para publicar:

- Tiene una primera respuesta comprobable y un siguiente paso comprensible.
- Periodo, perímetro y límite material acompañan el dato principal.
- Sus totales reflejan el conjunto seleccionado y reconcilian con la fuente bajo el método declarado.
- Se distingue cero de falta de información, clasificación y cobertura.
- Cada relación dice qué acredita y permite llegar al documento.
- Se puede entender y operar en móvil y con teclado, sin depender de tooltips o colores.
- El contenido descargado o compartido conserva contexto y fuente.
- Una persona ajena al desarrollo puede explicar la respuesta sin confundir los conceptos críticos.

Medir éxito por respuestas entendidas, preguntas continuadas y acceso a evidencia. Tiempo en pantalla y volumen de registros no acreditan por sí solos utilidad o comprensión.

## Alcance de este estudio

Se han leído el hilo aportado, las once páginas del DOCX, sus cuatro imágenes y las tablas; se ha revisado la estructura visual y se han contrastado las propuestas con código y fuentes primarias. Los originales privados permanecen fuera del repositorio. Este archivo recoge el criterio; el plan enlazado concreta las entregas y NEXT.md mantiene el trabajo activo. Los estados de implementación y validación se registran en el plan.
