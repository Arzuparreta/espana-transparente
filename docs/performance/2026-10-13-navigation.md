# Navegación: diagnóstico y optimización — 13 de octubre de 2026

## Resultado y alcance

Este documento recoge los cambios y las comprobaciones anteriores al despliegue,
con un build de producción de Next 15.5.26, la API pública real y pruebas SQL en
transacciones que terminan en ROLLBACK en el VPS. La aceptación final requiere
verificar la revisión desplegada, nginx, el endpoint interno y la navegación pública.

La comparación de tamaños es de cuerpos HTTP **descomprimidos** (HTML + payload RSC),
no de bytes transferidos con gzip, ni de todo el JavaScript de la página.

| Ruta | Producción anterior, KB | Build local final, KB | Reducción aproximada |
| --- | ---: | ---: | ---: |
| `/diputados` | 1.641 | 707 | 57 % |
| `/territorio` | 1.453 | 307 | 79 % |

En Presupuestos, separar los metadatos de la capa de consultas reduce el
JavaScript de primera carga del build de 237 KB a 121 KB (49 %).

Los tiempos entre producción y localhost no son directamente comparables. En la
primera ejecución local final, Diputados entregó el primer chunk a los 164 ms y
terminó a los 687 ms; las dos repeticiones terminaron a los 51 y 46 ms. Contratos
entregó el primer chunk a los 27 ms y terminó a los 78 ms. La caché de datos podía
estar caliente por pruebas anteriores: estos números **no prueban** el rendimiento
del VPS con toda su caché fría ni el tiempo de pintura del navegador.

## Problemas corregidos

- `ResponsiveLink` desactivaba la precarga automática por defecto. Ahora usa
  `prefetch=null`: Next precarga el shell hasta `loading.tsx` en rutas dinámicas,
  y precarga completa al mostrar intención mediante foco o puntero. Se mantienen
  las opciones explícitas de cada enlace. Las tarjetas de diputados, migas,
  enlaces del mapa y pie usan el mismo componente de navegación.
- La barra usaba un temporizador fijo de 1,8 s y solo observaba el pathname.
  Ahora depende de una transición de React que sobrevive al desmontaje de la
  página. Incluye filtros por query string, preserva cancelaciones de navegación,
  `replace`, `scroll`, enlaces a fragmentos y la semántica de Next para nuevas
  pestañas. Indica la transición de ruta; el shell puede terminarla mientras los
  datos siguen entrando por Suspense.
- Los datos públicos usaban `createBrowserClient` también en el servidor.
  Ahora usan un cliente exclusivamente servidor, sin cookies, persistencia de
  sesión o refresco de Auth. Conserva la clave pública y las mismas políticas
  de lectura; no usa service-role. `SUPABASE_INTERNAL_URL`, opcional, permite
  consultar la misma instancia por loopback en el VPS.
- Las consultas compartidas tienen deduplicación por render (React `cache`) y
  por peticiones concurrentes en el mismo proceso. Los resultados y errores
  terminados se eliminan del mapa; Next sigue gobernando la frescura persistente.
  Un error permite reintentar. Esto no comparte peticiones entre procesos PM2.
- Metadata y ficha de diputados/senadores reutilizan la misma consulta cacheada
  en lugar de hacer una consulta adicional de nombre en cada visita.
- El atlas descargaba el catálogo municipal y población municipal aunque solo
  pinta comunidades y provincias. Ahora filtra el catálogo y la población en la
  consulta. Los agregados de gasto y todos los años se conservan. La paginación
  de tablas tiene orden estable para no perder o duplicar filas.
- El directorio renderizaba 354 tarjetas inmediatamente. Ahora renderiza 36,
  permite cargar bloques de 36 y conserva la búsqueda sobre todas las personas.
  También deja de descargar logos de partido que no se muestran.
- Los metadatos del presupuesto se separan de las consultas servidor para que
  `PresupuestosClient` importe únicamente constantes y funciones puras.
- El fetch elimina su listener de abort al terminar, evitando retener callbacks
  sobre señales reutilizadas.
