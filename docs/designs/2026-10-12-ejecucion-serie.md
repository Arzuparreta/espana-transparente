# Fase 3 — evolución de la ejecución estatal durante 2025

Pregunta: ¿cómo avanzan las obligaciones reconocidas y los pagos del presupuesto corriente a lo largo del ejercicio? Se amplía el piloto de diciembre a los doce cortes de enero–diciembre de 2025. La [página oficial IGAE](https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadPublica/CPE/EjecucionPresupuestaria/Paginas/imejecucionpresupuesto2025.aspx) enlaza los doce libros. El manifiesto conserva sus URLs exactas: enero–octubre llevan `(EXCEL)` en el nombre; noviembre y diciembre no.

Se mantiene el [contrato presupuestario](2026-10-12-ejecucion-estado.md): Estado, capítulos 1–7 frente a financieros 8–9, miles de euros, crédito definitivo vigente, compromisos, obligaciones netas y pagos corrientes. No amplía el ámbito a S13 ni a territorio. No incorpora créditos iniciales ni afirma cobertura de 2026.

Cada corte es una instantánea acumulada desde enero. Nunca se suman meses ni se interpreta la diferencia entre libros revisables como gasto del mes. El crédito definitivo puede variar entre cortes. No exigir crecimiento monótono: las rectificaciones presupuestarias existen. No derivar calidad, eficiencia ni decisiones personales a partir de la serie.

ETL semanal: descargar y validar los doce informes antes de escribir; sustituir las doce filas de cada corte y confirmar toda la serie y el run en una sola transacción. Un fallo de descarga, mapeo o SQL conserva la serie anterior. Se preservan periodos ajenos al manifiesto. Cada fila conserva URL, fecha de consulta y SHA-256 de su libro; los hashes no son un archivo de versiones anteriores. La migración añade 132 filas reales y conserva diciembre previamente existente (`ON CONFLICT DO NOTHING`); el refresco semanal incorpora posteriores revisiones.

Interfaz: evolución no financiera hasta el corte seleccionado, dentro del mismo ejercicio. Enlaces de corte compartibles, fuente junto a cada fila, importes corrientes y límites visibles. Número de cortes disponibles respecto a los esperados hasta ese mes; los huecos no se interpolan. Conserva error, periodo ausente, valor no numérico y cero como estados distintos. No modifica la selección estricta de URL.

Evidencia del 12 de octubre:

- Los doce XLSX públicos pasan el parser de título/corte/año/unidad, columnas corrientes, capítulos y reconciliación con GTOS 013. Dry-run vivo: 144 filas, ninguna escritura.
- Migraciones aplicadas a PostgreSQL aislado: seed comparado en todos los valores y metadatos salvo fecha de consulta con los doce libros descargados; reemplazo de la serie repetido, 144 filas. Tamaño tras seed y dos reemplazos: 434.176 bytes (incluye versiones muertas hasta vacuum). No se añade una tabla ni cambia el régimen de backup del piloto recuperable.
- 331 pruebas ETL correctas con integración PostgreSQL; una prueba ajena de búsqueda omitida por conexión específica ausente. Cobertura nueva: manifiesto, rechazo de serie parcial antes de escrituras, fallo de descarga sin devolver parcial, seed de doce cortes idempotente y permisos. Rollback SQL de toda la serie tras sustituir cinco cortes, además del rollback del periodo.
- 213 pruebas web; lint, auditorías UI/contenido y build correctos. Prueba de componente: limita al ejercicio/corte, muestra huecos y fuentes y marca la selección actual.
- Navegador con seed oficial: 390 × 844, documento 375 px, tablas 343 px, sin desbordamiento; lectura de evolución enero–marzo y envío con Enter a `?period=2025-03`. Ruta temporal de verificación eliminada antes de commit. No sustituye aceptación con participantes ni prueba publicación de esta ampliación.

Siguiente bloque: primer ámbito territorial comparable y, después, actuaciones/mandatos documentados. Esta entrega sigue dentro de fase 3; no la declara terminada.
