# 🜁 Acción Humana

> *"El Estado no existe fuera de las personas que lo conforman."*

**Acción Humana** es una máquina de transparencia radical sobre la política española. Traduce datos públicos al lenguaje del ciudadano sin filtros ideológicos.

## 🚀 Arranque rápido

### Requisitos
- Node.js 22+
- Python 3.12+
- PostgreSQL (o acceso a Supabase)

### Desarrollo local

```bash
# Frontend
cd web
npm install
cp .env.local.example .env.local  # Configurar claves de Supabase
npm run dev

# ETL (scrapers)
cd etl
pip install -r requirements.txt
PYTHONPATH=src python -m src.congreso.diputados
```

### Estructura

```
accion-humana/
├── web/                          # Next.js 14 (App Router) + Tailwind + shadcn/ui
│   └── src/
│       ├── app/                  # Páginas (/, /diputados/[id], /partidos)
│       ├── components/           # UI (shadcn) + dominio
│       ├── lib/supabase/         # Clientes de BD
│       └── types/                # Tipos compartidos
├── etl/                          # Scrapers Python
│   └── src/
│       ├── common/               # DB client, normalización de nombres
│       ├── congreso/             # Diputados, votaciones, iniciativas
│       ├── contratacion/         # (próximamente)
│       ├── presupuestos/         # (próximamente)
│       └── ine/                  # (próximamente)
├── supabase/                     # Migraciones SQL
└── .github/workflows/            # CI/CD
```

## 📊 Fuentes de datos

| Fuente | Estado |
|--------|--------|
| [Congreso Open Data](https://www.congreso.es/es/opendata) | ✅ CSV/JSON con diputados, votaciones, iniciativas |
| [INE API](https://www.ine.es/dyngs/DataLab/manual.html?cid=66) | ✅ API JSON con OpenAPI/Swagger |
| [datos.gob.es](https://datos.gob.es) | ✅ 112K datasets del Gobierno |
| [Civio (GitHub)](https://github.com/civio) | ✅ Parsers open source de presupuestos (EUPL) |

## 🤝 Contribuir

1. Revisa los [issues](https://github.com/Arzuparreta/accion-humana/issues)
2. Elige uno etiquetado `good first issue`
3. Haz fork, crea rama, envía PR
4. Los scrapers deben ir en `etl/` con su propio `README`
5. Todo PR debe pasar lint y build

## ⚖️ Licencia

MIT - Ver [LICENSE](LICENSE)

---

*Proyecto iniciado el 13 de mayo de 2026. Construido con datos reales del Congreso de los Diputados.*
