# Aviso de hidratación React #418: causa y cierre

Queda cerrada la incidencia abierta en
[`2026-09-14-maintenance.md`](2026-09-14-maintenance.md): React registraba de
forma intermitente el error recuperable `#418` («el HTML del servidor no
coincide con el cliente») en la primera carga de cualquier página.

## Reproducción

El aviso solo aparece cuando el cliente va rápido. Con Chromium headless contra
producción, 45 cargas repartidas en tres perfiles de red:

| Perfil | Errores |
|---|---|
| 3G lento (400 ms, 400 kb/s, CPU ×6) | 0/15 |
| 3G rápido (150 ms, 1,6 Mb/s, CPU ×4) | 0/15 |
| Cable (20 ms, 20 Mb/s, sin limitar CPU) | 3/15 |

No es un problema de lentitud: es que la hidratación empieza antes de que el
HTML termine de llegar. Esa es también la razón por la que no se reproducía en
local: servida desde `localhost` la latencia es nula y el documento entero llega
antes de que se ejecute el JavaScript. Emulando 60 ms de latencia contra una
compilación de producción local, el error aparece en el 15-20 % de las cargas
(3/20 y 4/20 en `/contratos`), que es lo que hacía falta para poder medir cada
hipótesis en lugar de seguir tocando la aplicación a ciegas.

## Causa

La traza de mutaciones del DOM sobre una carga fallida sitúa el error unos 90 ms
**después** de que todos los intercambios de fronteras (`$RC`) y el
`DOMContentLoaded` hayan terminado, y muestra a React vaciando y regenerando el
cuerpo entero de la página. El texto servido y el hidratado coinciden, así que
no había ninguna diferencia de datos ni de marcado que corregir.

Midiendo por configuración en `/contratos` (20 cargas cada una, 60 ms de
latencia):

| Fronteras de carga declaradas | Errores |
|---|---|
| `app/loading.tsx` + `contratos/loading.tsx` (la de producción) | 3/20 y 4/20 |
| solo `contratos/loading.tsx` | 0/20 |
| solo `app/loading.tsx` | 0/20 |
| ninguna | 0/20 |

El `loading.tsx` raíz envolvía el layout completo en una frontera de Suspense
que se solapa con la que declara cada ruta: la misma región del documento se
sustituye dos veces, y cuando el segundo intercambio cae dentro de la ventana de
hidratación React descarta el árbol y lo rehace en el cliente. Con una sola
frontera —da igual cuál— el error desaparece. Las rutas de detalle, que anidan
la frontera del índice con la suya (`/contratos/[id]`, `/presupuestos/[section]`),
no lo reproducen: el problema es la frontera raíz, no el anidamiento en general.

## Corrección

- Se elimina `web/src/app/loading.tsx`. La portada pasa a `web/src/app/(home)/`
  con su propia `loading.tsx`, de modo que cada ruta declara exactamente una
  frontera y la portada conserva su esqueleto y su emisión por partes.
- `npm run ui:audit` exige ahora que no exista `src/app/loading.tsx`, además de
  seguir exigiendo una junto a cada página. La regla anterior era la que obligaba
  a mantener la frontera raíz.
- `MoneyFlowExplorer` leía `matchMedia` durante el render: por debajo de 1024 px
  el primer render del cliente no coincidía con el HTML servido (panel móvil y
  sus atributos `aria`). Ahora empieza en `false` en ambos lados y el efecto
  aplica el valor real tras montar. Este fallo sí se reproducía en local: 2 de 8
  cargas de `/dinero-publico` a 390 px con el servidor de desarrollo, que
  informa del desajuste con el árbol completo.

## Descartado por medición

- **El marcado y los datos.** Comparando el texto servido (con el bundle de
  React bloqueado) contra el hidratado, `/`, `/contratos` y `/diputados`
  coinciden salvo lo que cambia legítimamente tras montar.
- **La metadata en streaming.** Next emite `<title>` y `<meta>` dentro de
  `<body>` y React los sube a `<head>` en el navegador. Forzar metadata
  bloqueante para todos los agentes (`htmlLimitedBots`) dejó el error igual
  (4/20), así que ese cambio no se conserva.
- **La carrera con los scripts de intercambio de fronteras.** El error llega
  después de que terminen, no durante.

## Verificación

- Local (compilación de producción, 60 ms de latencia): 0/30 en `/`,
  `/contratos` y `/diputados`; antes del cambio, 3/20 y 4/20 solo en
  `/contratos`. Con las fronteras corregidas tampoco fallan `/contratos/[id]`
  ni `/presupuestos/[section]` (0/8 cada una).
- `/dinero-publico` a 390 px en desarrollo: 12/12 cargas sin desajuste.
- Pruebas web (135), lint y auditorías de UI y contenido correctas.
- Producción antes del despliegue, con el mismo barrido que se repite después:
  7/45 (16 %) — `/` 5/15, `/contratos` 2/15, `/diputados` 0/15.
