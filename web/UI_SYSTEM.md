# UI System

## Propósito
La UI de Acción Humana no presenta instituciones como actores. Presenta personas, cadenas de poder y excepciones relevantes. El sistema visual debe reforzar eso en cada pantalla nueva.

## Marca
- La identidad visual vive en `BRAND.md`.
- El símbolo oficial es una fachada abierta que revela una persona concreta.
- En UI usar `LogoMark`; no incrustar versiones copiadas del SVG dentro de componentes nuevos.
- El acento dorado se reserva para personas, excepciones y puntos de trazabilidad.

## Reglas obligatorias
- Las personas son la unidad primaria de lectura. Nombre, cargo, circunscripción y relación deben tener prioridad sobre la sigla.
- La excepción manda sobre el agregado. Divergencias y rupturas de disciplina deben destacar sin convertir la interfaz en un panel de alertas histérico.
- Ningún layout puede depender de scroll horizontal para funcionar en móvil.
- Cualquier fila con texto variable y badge/acción debe usar `min-w-0` en el bloque flexible y `shrink-0` en la metadata.
- No crear badges, tabs o métricas ad hoc cuando ya exista primitive compartida.

## Primitives
- `PageHeader`: encabezado de página con título, contexto y metadata.
- `PartyBadge`: representación única de siglas y color de partido.
- `VoteBadge`: representación única del tipo de voto.
- `ExceptionBadge`: contador de divergencias o anomalías.
- `StatGrid`: métricas responsivas.
- `SectionTabs`: navegación interna de secciones.
- `InfoPanel`: paneles de explicación o fuente.

## Patrones prohibidos
- `grid-cols-3` sin una variante responsive explícita.
- `justify-between` en filas con contenido variable sin contrato de contracción.
- Colores de voto o partido definidos localmente por componente.
- Tabs copiadas inline fuera de `SectionTabs`.
- Anchuras fijas tipo `max-w-[200px]` para “arreglar” truncados.

## Checklist antes de añadir UI nueva
1. ¿Estoy usando una primitive existente antes de montar utilidades inline?
2. ¿He probado nombres, títulos y badges largos?
3. ¿La pantalla sigue leyendo bien a `375px`?
4. ¿La excepción visual realmente destaca?
5. ¿La metadata tiene contexto de poder y no solo dato suelto?

## Verificación
- Ejecutar `npm run ui:audit`.
- Ejecutar `npm run lint`.
- Si se toca una pantalla crítica, revisar móvil y desktop con datos extremos.
