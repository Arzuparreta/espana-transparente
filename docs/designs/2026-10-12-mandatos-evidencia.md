# Fase 3 — mandatos, fechas y evidencia de las asociaciones

Pregunta: ¿qué cargo consta en la fecha del registro y qué documento respalda el vínculo? La coincidencia de órgano y fecha es una asociación institucional; no acredita firma ni decisión personal.

Correcciones:

- Resolución contractual: usar fecha de adjudicación si consta, publicación como alternativa visible. El ETL PCSP distingue ambas; antes la resolución usaba siempre publicación. Se recalculan las asociaciones de las vistas existentes con la fecha pertinente, sin fabricar adjudicaciones ausentes.
- Nuevas vistas de contexto de contrato/ayuda: ID del mandato y de la persona, rol, inicio/cese, documento del cargo, fecha y base de asociación, método y número de mandatos distintos candidatos. No se cuentan como ambigüedad métodos duplicados para el mismo mandato. Se conserva la selección priorizada y se declara cuando no es exclusiva.
- Fichas de contrato y concesión: evidencia de nombramiento/mandato separada del expediente y actuaciones del registro. Fuente del cargo ausente, falta de asociación y ausencia de documento de actuación explícitas. No presentar como firma los nombres sin documento de `contract_signers`; su modelo histórico no tiene fuente suficiente.
- Contratos ministeriales: asociación directa por departamento normalizado dentro de los límites del mandato, con ID estable de posición. Presupuesto de licitación EUR; registros sin importe/otra moneda excluidos de suma y cuantificados. No son todos adjudicaciones, gasto o pago. El catálogo de departamento enlazado conserva todos los periodos y lo declara.
- Gobierno: retirar suma entre tarjetas (posiciones pueden compartir departamento/expedientes); fechas futuras no se muestran como cargos activos. Ficha de ministerio conserva contexto en lugar de redirigir al diputado. Nombre enlaza a diputado, cargo público o texto según identificador real; no existe `/diputados/null`.
- Ficha de cargo: cese ausente dice «cese no registrado»; no equivale a actualidad certificada.

No se incorpora una tabla de hechos personales vacía ni se reconstruyen firmantes sin evidencia. El registro enlaza el expediente fuente y diferencia cobertura disponible de actuación personal acreditada. Para la fase 4, la cadena de actuaciones parlamentarias tiene sus propios documentos, roles y vigencias.

Mantenimiento: vistas sobre tablas existentes, sin nuevos originales ni almacenamiento pesado. `security_invoker` en vistas de evidencia y contexto, permisos públicos de lectura sobre candidatos derivados de mandatos ya públicos para contar ambigüedad. No se cambian roles de escritura. La consulta ministerial acota por posición; nombre histórico/departamento no resuelto sigue fuera de cobertura. Historial político/Wikidata no sustituye documento de mandato.

Validación: integración PostgreSQL con definiciones reales de la cadena de vistas existente: publicación posterior al relevo y adjudicación anterior resuelve el mandato antiguo; fallback a publicación, fecha ausente, dos candidatos, concesión e identidad oficial; licitación EUR excluye USD y no atribuye fechas fuera del mandato. Lectura anónima comprobada. 345 pruebas ETL (una integración ajena omitida); 228 web, incluidas fecha/método/fuente/ambigüedad y consulta ministerial por ID/currency. Lint, auditorías y build correctos.

Cobertura pendiente del plan global: financiación y ampliación territorial cuando las fuentes sean reconciliables; actuaciones y tema transversal de fase 4, distribuciones económicas, pilotos de instrumentos UE y resultados de servicios de fase 5. Las sesiones con participantes siguen pendientes y no se sustituyen por CI.
