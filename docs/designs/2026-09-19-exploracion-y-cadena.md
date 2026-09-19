# Exploración y La Cadena

Decisión de producto: 2026-09-19. Sustituye la arquitectura de tres hilos de NEXT.md.

## Arquitectura pública

Cinco áreas visibles: Dinero público, Personas y entidades, Decisiones, Economía y Territorio. `nav-config.ts` es el registro de áreas, agrupaciones y colecciones; las portadas, directorio, menú móvil y pie derivan de él. Las URL históricas permanecen válidas. Se añaden `/decisiones` y `/cuentas-publicas`; no se duplican entidades al cambiar de área.

El directorio lateral se abre en el área activa. En pantallas pequeñas, Secciones abre el mismo directorio. Búsqueda está disponible directamente en la cabecera. Las migas expresan ubicación canónica; Volver a resultados expresa el recorrido de la sesión. Una ficha presupuestaria incluye su sección antes del programa.

Las relaciones deben describir su significado. Órgano contratante y adjudicatario son roles distintos. Un cargo vinculado a una institución no demuestra intervención individual en una adjudicación. No enlazar una empresa usando un filtro de ministerio.

## Consultas reproducibles

Los parámetros de colección permanecen en la URL, incluida provincia, municipio, año, dirección territorial, organización y rol. Paginar conserva filtros; cambiar un filtro reinicia la página. Los contratos aceptan `organization=<uuid>` y `role=awarding|recipient|all`; subvenciones aceptan `role=awarding|recipient`. Estos filtros utilizan las relaciones existentes, no coincidencias por nombre.

La localización del receptor es su domicilio registrado, no necesariamente el lugar de ejecución. Las consultas sin cobertura no deben interpretarse como ausencia de gasto. Los resúmenes globales solo se muestran en la consulta global; no se presentan como resultados de una selección.

La búsqueda usa `/buscar?q=&type=&year=&page=` y la RPC aditiva `search_documents_page`. La intención afecta al orden, nunca a la exclusión de categorías. El año excluye registros sin fecha. La paginación ordena por relevancia, fecha, tipo e identificador. Las sugerencias conservan su interfaz anterior.

## Datos fiscales

`ine.fiscal` descarga Eurostat `gov_10a_main` y `gov_10dd_edpt1`, España, S13, frecuencia anual, MIO_EUR, desde 2016. Guarda observaciones en `economic_indicators` y metadatos en `raw_data`: dataset, URL, sector, frecuencia, unidad, partidas, indicadores de estado, fecha de consulta y revisión de la fuente.

Partidas: TR, TE, B9, D41PAY, D61REC; impuestos = D2REC + D5REC + D91REC, explícitamente antes del ajuste D995 por incobrables. Las cotizaciones incluyen imputaciones. No se representan como caja ni se atribuye a individuos la carga agregada.

La identidad TR − TE = B9 se comprueba con tolerancia de 0,3 millones por redondeos de las tres series. La deuda GD es un stock de cierre; no se identifica su variación con B9. La cadena solo utiliza años comunes reconciliados. No se rellenan huecos ni se reemplaza gasto de contabilidad nacional con créditos PGE.

La descarga y validación preceden a la sustitución transaccional del snapshot desde 2016. Una descarga fallida conserva las observaciones anteriores y registra el fallo. El pipeline se ejecuta semanalmente tras `ine.bde`, que conserva el histórico anterior a 2016. No deben ejecutarse ambos escritores simultáneamente.

Portada y Cuentas públicas comparten los cuatro capítulos y el selector `desde/hasta`. Cada gráfico dispone de tabla y descarga SVG con título, unidades, periodo, fecha y fuente. Impuestos y cotizaciones contextualizan la financiación; poder adquisitivo se enlaza por separado, sin atribuir la inflación española a la deuda española.

Fuentes metodológicas:
- https://ec.europa.eu/eurostat/cache/metadata/en/gov_10a_main_esms.htm
- https://ec.europa.eu/eurostat/cache/metadata/en/gov_10dd_esms.htm

## Publicación y aceptación

1. Aplicar `20260919000000_exploration_search.sql` antes de desplegar el frontend. No reemplaza las RPC antiguas.
2. Ejecutar `PYTHONPATH=src python -m src.ine.fiscal --dry-run` y después el mismo comando sin `--dry-run` en el entorno de datos autorizado.
3. Actualizar el corpus con el pipeline existente `common.search_refresh` y comprobar fuentes/frescura.
4. Desplegar y comprobar `/`, `/cuentas-publicas`, búsqueda paginada y navegación municipal. Hasta la ingesta, la cadena muestra indisponibilidad explícita.
5. La prueba con una persona ajena al desarrollo sigue siendo una aceptación humana: municipio → contratos → empresa → regreso; persona → voto → iniciativa; portada → serie → fuente. No la sustituye una prueba automatizada.

Reversión: el frontend anterior puede seguir usando su RPC de búsqueda. La migración es aditiva y las nuevas series no cambian los identificadores anteriores. Conservar el histórico fiscal y retirar el scheduler nuevo únicamente si se revierte esa funcionalidad.

## Evidencia de implementación local

- Pruebas web: 135 casos; ETL: 278 casos, con la integración de búsqueda existente omitida por falta de su conexión específica.
- Migración de búsqueda aplicada en PostgreSQL temporal. Casos SQL: recuento, filtros por tipo/año, orden estable y páginas sin solapamiento. Consulta sintética de 10.000 coincidencias ejecutada; no acredita rendimiento con todo el corpus de producción.
- Eurostat real: 70 observaciones anuales validadas. Dos ingestas en base temporal mantienen 70 filas; fallo de descarga simulado conserva el snapshot y registra estado fallido.
- Chromium local: móvil de 390 px y escritorio de 1440 px, navegación y mapa sin desbordamiento de página. La Cadena probada con observaciones Eurostat servidas por un adaptador temporal, cinco gráficos, tablas, descarga SVG y menú móvil. No se añadieron fixtures al producto.
- Regreso desde una serie: conserva `desde/hasta` y posición de desplazamiento. Recorrido contractual con lecturas reales: listado municipal → contrato → adjudicatario conserva el regreso municipal; contratos de la entidad se consultan por UUID.
- No se han aplicado cambios a la base pública, hecho push ni desplegado. La aceptación humana y la verificación del corpus completo en producción permanecen pendientes.
