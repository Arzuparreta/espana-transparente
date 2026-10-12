# Contratos: identidad del expediente, lotes y fases

Contrato del bloque posterior a la PR #81. Implementado y validado localmente; pendiente de CI remoto y merge. Parte de la matriz ciudadana; no cierra el plan completo.

- Pregunta: ¿qué objeto se compra, qué expediente lo acredita y qué alcance tiene la adjudicación o competencia publicada?
- Respuesta esperada: expediente identificado por la fuente PCSP, presupuesto del proyecto separado de cada resultado/lote, moneda y fecha propias. Un número de expediente interno puede repetirse entre administraciones; no usarlo como identidad global.
- Medida y perímetro: clasificaciones CPV y presupuesto de licitación por fecha de actualización no equivalen a compras pagadas por año. Ofertas y adjudicatarios pertenecen al resultado donde se publican, no necesariamente a todo el expediente. Las modificaciones reemplazan una edición del mismo expediente, no generan otra compra.
- Fuente: feed ATOM oficial de la PCSP, descargado con TLS verificado el 12/10/2026. Muestra concreta de una página; no acredita exhaustividad histórica ni todas las monedas.
- Hallazgo verificado: 486 entradas, todas con Atom ID; 53 tienen varios bloques `TenderResult`, 158 tienen `ProcurementProjectLot`. Hay un grupo con el mismo `ContractFolderID`, distintos Atom ID y distintos órganos. La constraint global actual y el upsert por número interno pueden sobrescribir expedientes diferentes. El parser actual toma solo el primer resultado y no conserva moneda del XML.
- Evidencia local: `/tmp/et-pcsp-current.atom`, 15.942.922 bytes, SHA-256 `e0119e5b598da68f7f5b6e7b628151ca88c1b8e8749ea500a8427bed6d05c10b`. No es una fixture publicada ni toda la contratación nacional.
- Reparación prevista: clave estable oficial, preservación de UUID y enlaces en registros anteriores cuando exista correspondencia documental única, sin emparejar solo por número. Ediciones idempotentes. Mantener filas antiguas cuya identidad no pueda acreditarse; no afirmar reconstrucción de históricos ya sobrescritos sin recuperar fuente.
- Lotes/resultados: conservar alcance y relación por identificador publicado, mantener ausencia frente a cero, no sumar presupuesto padre y lotes ni etiquetar primer resultado como total. La moneda se verifica por importe; una moneda desconocida no se convierte en EUR.
- Revisión de consumidores: consultas por número, fichas, organizaciones y trazabilidad pueden depender de la clave anterior. Auditar antes de migrar. Verificar tamaño, recuperación, consistencia y actualización acotada; no borrar ni rehacer ciegamente la tabla.
- Aceptación: dos órganos con número igual quedan separados; relectura de una edición no duplica; UUID antiguo y vínculos se conservan cuando el match de fuente es único; ambigüedad no se resuelve arbitrariamente; resultados múltiples, lotes, moneda, fechas y precisión con pruebas útiles. Solo después publicar comparaciones reconciliadas de objeto de compra y competencia.
- Siguiente: ampliar esta primera respuesta con agregados cuyo denominador esté acreditado, completar las otras filas de la matriz, fuentes de mandatos, frescura y despliegue final. Participantes reales siguen pendientes.

También queda por corregir en `OperationContext` el texto heredado que llama organizaciones a todas las etiquetas visibles de subvenciones. El estudio BDNS demuestra que ese filtro no acredita personalidad jurídica; ninguna página debe prometer tal clasificación por el mero nombre.

## Implementación y comprobaciones

Se añade `source_id` oficial y único, edición publicada acotada, fecha completa de revisión, moneda de adjudicación y recuentos generados de lotes/resultados. El número interno pierde unicidad global, conserva índice y sigue visible. No se borran UUID antiguos ni relaciones. Una fila antigua solo adopta identidad por enlace concreto PCSP igual y único; la portada o una correspondencia ambigua no se aceptan. El índice de correspondencia usa hash y además igualdad del URL completo, sin inferir identidad de una colisión de hash.

La actualización conserva la edición más reciente aunque el feed repita una identidad con revisiones más antiguas. Cada edición guarda presupuesto padre, presupuestos de lotes y todos los resultados, códigos y fechas publicados, ofertas por resultado y moneda/precisión original. Los campos escalares de destinatario e importe se limitan a un resultado inequívoco; desaparecen si la edición pasa a varios resultados o deja de publicar esos datos. No se arrastra una adjudicación anterior como si siguiera en la nueva edición. El catálogo y la ficha explicitan el alcance antiguo no verificado; no suponen EUR para una moneda desconocida ni comparan una adjudicación de lote con todo el presupuesto padre.

Las copias de revisiones judiciales conservan identidad oficial y fuente del contrato. El restaurador prioriza esas claves; copias antiguas por número siguen siendo compatibles cuando la correspondencia es única y se rechazan si es ambigua. No se han restaurado ni cambiado revisiones en producción.

Fuente completa de la página descargada: 486 registros contienen 471 identidades y 470 números internos; hay 682 bloques de resultados y 752 lotes antes de seleccionar revisiones. PostgreSQL aislado conserva exactamente las 471 ediciones más recientes, comprobadas contra fecha y JSON completo de cada fuente. Esos bloques repetidos no se suman como resultados actuales. Edición mayor comprimida 11.706 bytes; tabla e índices de esa muestra 1.073.152 bytes. No representa todo el corpus nacional ni una reparación histórica de expedientes previamente sobrescritos.

Pruebas de base aislada: colisión entre administraciones, idempotencia, preservación del UUID, ambigüedad, rechazo de edición inválida, fuente más antigua que no sustituye la actual y claves de recuperación. La CI crea una base desechable separada para ejecutarlas. Pruebas de UI: moneda desconocida, precisión original, cero/ausente, resultados múltiples y comparación de perímetros.

Revisión móvil 390×844: cliente/contenido 375/375 px. Ficha con tres lotes y dos resultados de la fuente oficial; desplegable de lotes abierto con Enter, importes y ausencia de adjudicatario visibles. Se usó un lector temporal para la muestra porque las columnas nuevas aún no están desplegadas; lector restaurado, fixture temporal eliminada y servidor cerrado antes de build. No se ha presentado la muestra como dato de producción ni como aceptación humana.

El texto heredado de `OperationContext` para ayudas ya distingue etiquetas visibles de personalidad jurídica, conforme al estudio BDNS.

Checks locales: 515 pruebas ETL pasan, una integración de búsqueda omitida por conexión no configurada; 333 pruebas web pasan. TypeScript, lint y build con lector original restaurado pasan; auditorías UI (490 archivos) y contenido (404 archivos, 29/29 indicadores) pasan. Migración aplicada desde cero en una segunda base aislada, siete pruebas de identidad/recuperación pasan.

Pendientes: CI remoto y merge; después, primera respuesta por CPV/competencia con cobertura y denominador documentados, resto de matriz, actualización de mandatos, frescura y despliegue final.
