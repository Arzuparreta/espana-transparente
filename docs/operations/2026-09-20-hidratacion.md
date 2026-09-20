# Aviso de hidratación React #418: lo corregido y lo que queda

Seguimiento de la incidencia abierta en
[`2026-09-14-maintenance.md`](2026-09-14-maintenance.md): React registra de forma
intermitente el error recuperable `#418` («el HTML del servidor no coincide con
el cliente») en la primera carga de cualquier página.

**Estado: corregidos tres desajustes reales de la aplicación; el aviso sigue
apareciendo en producción con el árbol servido y el hidratado idénticos.** Lo
que queda encaja con un fallo de React, no con el marcado del sitio.

## Reproducción

El aviso solo aparece cuando el cliente va rápido. Con Chromium headless contra
producción, 45 cargas repartidas en tres perfiles de red:

| Perfil | Errores |
|---|---|
| 3G lento (400 ms, 400 kb/s, CPU ×6) | 0/15 |
| 3G rápido (150 ms, 1,6 Mb/s, CPU ×4) | 0/15 |
| Cable (20 ms, 20 Mb/s, sin limitar CPU) | 3/15 |

No es un problema de lentitud: es que la hidratación empieza antes de que el
documento acabe de asentarse. Por eso no se reproducía en local: servido desde
`localhost` todo llega antes de que se ejecute el JavaScript. Emulando 60 ms de
latencia contra una compilación de producción local aparece en el 15-20 % de las
cargas (3/20 y 4/20 en `/contratos`), y eso permitió medir hipótesis en vez de
seguir tocando la aplicación a ciegas.

## Lo corregido

**1. Frontera de carga raíz duplicada.** `app/loading.tsx` envolvía el layout
entero en una frontera de Suspense que se solapaba con la que declara cada ruta:
la misma región del documento se sustituía dos veces. Medido en `/contratos`, 20
cargas por configuración con 60 ms de latencia:

| Fronteras declaradas | Errores |
|---|---|
| `app/loading.tsx` + `contratos/loading.tsx` | 3/20 y 4/20 |
| solo `contratos/loading.tsx` | 0/20 |
| solo `app/loading.tsx` | 0/20 |
| ninguna | 0/20 |

La portada pasa a `src/app/(home)/` con su propia `loading.tsx`, de modo que cada
ruta declara exactamente una frontera y la portada conserva esqueleto y emisión
por partes. `npm run ui:audit` rechaza ahora un `loading.tsx` raíz; la regla
anterior era la que obligaba a mantenerlo.

**2. `MoneyFlowExplorer` leía `matchMedia` durante el render.** Por debajo de
1024 px el primer render del cliente no coincidía con el HTML servido (panel
móvil y sus atributos `aria`). Se reproducía en local: 2 de 8 cargas de
`/dinero-publico` a 390 px en desarrollo, que informa del desajuste con el árbol
completo. Ahora empieza en `false` en ambos lados y el efecto aplica el valor
real tras montar: 12/12 cargas limpias.

**3. La cabecera esperaba a la sesión para pintarse.** El servidor no conoce la
sesión —vive en el navegador—, así que `{!loading && …}` hacía que el primer
render del cliente añadiera el botón «Iniciar sesión» que el HTML servido no
tenía. Ahora ese botón forma parte del HTML servido y solo cambia para quien
tiene sesión; el proveedor aplica la sesión dentro de `startTransition`. El texto
servido y el hidratado de `/contratos` coinciden ahora exactamente (antes se
diferenciaban justo en ese botón).

## Lo que queda

Producción, mismo barrido (45 cargas, `/`, `/contratos`, `/diputados`, 20 ms):
7/45 antes de los cambios, 9/45 después del primero, 11/45 después del segundo.
Dentro del ruido: el aviso no ha cambiado de frecuencia.

Qué se sabe de lo que queda, con el estado actual desplegado:

- **Los árboles son idénticos.** Capturando `document.body` en el instante en que
  React informa del error y comparándolo con el resultado final, la única
  diferencia es el `next-route-announcer` que Next añade después. La estructura
  de `<body>` en el fotograma anterior al fallo es idéntica a la de las cargas
  que no fallan.
- **No es el momento de llegada del HTML.** En la carga fallida analizada, el
  documento llevaba 260 ms sin cambios cuando React informó del error.
- **Retrasar el JavaScript reduce pero no elimina.** Sirviendo los chunks con
  1,5 s de retraso —documento entero ya analizado— el aviso baja a 1/12.
- **No es la metadata.** Forzar metadata bloqueante (`htmlLimitedBots`) deja el
  aviso igual: 13 % con agente de bot contra 20 % con agente normal.

Todo eso encaja con [react/react#37584](https://github.com/react/react/issues/37584)
(«hydration cursor is not rewound when a host fiber is replayed, so hydration
fails on an identical tree», 11 de septiembre de 2026, sin confirmar por el
equipo de React): la hidratación falla sobre un árbol idéntico cuando un chunk de
Flight se resuelve dentro de la ventana de cesión de React. Es lo que observamos.
No hay corrección publicada; el proyecto va con React 19.3.0 y Next 15.5.25.

**Decisión (20 de septiembre): se deja anotado.** Impacto comprobado: ninguno —el
error es recuperable y la página final es correcta—, así que no se paga por él ni
el esqueleto de carga ni el TTFB. Queda registrado en `NEXT.md` (Open Questions).

Las dos alternativas se descartan por ahora, no por imposibles:

- **Renunciar a la emisión por partes** (quitar todas las `loading.tsx` y servir
  metadata bloqueante) para que no queden chunks resolviéndose tarde. Sin medir;
  cuesta el esqueleto de carga en todas las rutas y mueve el TTFB al tiempo de
  render completo. Retrasar el JavaScript 1,5 s solo bajó a 1/12, así que
  tampoco hay garantía de que lo elimine.
- **Esperar a React.** Revisar la incidencia de arriba al actualizar React o Next
  y repetir el barrido descrito abajo antes de dar nada por corregido.

## Cómo repetir la medición

Chromium headless, contexto nuevo y caché desactivada por carga, perfil de red
«cable» (20 ms de latencia, 20 Mb/s), contando errores de página que contengan
`418`. 45 cargas repartidas entre `/`, `/contratos` y `/diputados` bastan para
distinguir «16-20 %» de «0 %», no para distinguir 16 % de 24 %.
