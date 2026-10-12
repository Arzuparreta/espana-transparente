# Cobertura BDNS y ayudas con identidad ocultada

Estudio implementado después de la PR #79. Pendiente de CI remoto y merge.

- Pregunta: ¿qué deja fuera la ingesta actual y qué se puede representar sin reconstruir identidades?
- Respuesta esperada: distinguir cobertura del SNPSAP, muestra consultada y registros retenidos por el portal. Un beneficiario con asteriscos no prueba anonimización irreversible ni equivale por sí solo a un hogar. Una etiqueta visible tampoco prueba que sea una organización.
- Medida: perfil de cobertura de una muestra acotada, sin importe individual, nombre, NIF, identificador de persona/concesión ni enlace de expediente en la salida. Páginas leídas, registros declarados/recibidos, duplicados y fechas fuera de alcance; estados de identidad visible/ocultada/ausente y de importe ausente/cero, con límites de inferencia.
- Periodo: ventana explícita de concesión; fecha de alta es distinta. Primera página ordenada no es muestra aleatoria ni permite estimar proporciones nacionales. La API es dinámica; una fecha de extracción no fija para siempre las correcciones o retiradas.
- Fuente: API concesiones SNPSAP y [aviso global vigente](https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal), verificado en navegador el 12/10/2026. Front/back 1.2.3/1.2.4 y última actualización indicada 12/10/2026. El HTML inicial es una aplicación vacía y no acredita el texto legal; se leyó el aviso renderizado.
- Reutilización: el aviso autoriza usos comerciales y no comerciales; limita el tratamiento personal al control de gestores o a fines históricos, estadísticos y científicos con disociación previa. Exige fuente, actualización y condiciones conservadas, atribuir la disociación y evitar insinuar patrocinio IGAE. Determinadas ayudas protegidas no se publican. Los plazos de publicidad difieren para personas físicas y otros casos, con excepciones europeas. No tratar la publicidad SNPSAP como toda la BDNS.
- Riesgo: grupos pequeños, convocatorias locales, fechas e importes singulares, cruces y resta de totales pueden identificar destinatarios aunque se oculten nombres. Un umbral de tamaño aislado no garantiza disociación. No cruzar etiquetas ocultadas con organizaciones, NIF, domicilios, beneficiarios de otros fondos o expedientes para revelar personas.
- Interpretación a impedir: proporción de una página igual a cobertura nacional; concesiones publicadas igual a todas las ayudas; identidad visible igual a entidad jurídica; ausencia de importe igual a cero; ayuda equivalente igual a importe concedido o pagado.
- Decisión de diseño a comprobar: perfil técnico efímero, acotado y sin microdatos persistidos. Antes de un agregado público ampliado, diseñar agrupación amplia, supresión complementaria frente a diferencias, control de dominancia y actualización/retirada; sin filtros que permitan deshacer la disociación. No expandir la ingesta de identidades por este estudio.
- Aceptación: pruebas sintéticas de campos sensibles ausentes en salida, paginación truncada declarada, fechas, duplicados, importes nulos/cero y errores de fuente. Documentar la muestra y la decisión; reparar la explicación de cobertura actual según lo efectivamente comprobado. La auditoría general y el despliegue siguen pendientes.

## Evidencia exploratoria, sin extrapolación

Consulta TLS verificada del 12/10/2026: concesiones del 01/10/2026, primera página, tamaño 10. La API declara 75.709 registros y 7.571 páginas; se leyeron diez, todos con fecha de concesión 01/10/2026 y alta 12/10/2026. Nueve etiquetas empiezan con asterisco, una es visible; ninguno carece de importe. Es una página ordenada, no un censo ni una muestra representativa. No se conservaron nombres, identificadores ni importes individuales en el estudio.

El método actual `_is_organization` solo excluye etiqueta ausente o que empieza con asterisco. Esa regla explica una exclusión, pero no valida personalidad jurídica. La página `/subvenciones` afirma actualmente que solo conserva organizaciones y que todos los individuales están anonimizados; la afirmación necesita corregirse o respaldarse mediante identificación jurídica verificada.

## Resultado y decisión

Perfil reproducible: `PYTHONPATH=etl/src etl/.venv/bin/python -m bdns.coverage_study --from-date 2026-10-01 --to-date 2026-10-01 --page-size 200 --max-pages 1`. Descarga verificada el 12/10/2026: 200 registros únicos, 192 etiquetas ocultadas y ocho visibles; sin fecha fuera de ventana, duplicados o importes ausentes/cero. La API declara 75.709 registros: consulta incompleta, primera página ordenada, sin extrapolación. El programa no emite importes, nombres, identificadores ni enlaces de expediente y no escribe microdatos ni tablas. Máximo cinco páginas de 200 filas y ventana de 31 días; errores sin contenido personal.

La exclusión actual tiene impacto material en esa consulta y no permite describir el corpus como todas las ayudas o como organizaciones verificadas. Se corrige esa explicación en subvenciones y finalidades, y se renombra el predicado de ingesta para expresar lo que comprueba: etiqueta visible. También excluye espacios vacíos y asteriscos precedidos de espacios.

Decisión: no publicar agregados ampliados a partir de estas páginas parciales ni reconstruir personas. La vía agregada necesita una fuente completa por periodo, clasificación de finalidad independiente de identidad, actualización/retirada y evaluación de divulgación por agrupación y diferencias. El estudio requerido se completa con evidencia de cobertura y condiciones; no se considera implantada una cobertura de hogares que aún no existe. La matriz transversal debe conservar esta limitación.

El aviso exige revisar finalidad y disociación, pero no demuestra que cualquier agregado sea anónimo. Los riesgos de celdas pequeñas, dominancia y cruces son criterios de diseño del portal, no una garantía jurídica basada en un umbral arbitrario. El análisis de campos es efímero y usa pruebas sintéticas, sin fixtures de personas reales.

## Validación

19 pruebas específicas del perfil y una regresión del filtro de etiquetas pasan. Suite ETL local: 481 pasan y 17 integraciones omitidas al no configurar PostgreSQL aislado en este bloque; la CI remota realiza sus integraciones configuradas. Suite web: 323 pruebas pasan; lint, auditoría UI (483 archivos) y contenido (400 archivos, 29/29 indicadores) pasan. Build final pasa. No se ha ampliado ninguna tabla de beneficiarios ni se afirma aceptación humana.
