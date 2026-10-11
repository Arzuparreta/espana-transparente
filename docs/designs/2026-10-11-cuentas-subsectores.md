# Fase 2 — cuentas por subsector

Pregunta: ¿qué ingresos, gasto realizado y saldo tiene cada nivel de las administraciones en el mismo ejercicio?

## Contrato y fuente

Eurostat `gov_10a_main`, España, frecuencia anual, SEC 2010, `MIO_EUR`, 2016 en adelante. Se conservan los códigos oficiales: S13, S1311, S1312, S1313 y S1314; ingresos TR, gasto TE y saldo B9. [Metodología oficial](https://ec.europa.eu/eurostat/cache/metadata/en/gov_10a_main_esms.htm). La URL reproducible y la fecha de consulta se guardan en cada observación.

Snapshot inicial consultado el 11 de octubre de 2026: 150 observaciones, diez ejercicios completos 2016–2025; actualización de fuente 21 de julio de 2026. Es contabilidad nacional en euros corrientes, no presupuesto autorizado, ejecución presupuestaria de caja ni financiación territorial. S1312 agrupa todas las administraciones autonómicas; S1313 todas las locales; S1314 no equivale al gasto sanitario ni solo a pensiones. Los detalles de alcance se despliegan junto a cada fila.

Ingresos y gasto de los subsectores **no son un reparto aditivo de S13**: las operaciones internas correspondientes se consolidan. No hay porcentajes ni suma de esos flujos. El saldo de cada ámbito cumple TR−TE=B9 y los cuatro saldos se reconcilian con S13; tolerancias de redondeo de 0,3 y 0,6 millones respectivamente. Déficit no equivale a variación de deuda. Una comparación no prueba eficiencia, calidad de servicios ni recursos de una comunidad concreta.

## Datos, recuperación y límites

Tabla independiente `fiscal_sector_accounts`, clave `(geo, sector, year, item)`; no se sobrescribe S13 en `economic_indicators`. Restricciones de país, códigos, unidad, años y valores, lectura pública mediante RLS y escritura del ETL. `ine.subsectors` se ejecuta semanalmente y registra frescura. Decodifica JSON-stat sin depender del orden dimensional, conserva flags y metadatos y rechaza snapshots vacíos, parciales o inconsistentes antes de reemplazar datos. El reemplazo y el éxito del run son una transacción; un fallo conserva el snapshot anterior.

Auditoría en PostgreSQL aislado: migración real y seed de 150 filas contrastados con la respuesta oficial; tabla e índices ocupan 139.264 bytes (136 KiB). Techo del contrato 1.275 observaciones (2016–2100); consulta limitada a 1.500 y fallo explícito si se alcanza el límite. Son datos públicos reproducibles: recuperación mediante migración y `ine.subsectors`, sin requisito de backup irremplazable. Este bloque no aplica cambios manuales a producción.

La página `/cuentas-por-subsector` permite seleccionar un ejercicio completo, identifica cifras provisionales y enlaza las cuentas S13 del mismo año. Un año inválido o ausente no se sustituye silenciosamente por el último; fallo de consulta y ausencia se muestran explícitamente y nunca como cero. Entrada desde `/dinero`, `/cuentas-publicas`, directorio y sitemap.

## Evidencia y continuación

Pruebas del decodificador, identidades, flags, cero, años incompletos, claves duplicadas y unidades; integración con PostgreSQL usando la migración real, idempotencia, rollback y RLS. Pruebas de consulta, modelo y renderizado; revisión en navegador a 390 y 1280 px con el seed oficial y selección anual GET. Validación de frontend con tests, lint, auditorías y build; dry-run de la fuente real sin escritura.

Es el tercer slice implementado de fase 2. La aceptación humana de comprensión sigue pendiente. Siguiente bloque del plan: fase 3, ejecución y territorio, empezando por un piloto con fuente, ámbito y periodos comparables; este agregado nacional no acredita ejecución de un servicio ni reparto territorial.