- La configuración nginx versionada desactiva buffering en ambos upstreams de
  Next. Se contrastó con la configuración activa del VPS y se conserva su listener
  IPv4 en `127.0.0.1:8443`, detrás del proxy TLS del host.

## Validación

Build de producción y comprobación de tipos correctos. Suite: 373 pruebas, 104
ficheros, incluyendo concurrencia, recuperación tras fallo, selección territorial,
query strings, veto de navegación y fragmentos. En navegador: carga progresiva,
búsqueda de personas fuera de las 36 iniciales y navegación a una ficha, mostrando
primero el shell y después la ficha completa, sin avisos ni errores de consola en
ese recorrido. También se verificó el cambio de ejercicio presupuestario
y doce rutas principales y de paginación respondieron 200 sin el marcador de
error de Next. En ese barrido, Subvenciones tardó 2,37 s y Votaciones 3,25 s
en completar su respuesta: sigue habiendo trabajo de perfilado de consultas
para las rutas frías; no se declara resuelto todo el rendimiento SQL.

Para repetir la medición HTTP:

```bash
cd web
npm run build
npm run start -- --port 3100
# En otro terminal:
npm run perf:navigation -- http://localhost:3100
npm run perf:navigation -- https://spaintransparencia.info
```

## Perfilado del VPS y segunda fase

En el VPS, la petición de muestra a la API pública tardó 334 ms frente a 16 ms
por loopback; ambos endpoints se verificaron contra la misma fila de la misma
instancia usando la clave pública. La consulta del listado base de subvenciones
tardó 15 ms, y con recuento exacto 342 ms. Se separa y cachea el recuento por tipo
(o nivel en subvenciones), sin repetirlo para cada página de la misma colección.
Los filtros más específicos conservan sus recuentos exactos.

La vista `v_voting_session_summary`, filtrada a 30 IDs, devolvió timeout en REST
(3,1 s) y superó 15 s en EXPLAIN. Antes, el cliente ignoraba ese error y cacheaba
los resultados sin recuentos. La nueva RPC `get_voting_session_tallies` limita
los votos antes de agregarlos: 30 votaciones en 239 ms en la prueba SQL del VPS.
Coincide exactamente con la vista en una muestra de 8 votaciones de ambas
cámaras (2.443 votos). Se prueba además con empates, personas sin partido,
afiliaciones inactivas, cámaras distintas, `No vota` y sesiones vacías en una
base de datos desechable. La RPC es SECURITY INVOKER, respeta RLS, limita a 100
IDs y el frontend rechaza errores y resultados incompletos antes de cachearlos.

La cabecera precarga shells en lugar de cargar cinco páginas completas en cada
entrada. La precarga por puntero espera 120 ms y se cancela al abandonar el enlace,
evita disparar consultas al recorrer rápidamente listas. Foco y clic conservan
su respuesta inmediata.

El despliegue construye una release aislada bajo `/opt/espana-transparente/releases`,
con dependencias independientes, sin sustituir el build ni `node_modules` del
proceso que sirve tráfico. Verifica el endpoint interno, conserva assets hash de
versiones anteriores y valida nginx. Primero sirve una instancia temporal
comprobada en loopback; recrea el proceso principal mientras esa instancia sirve
tráfico y después devuelve nginx al puerto principal. Comprueba
revisión y base de datos, con rollback automático de proceso y nginx ante fallo.
Mantiene tres releases y la caché se poda en el directorio realmente servido.
Las credenciales se copian solo en el host con permisos privados. El transporte
SSR y del middleware usa también el endpoint interno con un timeout, conservando
la URL pública para el nombre y ámbito de las cookies de sesión. La suite Python
local pasó 532 pruebas, incluida la paridad SQL en PostgreSQL 16 desechable; una
integración de búsqueda quedó omitida por requerir otra conexión explícita.

Se mantienen los totales exactos, las políticas de lectura y la verificación de
sesiones autenticadas. El layout conserva render dinámico para que el build no
dependa de la disponibilidad de la base de datos. La comprobación final incluye
las rutas sin precarga, filtros, enlaces de detalle y las APIs públicas de salud.

