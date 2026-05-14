![España Transparente — datos públicos de la política española](web/public/brand/github-banner.svg)

# España Transparente

**España Transparente** es un portal de datos públicos de la política española. Reúne diputados, votaciones, contratos, subvenciones, trayectorias y fuentes para consultar cada registro con contexto verificable.

🌐 **[xn--espaatransparente-ixb.site](https://xn--espaatransparente-ixb.site)**

## 📦 Qué hay ahora

- **350 diputados** activos de la XV Legislatura con partido, circunscripción y biografía
- **4.200 votos individuales** enlazados a cada diputado (sesión del 30 abril 2026)
- **Relaciones registradas**: cargos, partidos, organizaciones y responsabilidades públicas
- **Puertas giratorias**: 20 casos documentados de políticos en la empresa privada
- **Distorsión electoral**: D'Hondt, votos por escaño, umbral provincial
- **Divergencias**: detección automática de votos contra el grupo parlamentario
- **Anotaciones**: sistema propio para que la comunidad añada contexto

## 🚀 Arranque rápido

```bash
# Frontend
cd web && npm install && npm run dev

# ETL (scrapers)
cd etl && pip install -r requirements.txt
PYTHONPATH=src python -m src.congreso.diputados

# Puertas giratorias (candidatos + revisión)
PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv puertas.csv --dry-run
PYTHONPATH=src python -m src.puertas_giratorias.review list
PYTHONPATH=src python -m src.puertas_giratorias.review publish <candidate_id> --reviewed-by <nombre>
```

## 📖 Para agentes AI

Lee **[AGENTS.md](AGENTS.md)** antes de tocar código. Contiene la visión, los principios y lo que NO hacer. El plan completo está en **[PLAN.md](PLAN.md)**.

## 📊 Fuentes de datos

| Fuente | Estado |
|--------|--------|
| [Congreso Open Data](https://www.congreso.es/es/opendata) | ✅ CSV/JSON con diputados, votaciones, iniciativas |
| [INE API](https://www.ine.es/dyngs/DataLab/manual.html?cid=66) | ✅ API JSON con OpenAPI/Swagger |
| [datos.gob.es](https://datos.gob.es) | ✅ 112K datasets del Gobierno |
| [Civio (GitHub)](https://github.com/civio) | ✅ Parsers open source de presupuestos (EUPL) |

## Puertas giratorias

La tabla pública `revolving_door` contiene casos verificados. La investigación entra primero en
`revolving_door_candidates` con sus evidencias en `revolving_door_sources`. La publicación exige
al menos una fuente pública primaria: registro mercantil, documento societario, registro de gobierno
corporativo, página corporativa, resolución pública o repositorio documental equivalente.

## 🤝 Contribuir

1. Lee `AGENTS.md` — es obligatorio
2. Revisa los [issues](https://github.com/Arzuparreta/espana-transparente/issues)
3. Haz fork, crea rama, envía PR
4. Todo PR debe pasar CI (lint + build)

## ⚖️ Licencia

MIT — Ver [LICENSE](LICENSE)
