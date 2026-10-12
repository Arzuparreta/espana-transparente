# Primer resultado observable: espera quirúrgica

- Pregunta: ¿cuántos pacientes siguen esperando una intervención y cuánto llevan esperando en mi administración?
- Respuesta: espera estructural no urgente a 31/12/2025, total SNS y 17 comunidades, Ceuta y Melilla. Pacientes, tasa por 1.000 tarjetas sanitarias, pacientes/porcentaje con más de seis meses y días medios transcurridos. No sumar medias territoriales ni cirugía con consultas.
- Fuente: SISLE-SNS, informe resumen rectificado, tabla página 8; glosario página 20. Actualización anunciada en la portada el 24/09/2026 por corrección de Castilla-La Mancha. El corte, la revisión y la fecha de consulta son distintos.
- Gasto: COFOG GF07, ES/S13 anual consolidado ya reconciliado en el portal. Se muestra en una sección independiente, con año propio en URL, sin atribuir el total nacional a una comunidad. Contabilidad nacional no es pago de caja. Si falta 2025 no se presenta 2024 como el mismo periodo.
- Interpretaciones a impedir: espera futura garantizada, pacientes intervenidos en todo el año, eficiencia/culpabilidad, coste por paciente en lista, relación causal gasto/espera. El perímetro de salud es mayor que esta lista. Diferencias de composición clínica y criterios de registro impiden un ranking causal.
- Modelo: un snapshot JSON acotado (20 filas, decenas de KB), edición y hashes por fuente, lectura pública, escritura de servicio. Reemplazo atómico y ejecución registrada; fallos de identidad/conciliación conservan la edición previa. PDF extraído con Poppler ya disponible en los runners. No datos individuales.
- Mantenimiento: actualización semanal de la edición piloto; descubre la revisión anunciada y comprueba que sigue enlazado el PDF de diciembre 2025. Un cambio de corte requiere ampliar contrato y pruebas; no publica automáticamente otro informe con semántica desconocida.
- Siguiente paso: instrumentos europeos de fase 5; consultas, educación y dependencia después de evaluar el piloto. Sesiones con participantes reales pendientes.

## Validación técnica

- 296 pruebas web y 434 ETL correctas; una prueba de búsqueda requiere su conexión separada y queda omitida, no sustituida por el piloto. Lint, auditorías UI/contenido y build correctos.
- Fuente viva: PDF rectificado y nota enlazados desde el índice oficial. 20 filas; 853.740 pacientes, 184.748 con más de seis meses; total territorial conciliado.
- PostgreSQL desechable: una sola edición tras upsert, payload incompleto rechazado, rollback conserva valores, lectura anon y escritura pública denegada. 1.745 bytes almacenados comprimidos en el snapshot inicial.
- Pruebas de render con fixtures cubren territorio y año independientes, corte inválido, revisión y error frente a ausencia; no equivalen a aceptación humana. Publicación y navegador real se registran después del merge.