Medir también p50/p95 de clic a shell y clic a contenido bajo red móvil, con y sin
sesión, volver/avanzar y navegación interrumpida; la prueba HTTP no sustituye
estas mediciones ni constituye una garantía de ausencia de fallos.

Referencias oficiales:
[precarga y onNavigate de Next 15](https://nextjs.org/docs/15/app/api-reference/components/link),
[streaming en self-hosting](https://nextjs.org/docs/15/app/guides/self-hosting).
No se ha activado `staleTimes`, que Next documenta como experimental y no
recomendado para producción.

## Correcciones detectadas en la aceptación pública

El primer barrido de 69 rutas detectó un timeout real en `/dinero-publico`.
Se materializan las dos vistas históricas de principales receptores y de
asociación con Kohesio, conservando sus consultas originales. Son 364 y 47 filas,
272 y 72 KB incluidos sus índices: no se copia el corpus de millones de registros.
El ETL diario/semanal de `common.search_refresh` refresca ambos snapshots en la
misma transacción. El portal muestra el corte del agregado; los fallos no se
sustituyen por totales cero. Las funciones de normalización conservan exactamente
su algoritmo y referencian explícitamente `public.unaccent` para funcionar durante
la materialización con search_path restringido. Las pruebas SQL comprueban refresh,
normalización, permisos de solo lectura y RLS de la RPC de estadísticas del Senado.

El Senado deja de contar usando la vista global de divergencias: una RPC invoker
cuenta sesiones distintas con voto y filas de voto reales. No se cachea un fallo
como cero. Su directorio muestra 36 tarjetas inicialmente y conserva búsqueda
sobre toda la cámara. La ficha de votación deja de renderizar los cientos de votos
individuales dentro de un `details` cerrado: los carga al abrirlo, con búsqueda
y bloques de 50, manteniendo el detalle completo disponible. Los enlaces a
senadores van directamente a su ficha, sin pasar por una redirección de diputado.

La comprobación de fichas frías encontró además la consulta global de resultados
parlamentarios en partidos y `get_politician_divergences()` sobre todo el corpus.
Se reutiliza la caché diaria de divergencias con la misma correspondencia de
nombre/título/fecha, y las estadísticas públicas de partido se precalculan en
22 filas. Las 30 votaciones recientes se leen de la tabla base y sus resultados
se calculan con las RPC acotadas. Los votos de sus miembros se agregan en SQL,
evita truncarlos a las 1.000 filas de REST. La regresión PostgreSQL comprueba
1.500 votos y afiliaciones duplicadas, conservando los recuentos correctos.

Las fichas de partido envían datos compactos a un panel cliente: renderizan
30 diputados inicialmente, con búsqueda sobre todos y ampliación por bloques.
Las votaciones y casos se renderizan cuando se abre su pestaña, evitando enviar
su HTML oculto. Las pestañas de presentación usan `history.replaceState`,
integrado con el router de Next, sin volver a solicitar datos que ya están
cargados. Conservan enlaces directos y los demás parámetros de consulta.
La regresión comprueba el límite de filas, el panel inactivo y una URL directa
a votaciones con sus porcentajes completos. Validación final local: 375 tests
web en 105 archivos, build, lint y auditorías de UI/contenido; 532 tests Python
pasados y uno omitido por requerir otra integración de base de datos.

La aceptación posterior al despliegue detectó un timeout transitorio en Senado.
`votes` llevaba 15 días sin vacuum/analyze y el plan leía casi un millón de filas,
con ordenación en disco. Tras `VACUUM (ANALYZE) public.votes`, la misma consulta
invoker usa el índice de sesiones sin lecturas de heap: 119 ms frente a 1.526 ms
en los planes medidos. La migración de mantenimiento reduce los umbrales de
autovacuum y actualización de estadísticas únicamente para esa tabla, para que
los nuevos lotes del ETL no mantengan estadísticas y visibilidad obsoletas.

La ficha de partido de 139 diputados pasa de aproximadamente 535 a 147 KB de
HTML/RSC descomprimidos (72%). Las tres peticiones públicas medidas después
respondieron 200 y terminaron en 1,67–2,69 s durante el barrido concurrente;
no se presentan como una medición de pintura ni como caché totalmente fría.
