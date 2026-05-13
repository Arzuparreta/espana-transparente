![Acción Humana — personas, poder y trazabilidad](web/public/brand/github-banner.svg)

# Acción Humana

> *"El Estado no existe fuera de las personas que lo conforman."*

**Acción Humana** es una máquina de transparencia radical sobre la política española. Traduce datos públicos al lenguaje del ciudadano sin filtros ideológicos.

🌐 **[web-pi-two-62.vercel.app](https://web-pi-two-62.vercel.app)**

## 📦 Qué hay ahora

- **350 diputados** activos de la XV Legislatura con partido, circunscripción y biografía
- **4.200 votos individuales** enlazados a cada diputado (sesión del 30 abril 2026)
- **Cadena de mando**: quién controla a quién dentro de cada partido
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

## 🤝 Contribuir

1. Lee `AGENTS.md` — es obligatorio
2. Revisa los [issues](https://github.com/Arzuparreta/accion-humana/issues)
3. Haz fork, crea rama, envía PR
4. Todo PR debe pasar CI (lint + build)

## ⚖️ Licencia

MIT — Ver [LICENSE](LICENSE)
