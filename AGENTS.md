# España Transparente — Manifiesto para agentes

Nombre histórico del repo: `accion-humana`. Nombre público actual del producto: **España Transparente**.

## REGLA DE ORO: Tesis explícita, datos indesmontables

**Política cambiada el 2026-06-10 (decisión D5, design doc en
`docs/designs/2026-06-10-la-cadena.md`).**
La web tiene tesis y la declara abiertamente. La antigua separación
metodología/contenido (lista de palabras prohibidas, prohibición de
editorializar) queda derogada. La sustituyen cuatro reglas:

1. **Espina narrativa.** Los datos se presentan como argumento, no como
   inventario. Cada dato responde a una pregunta de la cadena
   *gasto → déficit → deuda → quién paga*. Un dato nuevo se gana su sitio
   profundizando la cadena o un hilo, no por existir.
2. **Nada desmontable.** El tono puede ser duro y la tesis explícita, pero
   cada afirmación de la cadena lleva fuente oficial (INE, Eurostat,
   PGE/SEPG, AIReF donde aplique). Atacar la web debe exigir atacar al INE.
3. **Defendibilidad zona euro.** Nunca "la deuda española causa la inflación
   española" como causalidad directa (la política monetaria es del BCE). La
   cadena defendible: *déficit crónico → deuda → intereses pagados vía
   impuestos* + *inflación → el Estado recauda más (IRPF sin deflactar, IVA)
   y debe menos en términos reales*.
4. **Riesgo legal intacto.** "Corrupto", "culpable", "delincuente" siguen
   prohibidos aplicados a personas sin condena firme — es protección frente
   a calumnia/difamación, no censura de tesis.

**Lógica:** la fuerza del portal es que nadie puede tocar los números. La
tesis ordena y encuadra; las páginas de datos siguen siendo acero factual
con la fuente pegada a cada cifra.

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

### 2. La excepción es la información (señal interna, NO titular de portada)

Como criterio de MODELADO DE DATOS y de ANÁLISIS: una uniformidad no informa,
una anomalía sí. Lo usamos para decidir qué calculamos y qué resaltamos en las
PÁGINAS PROFUNDAS (la ficha de una persona, organización o caso), donde la
excepción es relevante dentro de su contexto.

NO es un criterio de PORTADA. Una divergencia de voto (un diputado que vota
distinto a su grupo) es un dato analítico de nicho: como mucho interesa en la
ficha de ESE diputado la semana en que ocurre, nunca como titular del home. Al
ciudadano que entra no le mueve "el diputado X rompió la disciplina de voto"; le
mueve a dónde va su dinero, qué significa el IPC para su vida y si su
representante es honesto. La "excepción" que merece portada es esa —dinero,
economía cotidiana e integridad—, no la mecánica parlamentaria interna. No
pongas recuentos de divergencias en la home.

### 3. Trazabilidad sobre estadística

Cada iniciativa legislativa debe mostrar su origen real: ¿la propuso el
gobierno? ¿transpone una directiva de la UE? ¿hubo veto presupuestario?
El ciudadano debe poder seguir el hilo de QUIÉN decidió QUÉ.

## Lo que NO hacer

- Tratar partidos, gobiernos o instituciones como agentes con voluntad propia
- Afirmar sin fuente — la tesis es bienvenida, la afirmación desmontable no
  (ver REGLA DE ORO: cada eslabón citable a INE/Eurostat/PGE-SEPG/AIReF)
- Mostrar datos sin contexto de poder (quién controla a quién)
- Mostrar datos sin dirección — cada chart responde a una pregunta de la
  cadena o de un hilo; el inventario sin argumento es el anti-patrón

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
