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

## Reparaciones encontradas en producción

- Las tarjetas de contratos anidaban enlaces de organización, responsable y fuente dentro del enlace principal. React 19 detectó la divergencia entre el HTML del navegador y el servidor. Se sustituye el enlace envolvente por el enlace del título con área extendida y enlaces secundarios independientes.
- BDNS podía devolver una página HTML en Latin-1: el error JSON de la decodificación alternativa escapaba del bucle de reintentos. Se mantiene esa decodificación dentro del mismo límite de recuperación, con regresión específica.
- La prueba SQL manual creó cachés Python como root dentro del entorno del runner. Se restableció su propietario a `et-runner` y se reparó la instalación con ese usuario. Las verificaciones manuales posteriores deshabilitan la escritura de bytecode.
- Durante la recuperación se observó que `refresh_entity_summary()` bloqueaba lecturas de las fichas públicas. La vista ya dispone de índice único completo; se cambia a refresco concurrente para mantener las fichas disponibles mientras se recalcula.
- La segunda pasada del índice completo reveló que limitar solo las filas modificadas dejaba sin límite las examinadas cuando casi no había cambios. Los lotes ahora limitan primero las filas de origen y avanzan el cursor aunque no escriban documentos; así la ejecución incremental no concentra todo el histórico en una consulta.

## Verificación del índice completo

Tras la primera ejecución con lotes acotados, el índice de búsqueda queda sincronizado
exactamente con las tablas de origen (antes había un tope de 10.000 documentos por tipo):

| Tipo | Filas en origen | Documentos indexados |
|---|---|---|
| organizaciones | 484.851 | 484.851 |
| contratos | 975.924 | 975.924 |
| subvenciones | 369.235 | 369.235 |

No queda ningún contrato con documento ausente o anterior a su última modificación.
El cursor de cada lote se calcula ahora tomando la última fila por orden de `id`, en vez
de un máximo sobre su representación textual: el avance deja de depender de la
intercalación de la base de datos.

## Aviso de hidratación en producción (abierto, sin impacto funcional)

React registra de forma intermitente `error #418` («el HTML del servidor no coincide con
el cliente») en aproximadamente el 12-25 % de las cargas, en cualquier página. Es un error
*recuperable*: React regenera ese subárbol en el cliente.

Lo comprobado:

- El HTML servido es **idéntico byte a byte** entre la compilación local y producción
  (211.110 bytes en `/contratos`, mismas fronteras de Suspense y mismos scripts de
  intercambio). El JavaScript también es el mismo, así que no hay diferencia de marcado.
- No se reproduce contra la misma compilación servida en local (0/18), ni siquiera
  emulando latencia y ancho de banda reducidos (0/12).
- No hay anidamiento inválido: ni enlaces dentro de enlaces, ni bloques dentro de `<p>`
  o `<button>`, en ninguna de las páginas afectadas.
- No hay un proceso antiguo sirviendo en paralelo: un único `next-server` 15.5.25 escucha
  en el puerto de la aplicación y nginx tiene un solo destino.
- Probado `proxy_buffering off` y sin cabecera de *upgrade* en nginx: no cambia la tasa,
  así que la configuración se dejó como estaba.

Como la única variable es el momento de entrega de los fragmentos por red, el aviso
corresponde a la carrera entre la hidratación y el reemplazo de las fronteras de Suspense
transmitidas, no a un defecto del marcado de la aplicación.

Impacto comprobado: ninguno. Las 30 rutas públicas responden 200 con su contenido y
encabezado correctos, sin desbordamiento horizontal en móvil, y una sesión de navegación
completa (filtros por tipo, ficha de contrato, búsqueda desde la cabecera y paginación)
se ejecuta sin un solo error de página.

Queda anotado como pendiente de seguimiento: si se decide cerrarlo, el camino es revisar
las fronteras `loading.tsx` (56 rutas más una global) frente al comportamiento de
transmisión de React 19, no seguir tocando la aplicación a ciegas.

## `/divergencias` devolvía "datos no disponibles"

El barrido de las 30 rutas públicas encontró que `/divergencias` no mostraba su ranking.
Causa: `v_divergence_ranking` era una vista normal sobre `get_divergences()`, que recorre
todo el historial de votos — 3,2 s en producción para 285 filas. Las consultas de la web
se abortan a los 5 s, así que bastaba algo de carga en la base de datos para que la página
cayera a su estado de error.

Se materializa la vista siguiendo el patrón que ya usa el ranking de asistencia, y el
refresco se ejecuta en `congreso.asistencia`, el pipeline diario que ya recalcula esa otra
caché. Las filas no cambian: 285 personas, 285 identificadores distintos y un máximo de
340 divergencias, idéntico a la vista anterior (comprobado contra producción dentro de una
transacción revertida).

Dos detalles necesarios para que funcione:

- `get_divergences()` no fijaba su `search_path`, y tanto la creación como el refresco de
  una vista materializada se ejecutan con uno restringido: sin `ALTER FUNCTION ... SET
  search_path` la población falla con `relation "votes" does not exist`.
- El refresco es concurrente, así que la página sigue leyendo mientras se recalcula; eso
  exige el índice único sobre `politician_id`, que los datos permiten (una militancia
  activa por persona, sin siglas nulas).
