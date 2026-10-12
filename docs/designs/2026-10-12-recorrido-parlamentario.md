# Fase 4 — recorrido parlamentario documentado

Pregunta: ¿qué pasos constan y dónde se comprueban? Presentación y calificación con fechas oficiales, comisión competente, tramitación literal del expediente, ponentes (rol, no autoría), boletines y diarios de sesiones. No reconstruir debates o publicación/vigencia a partir de «aprobada». Una votación puede ser un trámite o una enmienda.

Fuente: Congreso Open Data, los campos originales ya conservados en `initiatives.raw_data.official`. En la muestra real del 12 de octubre, `ProyectosDeLey__20261011050029.json` contiene 115 expedientes y aporta `TRAMITACIONSEGUIDA`, `PONENTES`, `ENLACESBOCG`, `ENLACESDS` y fechas. El origen sigue enlazando proponentes con sus roles propios; un ponente no se convierte en proponente individual. Documentos oficiales distintos no se confunden con una ley en vigor. Sin enlaces BOE en la cobertura, se declara la carencia y se remite al expediente, sin prometer que nunca se publicara una ley.

Se reparan enlaces entre votación e iniciativa en ambas direcciones: misma legislatura y equivalencia únicamente del sufijo vacío `/0000`. No fusionar subexpedientes `/0001` ni números iguales de legislaturas distintas. Errores de consulta de sesiones/proponentes no se presentan como ausencia de actividad. La UI conserva fuente e identificadores de cada expediente.

Sin nueva ingesta ni tabla en este bloque. La tramitación se muestra literalmente para no atribuir significado causal a sus intervalos ni fabricar fechas ausentes. Enlaces de documentos únicos con HTTPS y host oficial Congreso/Senado/BOE; metadatos incompletos se señalan como cobertura, no como hechos inexistentes.

Evidencia: 233 pruebas web, incluida consulta por legislatura en ambos sentidos, sufijos vacíos/subexpedientes, fuentes externas excluidas y no inferencia de ley vigente. Lint, tipos, auditorías y build; navegador con expediente real `121/000001/0000`, fechas 7 y 12 de diciembre de 2023, tramitación y documentos: a 390×844, documento 375 px sin desbordamiento; ponentes desplegados con Enter. Ruta de revisión eliminada. No certifica publicación de este bloque ni aceptación humana.

Siguiente: ampliar actividad de control/intervenciones, sesiones y materias con fuente y versión, tema vivienda, distribuciones económicas, ámbito territorial/financiación y pilotos de fase 5. #64 mergeada con CI verde antes de esta rama; despliegues se verifican por separado.
