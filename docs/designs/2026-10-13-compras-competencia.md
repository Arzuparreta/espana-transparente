# Contratos: qué se compra y con cuánta competencia

Bloque de la matriz ciudadana posterior a la [identidad de contratos](2026-10-12-identidad-contratos.md) (PR #82). Fila `/contratos` del [criterio ciudadano](2026-10-11-criterio-ciudadano.md).

- Pregunta: ¿qué se compra con dinero público y cómo se adjudica?
- Respuesta: expedientes con adjudicación publicada por año, administración y objeto principal (división CPV); presupuesto de licitación sin IVA; reparto de ofertas recibidas por resultado.
- Medida y denominador: un expediente cuenta en el año de su primera adjudicación publicada. Presupuesto = presupuesto de licitación del proyecto (sin IVA, solo EUR), no importe adjudicado ni pago. La competencia se mide por resultado publicado: en ediciones verificadas, uno por lote adjudicado; en registros antiguos, solo el primer resultado (el parser anterior no conservaba los demás y `raw_data` está vacío). El porcentaje de una sola oferta se calcula sobre resultados con número de ofertas publicado.
- Evidencia de adjudicación: adjudicatario o importe publicado y fecha válida entre 2012 y hoy. No depende del código de estado: hay 351.441 registros en `PUB` con resultado (lotes resueltos en expedientes abiertos). Se excluyen anulados.
- Fuente y cobertura: feed `sindicacion_643` de la PCSP, «perfiles del contratante ubicados en la PCSP, excluyendo los contratos menores» ([Hacienda, datos abiertos](https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesContratante.aspx), consultado el 12/10/2026). No incluye plataformas autonómicas agregadas ni contratos menores. Etiquetas CPV: vocabulario oficial CPV 2008, TED `cpv_2008_ver_2013.xlsx`, columna ES (zip SHA-256 `5ca7169b12ec2fd829872a098eedb1848b07acad09c759e22cf9642024453647`).
- Interpretación a impedir: presupuesto como gasto o pago; una sola oferta como irregularidad; domicilio del adjudicatario como lugar beneficiado; el año del listado (actualización PCSP) como año de adjudicación. El bloque tiene su propio parámetro (`award_year`, `award_level`) y no aparenta filtrar el directorio.
- Duplicados: una fila antigua se excluye cuando existe una edición verificada con el mismo número de expediente y el mismo órgano; el mismo número en otro órgano es otro expediente.

## Implementación

Tabla `contract_purchase_summary` (año × nivel × división) y `contract_purchase_coverage` (exclusiones, fecha máxima, años). La función `refresh_contract_purchase_summary()` recalcula todo en una transacción; `contratacion.resumen` la ejecuta en el lote diario tras `contracts_daily` y falla si una tabla con filas produce un resumen vacío. Monitor de frescura `contract-purchases` (72 h).

## Comprobaciones

- Ocho pruebas de base aislada: lotes verificados (un expediente, varios resultados), año del expediente frente a año de cada resultado, fila antigua sustituida por edición verificada, mismo número en otro órgano, exclusiones contadas, moneda desconocida y presupuesto ausente, tramos de ofertas, refresco que sustituye.
- Ocho pruebas web: 45 divisiones oficiales, año por defecto (último completo), año o nivel inválidos sin sustitución, agregación por año/nivel, porcentaje sin denominador, error frente a resumen ausente frente a selección vacía, enlace compartible con nivel.
- Datos reales en producción, transacción revertida: 992.811 filas, 2.526 filas de resumen en 29 s. 2025: 122.064 expedientes, 88,3 mil M € de presupuesto de licitación, 50,2 % de resultados con una oferta (sobre los que publican el dato). Excluidos 4.177 anulados, 135.399 sin evidencia de adjudicación y 32.529 resultados con fecha inválida o futura. La división 35 (seguridad y defensa) encabeza 2025 por presupuesto por varios programas de Defensa de diciembre.

Pendiente: recuperación histórica de ediciones verificadas (los ficheros mensuales `licitacionesPerfilesContratanteCompleto3_AAAAMM.zip` lo permitirían) para que la competencia de expedientes con varios lotes no dependa del primer resultado; plataformas autonómicas agregadas. Aceptación con personas reales aparte.
