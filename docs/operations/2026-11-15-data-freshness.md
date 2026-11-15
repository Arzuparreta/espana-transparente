# Recuperación de frescura: financiación territorial y Senado

El aviso del 15 de noviembre de 2026 devolvía HTTP 503 con dos incidencias
entre las 56 fuentes críticas. La conexión de la aplicación a PostgreSQL
funcionaba correctamente.

- `presupuestos.financiacion`: `ConnectTimeout` el 9 de noviembre. El VPS
  sigue sin establecer conexión HTTPS con `www.hacienda.gob.es`; desde este
  equipo el mismo URL oficial descarga un Excel válido. No era un cambio
  del formato ni de la conciliación de importes.
- `senado.votaciones`: última ingesta correcta del 2 de noviembre. El exportador
  alojado en GitHub recibió un 403 al sondear `ses_61.xml`. Al faltar el
  artefacto, el lote intentó abrir un `manifest.json` inexistente. El error
  sucedía antes de crear el registro ETL, por eso el monitor mostraba retraso
  en vez de la causa del fallo.

Ejecución que permite reproducir el diagnóstico:
<https://github.com/Arzuparreta/espana-transparente/actions/runs/42649485630>.

## Correcciones

La descarga de Hacienda se hace en un job de GitHub sin acceso a la base de
datos, antes del lote semanal de enlaces. Transfiere el Excel original,
su SHA-256, URL oficial y fecha de descarga. El consumidor rechaza otro origen,
versiones desconocidas, alteraciones y descargas de más de dos días o con fecha
futura; vuelve a ejecutar todas las conciliaciones antes de guardar. Las
conexiones tienen dos reintentos y un tiempo de conexión de diez segundos.

El exportador del Senado tiene tres intentos acotados. Cada exportación retira
el manifiesto anterior antes de empezar, para que un fallo no parezca una
descarga nueva completa. Un 403 persistente sigue siendo un fallo: no se
interpreta como final del catálogo ni como ausencia de votos.

Ambos artefactos se descargan fuera del checkout, en el directorio temporal
del runner. Si no hay manifiesto, el lote intenta la fuente directamente;
si el manifiesto existe pero es inválido, la validación falla. Los lotes siguen
ejecutando las otras fuentes y devuelven error si alguna ingesta falla.
El Senado abre su registro ETL antes de descubrir o cargar las fuentes;
también quedan registrados los bloqueos HTTP y los manifiestos ausentes.

No se amplían los umbrales de frescura ni se retiran fuentes del monitor.

## Recuperación operativa

Se descargaron de nuevo los originales oficiales desde una conexión que sí
accede a las fuentes: 17 territorios y 77 XML del Senado, con 973 votaciones
y 258.328 filas nominales. Las cinco URLs de catálogo con HTTP 404 confirmado
quedan declaradas en el manifiesto. La recuperación usa los ETLs de `main`
servidos en producción (`7afd31e`), con estos originales como entrada; no
requiere sustituir el checkout del VPS ni desplegar código sin integrar.

Para recuperar a través de los comandos nuevos, una vez integrados:

```bash
cd etl
PYTHONPATH=src python -m src.presupuestos.financiacion --export-directory /tmp/financing
PYTHONPATH=src python -m src.senado.votaciones --export-directory /tmp/senate
# Transferir ambos directorios al host que ejecuta las ingestas.
PYTHONPATH=src python -m src.presupuestos.financiacion --from-directory /tmp/financing
PYTHONPATH=src python -m src.senado.votaciones --from-directory /tmp/senate
```

La ingesta necesita las credenciales habituales del host; la exportación no
abre la base de datos. La comprobación final debe contrastar el snapshot de
financiación y cada fila nominal del Senado con los originales, y exigir
HTTP 200 con `issues=[]` en `/api/data-health`.

Las pruebas completas también detectaron una fecha fija en la prueba de
capacidad de BDNS: al cumplir 30 días, el descriptor dejaba de ser reciente
y cambiaba la selección esperada. La prueba ahora crea el descriptor reciente
con la fecha actual y conserva el caso explícito de caducidad.

## Verificación realizada

- Financiación: registro `succeeded` a las 08:31:50 UTC, 17 territorios y
  snapshot almacenado idéntico al obtenido del Excel recién descargado.
- Senado: registro `succeeded` a las 08:33:01 UTC, 258.328 filas nominales
  almacenadas y contrastadas individualmente con los originales; cero pendientes
  en este corpus.
- `/api/data-health`: HTTP 200, `status=ok`, `monitored=56`, `issues=[]`.
- `/financiacion-territorial` y `/senado`: HTTP 200.
- [Nueva ejecución de Data freshness correcta](https://github.com/Arzuparreta/espana-transparente/actions/runs/43695075505).
- Pruebas ETL con PostgreSQL desechable: 586 correctas, una integración opcional
  de búsqueda omitida. Actionlint valida los dos workflows, reconociendo la
  etiqueta personalizada del runner; `bash -n` y `git diff --check` correctos.

La recuperación ya está aplicada. Los cambios preventivos del código y los
workflows se han validado localmente; aún requieren publicación e integración
para que los use la siguiente ejecución programada. El nuevo job de descarga
de Hacienda deberá verificarse también desde el runner de GitHub al publicarlo.
