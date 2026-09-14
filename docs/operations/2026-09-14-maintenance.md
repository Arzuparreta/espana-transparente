# Mantenimiento de septiembre de 2026

## Trabajo local recuperado

El árbol de `main` contenía 54 archivos modificados y ocho rutas nuevas procedentes del mantenimiento inacabado del 5 de septiembre. Incluía la actualización Next 14 → 15 / React 18 → 19, adaptaciones de rutas, reparaciones ETL, búsqueda incremental y dos migraciones. No estaba publicado: producción seguía en `89fbdc4` y `/api/data-health` devolvía 404.

Se conserva e integra ese trabajo tras revisar los cambios y completar su validación. Las configuraciones locales ignoradas de Supabase también apuntaban al servidor antiguo; se actualiza su URL al endpoint público actual, sin versionar credenciales.

## Incidente y reparación

Las ejecuciones diarias del 13 y 14 de septiembre fallaron en `photos.run`. El registro del día 14 muestra una consulta SPARQL inválida/agotada que se recuperó al procesar la siguiente persona. El error de la primera persona permanecía en el resultado. Ahora la recuperación acotada del índice termina antes de evaluar esa primera persona; una caída persistente sigue fallando. El límite de intentos evita multiplicar las consultas por todos los candidatos.

Los retratos oficiales del Senado siguen devolviendo 403 desde el VPS. Se conservan sus URLs oficiales y el corte de reintentos existente; una ejecución de fotos correcta no significa que todas las personas tengan una copia local.

## Mantenimiento integrado

- Búsqueda de organizaciones, contratos y subvenciones por lotes incrementales, sin el límite anterior de 10.000 documentos por tipo. Conserva documentos durante la actualización y elimina los correspondientes a fuentes borradas.
- Reintentos y errores explícitos ante respuestas vacías/parciales de INE, Eurostat, SEPG y BDNS; rollback antes de registrar fallos SQL.
- Contratos: solapamiento temporal y recuperación desde la última ejecución correcta; fallo explícito si el límite de páginas corta la ventana.
- Subvenciones: actualización sin filtro mínimo de importe y `updated_at` para el índice.
- Presupuestos: comprobación semanal de la fuente, sin presentar un salto por `--resume` como una comprobación nueva.
- Estado público basado en ejecuciones terminadas y vigilancia periódica mediante `/api/data-health`. El estado de aplicación/BD se comprueba por separado en `/api/health`.
- Despliegue condicionado a pruebas y migraciones, bloqueado contra solapamientos en CI y verificado contra el SHA solicitado.
- Dependencias web compatibles actualizadas y Vitest 4.1.11; dependencias Python directas actualizadas. No se fuerza una migración adicional de Next/Tailwind/TypeScript a otra versión mayor.

## Validación previa a publicación

- Python: 271 pruebas correctas; la prueba PostgreSQL opcional se ejecutó además en el VPS con tablas temporales: 1 correcta.
- Web: 126 pruebas correctas, lint y auditorías de UI/contenido correctas; 22/22 explicaciones de indicadores cubiertas.
- Comprobación de rutas de búsqueda contra producción: 4/4 correctas.
- Fotos en el VPS, sin escrituras: 194 candidatos, cero errores de fuente o persistencia; sin nuevos retratos disponibles en esta ejecución.
- Auditoría npm tras actualizar: cero vulnerabilidades detectadas.

La validación del despliegue detectó Node 20 en producción. Se fija Node 22.23.2 para CI y producción; el despliegue instala el binario oficial, verifica SHA-256 y lo utiliza únicamente para esta aplicación, persistiendo el intérprete en PM2.

## Dependencias operativas

Kohesio depende del temporizador de usuario `espana-transparente-kohesio-push.timer` de este equipo: la fuente rechaza las conexiones desde el VPS y desde GitHub. El temporizador estaba activo y la última transferencia (13 de septiembre) fue correcta. La ingestión rechaza ficheros caducados; mantener este equipo disponible sigue siendo necesario para esta fuente. La cobertura parcial que impone la API de Kohesio no se convierte en cobertura completa por ejecutar el ETL.

Los cron de GitHub pueden empezar con retraso. Los umbrales públicos contemplan margen para la cadencia diaria/semanal. El monitor alerta mediante el estado fallido del workflow; no garantiza que una fuente externa esté siempre disponible.
