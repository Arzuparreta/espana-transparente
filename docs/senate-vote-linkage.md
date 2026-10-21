# Vinculación nominal del Senado: alcance y validación

La PR repara atribución de votos de la legislatura XV. No modifica la
vinculación del Congreso, contratos, subvenciones ni otros conjuntos de datos.

## Qué cambia

- Las coincidencias normales siguen siendo automáticas: nombres normalizados,
  variantes con y sin partículas y una única persona candidata del Senado XV.
  Las identidades ambiguas permanecen pendientes; no se usa similitud aproximada.
- La variante publicada `EDUARDO PUJOL BONELL` se vincula al identificador oficial
  `20013`, cuya ficha dice `PUJOL BONELL, EDUARD`. El enlace exige una única
  persona con ese identificador y pertenencia al Senado XV; si falta, está
  duplicado o contradice una coincidencia nominal, se conserva como pendiente.
- Cada voto mantiene el nombre y URL originales y, cuando corresponde, las
  fuentes de la equivalencia. La etiqueta oficial plural `No votan` se conserva
  como `No vota`, diferenciada de una ausencia mediante `absent`.
- Una etiqueta desconocida o una estructura que descarte filas nominales hace
  fallar la validación. Dos filas atribuidas a la misma persona en una votación
  también fallan: no se ocultan duplicados bajo un recuento de cobertura.
- Cada ejecución reconcilia las sesiones publicadas, también con `--resume`.
  Una sesión que ya contiene algún voto puede seguir estando incompleta.
- Se retiran del registro de pendientes únicamente las claves de ocurrencias
  que acaban de quedar vinculadas en la misma transacción. Las ocurrencias aún
  pendientes y los contadores antiguos sin claves se conservan. El registro
  histórico no se usa como denominador de cobertura.

## Fuentes de la equivalencia

- [Ficha oficial, identificador 20013](https://www.senado.es/web/composicionorganizacion/senadores/composicionsenado/fichasenador/index.html?id1=20013&legis=15).
- [Sesión oficial con las formas Eduard y Eduardo](https://www.senado.es/web/actividadparlamentaria/sesionesplenarias/pleno/rwdsesionespleno/detalle/index.html?id=47&lang=gl_ES&legis=15&ns=48).
- Los XML de votaciones contienen nombre, grupo, escaño y voto; no incluyen
  identificador de senador. Por eso esta excepción requiere evidencia explícita.

## Cobertura de la instantánea revisada

Fuente: 77 XML publicados hasta la sesión 83, con 973 votaciones, revisados el
20 de octubre de 2026. Los cinco enlaces de catálogo que devolvieron un 404
confirmado (sesiones 1, 20, 27, 29 y 36) quedan declarados en el manifiesto;
no se inventan registros para ellos.

| Medida | Registros |
| --- | ---: |
| Filas nominales publicadas, incluidas ausencias y no participación | 258.328 |
| Filas que aceptaba el lector anterior | 256.019 |
| Filas previamente vinculadas en producción | 255.692 |
| Filas aceptadas pero sin vínculo por la variante Eduardo/Eduard | 327 |
| Filas `No votan` que descartaba el lector anterior | 2.309 |
| Objetivo tras reprocesar: vínculos sobre todas las filas publicadas | 258.328 / 258.328 |

El 99,87 % anterior medía solo las filas aceptadas por el lector; sobre todas las
filas nominales publicadas, la base real era 98,98 %. La propuesta recupera
2.636 registros respecto a los 255.692 almacenados, incluidos los siete
`No votan` adicionales con la variante Eduardo (334 apariciones totales de esa
variante en los XML). El 100 % se refiere exclusivamente a esta instantánea,
y su materialización en producción se verifica después de la integración
autorizada. No es una garantía sobre futuras publicaciones ni otros datos.

## Contraste con el resto de datos

| Datos | Vínculo relevante |
| --- | --- |
| Senado, con esta PR | Nombre normalizado único; variantes excepcionales documentadas mediante identificador oficial; pendientes explícitos y contraste fila por fila |
| Votaciones del Congreso | Búsqueda por nombre; esta PR no modifica su mecanismo ni certifica su cobertura |
| Contratos o convocatorias BDNS | Sus identificadores oficiales identifican contratos o convocatorias; no prueban por sí mismos la identidad de una persona |

## Comprobaciones

Los tests usan PostgreSQL desechable en CI: identidad ausente o duplicada,
otra cámara o legislatura, homónimos, ambigüedad, nombres desconocidos,
reprocesado sin duplicados, limpieza selectiva de pendientes, conservación de
contadores históricos, etiquetas plurales, cambios de estructura y comparación
de persona, sentido del voto y evidencia original.

La auditoría previa usa XML públicos y consultas agregadas de solo lectura.
No inserta votos ni ejecuta código de la PR con credenciales de producción.
Las ejecuciones de auditoría quedan enlazadas en la descripción de la PR.

Tras una integración expresamente autorizada, el workflow descarga un
manifiesto nuevo, reprocesa el corpus y exige que cada fila almacenada coincida
con la persona, el voto, el nombre original, grupo, escaño, ausencia y URL del
XML. Una fila pendiente o una discrepancia produce un fallo, aunque los
recuentos globales coincidan.
