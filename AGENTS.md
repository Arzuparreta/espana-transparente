# España Transparente — Manifiesto para agentes

Nombre histórico del repo: `accion-humana`. Nombre público actual del producto: **España Transparente**.

## REGLA DE ORO: Separación metodología / contenido

**La web es un portal de DATOS, no un manifiesto.** Los principios de abajo
son el LENTE INTERNO con el que diseñas el producto. Determinan QUÉ datos
recogemos, CÓMO los estructuramos y QUÉ resaltamos. Pero el ciudadano que
entra en la web ve datos crudos, no nuestra metodología.

**NUNCA** pongas en la interfaz de usuario:

- Frases como "Unidad de lectura: la persona", "Señal prioritaria: la excepción"
- Citas de Mises, Hayek, Rothbard o cualquier referencia a la Escuela Austríaca
- Explicaciones de la metodología del proyecto ("descomponemos el Estado", etc.)
- Juicios de valor, ironía o editorialización de ningún tipo
- La palabra "anarcocapitalista" ni derivados

**SIEMPRE**:

- Muestra datos. Solo datos. El usuario saca sus propias conclusiones.
- Usa etiquetas factuales: "Diputados", "Votaciones", "Partidos", "Divergencias detectadas"
- Describe qué datos hay disponibles, no por qué los recogemos así
- Deja que los números y las relaciones hablen solos

**Lógica:** Un portal de transparencia pierde toda credibilidad si editorializa.
La utilidad del producto depende de dejar que los datos expongan las estructuras de poder
por sí mismos, no de decirle al usuario qué conclusión sacar.

---

## La tesis (guía interna de producto)

El Estado no existe. Solo existen personas.

Pero los datos públicos se presentan como si "el Gobierno", "el Congreso",
"los partidos" fueran entes con voluntad propia. Nuestro trabajo es
descomponer cada acción estatal en las personas concretas que la ejecutan
y mostrar las relaciones de poder entre ellas.

## El lente (guía interna de producto)

Tres principios que guían TODA decisión de producto y de datos:

### 1. Personas, no abstracciones

Nunca "el PSOE votó X". Fulana votó X porque Mengano —su superior— controla
su puesto en la lista electoral. La cadena de mando ES el dato. Cada acción
se enlaza a un individuo. Cada agregado —partido, grupo parlamentario— se
muestra como lo que es: un conjunto de personas, no un ente con voluntad propia.

### 2. La excepción es la información

Si 349 diputados votan en bloque, eso no es noticia. Si 1 vota distinto a su
grupo, eso ES la noticia. Construir la UI para resaltar divergencias, no para
listar uniformidades.

### 3. Trazabilidad sobre estadística

Cada iniciativa legislativa debe mostrar su origen real: ¿la propuso el
gobierno? ¿transpone una directiva de la UE? ¿hubo veto presupuestario?
El ciudadano debe poder seguir el hilo de QUIÉN decidió QUÉ.

## Lo que NO hacer

- Tratar partidos, gobiernos o instituciones como agentes con voluntad propia
- Editorializar o decir "esto está mal" — los datos hablan solos
- Mostrar datos sin contexto de poder (quién controla a quién)
- **Poner la metodología del proyecto en la interfaz de usuario** — los principios
  "personas, no abstracciones", "la excepción es la información" y "trazabilidad
  sobre estadística" guían el DISEÑO del producto, NUNCA aparecen como texto en la web

## Referencias conceptuales

- **Escuela Austríaca de Economía**: Mises, Hayek, Bastiat, Rothbard
- **`NEXT.md`** — hoja de ruta activa y próximos trabajos
- **Conversación inicial del repo** — investigación extensa sobre el sistema
  político español real: disciplina de voto, listas cerradas, D'Hondt, puertas
  giratorias, control gubernamental del legislativo
- **Wikipedia**: "Puerta giratoria (política)"
- **Civio.es** — periodismo de datos de referencia en España

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| Base de datos | Supabase (PostgreSQL) |
| ETL | Python 3.12 + psycopg2 + httpx |
| CI/CD | GitHub Actions + Vercel |
| Despliegue | Vercel (Hobby) + Supabase (Free) |

## Cómo arrancar

```bash
# Frontend
cd web && npm install && npm run dev

# ETL
cd etl && pip install -r requirements.txt
PYTHONPATH=src python -m src.congreso.diputados
```

## Estructura del proyecto

```
web/src/app/           → páginas (/, /diputados/[id], /votaciones, /distorsion...)
web/src/components/    → UI (shadcn) + componentes de dominio
etl/src/congreso/      → scrapers del Congreso
etl/src/common/        → DB client, normalización de nombres
supabase/migrations/   → schema SQL (ejecutar con `npx supabase db push`)
```
