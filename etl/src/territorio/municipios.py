"""ETL: ingest the INE municipality catalog into the canonical territory model.

Source: INE Tempus3 ``VALORES_VARIABLE`` for the municipios variable (id 19) —
the authoritative list of Spanish municipalities, each with its 5-digit INE
code. The first two digits of the INE code are the province code, which maps to
the province ``territory_key`` already seeded by
``20260710000000_territory_atlas.sql``.

Municipalities are inserted into ``territory_catalog`` as
``territory_type='municipality'`` (key ``MUNI_<ine5>``, parent = province).

A second pass resolves ``municipality_key`` on municipal-level contracts and
subsidies by matching the awarding/granting body's municipio name (extracted via
``common.responsibility.infer_municipal_territory``) against the catalog. The
match is **ambiguity-safe**: only names that resolve to a single municipio are
linked; homonyms (e.g. several "Villanueva") are left NULL rather than guessed.
When a row links to a municipio we also backfill its ``province_key`` / ``ccaa_key``
from the municipio's parents (municipal rows otherwise lack them, since their
``region``/``nivel2`` literal is a town name, not a province alias).

Usage:
    PYTHONPATH=src python -m src.territorio.municipios              # full run
    PYTHONPATH=src python -m src.territorio.municipios --dry-run
    PYTHONPATH=src python -m src.territorio.municipios --skip-resolve
"""

from __future__ import annotations

import argparse
import json
import subprocess
import unicodedata
from dataclasses import dataclass

import psycopg2.extras

from common.db import get_pg_conn
from common.responsibility import infer_municipal_territory

# INE Tempus3 list of municipality values. `Codigo` is the 5-digit INE code,
# `Nombre` the municipality name (INE inverts trailing articles: "Coruña, A").
INE_MUNICIPIOS_URL = "https://servicios.ine.es/wstempus/js/ES/VALORES_VARIABLE/19"

# 2-digit INE province code → province territory_key (seeded by the atlas migration).
PROVINCE_INE_TO_KEY: dict[str, str] = {
    "01": "ALAVA", "02": "ALBACETE", "03": "ALICANTE", "04": "ALMERIA",
    "05": "AVILA", "06": "BADAJOZ", "07": "ILLES_BALEARS_PROVINCE", "08": "BARCELONA",
    "09": "BURGOS", "10": "CACERES", "11": "CADIZ", "12": "CASTELLON",
    "13": "CIUDAD_REAL", "14": "CORDOBA", "15": "A_CORUNA", "16": "CUENCA",
    "17": "GIRONA", "18": "GRANADA", "19": "GUADALAJARA", "20": "GIPUZKOA",
    "21": "HUELVA", "22": "HUESCA", "23": "JAEN", "24": "LEON",
    "25": "LLEIDA", "26": "LA_RIOJA_PROVINCE", "27": "LUGO", "28": "MADRID_PROVINCE",
    "29": "MALAGA", "30": "MURCIA_PROVINCE", "31": "NAVARRA_PROVINCE", "32": "OURENSE",
    "33": "ASTURIAS_PROVINCE", "34": "PALENCIA", "35": "LAS_PALMAS", "36": "PONTEVEDRA",
    "37": "SALAMANCA", "38": "SANTA_CRUZ_DE_TENERIFE", "39": "CANTABRIA_PROVINCE",
    "40": "SEGOVIA", "41": "SEVILLA", "42": "SORIA", "43": "TARRAGONA",
    "44": "TERUEL", "45": "TOLEDO", "46": "VALENCIA", "47": "VALLADOLID",
    "48": "BIZKAIA", "49": "ZAMORA", "50": "ZARAGOZA", "51": "CEUTA_PROVINCE",
    "52": "MELILLA_PROVINCE",
}

# Trailing articles INE inverts ("Palmas de Gran Canaria, Las"). Normalized so a
# town name in normal order matches the catalog regardless of inversion.
_ARTICLES = {"EL", "LA", "LOS", "LAS", "A", "O", "OS", "AS", "ELS", "ES", "L", "SA", " SES", "SES"}


@dataclass(frozen=True)
class Municipio:
    ine_code: str
    name: str
    province_key: str

    @property
    def territory_key(self) -> str:
        return municipio_key(self.ine_code)


def municipio_key(ine_code: str) -> str:
    return f"MUNI_{ine_code}"


def _strip_accents(value: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", value) if not unicodedata.combining(ch)
    )


def _deinvert_article(name: str) -> str:
    """"Coruña, A" -> "A Coruña"; "Palmas de Gran Canaria, Las" -> "Las Palmas...".

    Leaves names without a trailing article untouched.
    """
    if ", " not in name:
        return name
    base, _, article = name.rpartition(", ")
    token = article.strip().rstrip("'").upper()
    if token in _ARTICLES:
        return f"{article.strip()} {base}".replace("' ", "'")
    return name


def normalize_name(name: str | None) -> str:
    """Match the SQL canonical_territory_alias() spirit: de-invert article,
    uppercase, strip accents, collapse whitespace."""
    if not name:
        return ""
    deinverted = _deinvert_article(name.strip())
    upper = _strip_accents(deinverted).upper()
    return " ".join(upper.replace("/", " ").split())


def parse_municipios(payload: list[dict]) -> list[Municipio]:
    """Parse INE VALORES_VARIABLE response into Municipio rows.

    Tolerant of the two shapes seen in INE Tempus: an explicit ``Codigo`` field,
    or a ``Nombre`` prefixed with the code ("28079 Madrid").
    """
    out: list[Municipio] = []
    seen: set[str] = set()
    for item in payload:
        code = str(item.get("Codigo") or "").strip()
        name = str(item.get("Nombre") or "").strip()
        if not code and name[:5].isdigit():
            code, name = name[:5], name[5:].strip()
        code = code.zfill(5)
        if len(code) != 5 or not code.isdigit():
            continue
        province_key = PROVINCE_INE_TO_KEY.get(code[:2])
        if not province_key or not name:
            continue
        if code in seen:
            continue
        seen.add(code)
        out.append(Municipio(ine_code=code, name=name, province_key=province_key))
    return out


def fetch_municipios() -> list[Municipio]:
    # INE streams the full ~8.1k-municipio payload slowly; allow generous time.
    result = subprocess.run(
        ["curl", "-sL", "--max-time", "240", INE_MUNICIPIOS_URL],
        capture_output=True,
        timeout=300,
        check=True,
    )
    try:
        payload = json.loads(result.stdout.decode("utf-8"))
    except UnicodeDecodeError:
        payload = json.loads(result.stdout.decode("latin-1"))
    return parse_municipios(payload)


def ingest_catalog(cur, municipios: list[Municipio]) -> int:
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO territory_catalog
          (territory_key, territory_name, territory_type, parent_key, ine_code, sort_order)
        VALUES %s
        ON CONFLICT (territory_key) DO UPDATE SET
          territory_name = EXCLUDED.territory_name,
          parent_key = EXCLUDED.parent_key,
          ine_code = EXCLUDED.ine_code
        """,
        [
            (m.territory_key, m.name, "municipality", m.province_key, m.ine_code, int(m.ine_code))
            for m in municipios
        ],
    )
    return len(municipios)


def name_variants(name: str) -> set[str]:
    """Normalized lookup keys for a catalog name. INE uses bilingual slash forms
    ("Oronz/Orontze", "Alicante/Alacant"), so each side is indexed separately
    alongside the whole label."""
    variants = {normalize_name(name)}
    if "/" in name:
        variants.update(normalize_name(part) for part in name.split("/"))
    return {v for v in variants if v}


def build_catalog_index(cur) -> dict[str, list[str]]:
    """normalized municipio name (and bilingual variants) -> [territory_key, ...]
    (>1 means ambiguous)."""
    cur.execute(
        "SELECT territory_key, territory_name FROM territory_catalog WHERE territory_type = 'municipality'"
    )
    index: dict[str, list[str]] = {}
    for key, name in cur.fetchall():
        for variant in name_variants(name):
            index.setdefault(variant, []).append(key)
    return index


def resolve_body_to_municipality(body_normalized: str | None, index: dict[str, list[str]]) -> str | None:
    """Map an awarding/granting body to a single municipality_key, or None.

    Ambiguity-safe: returns a key only when the extracted town name resolves to
    exactly one municipio in the catalog.
    """
    town = infer_municipal_territory(body_normalized)
    if not town:
        return None
    keys = index.get(normalize_name(town))
    if keys and len(keys) == 1:
        return keys[0]
    return None


def _apply_links(cur, table: str, body_column: str, date_filter_col: str, mapping: dict[str, str]) -> int:
    """UPDATE municipal rows of `table`, setting municipality_key (+ province/ccaa
    backfill) for bodies in `mapping`. Updates only the municipality columns, so
    the canonical-territory trigger (UPDATE OF region/nivel2/administration_level)
    does not fire."""
    if not mapping:
        return 0
    cur.execute("CREATE TEMP TABLE _muni_map (body text PRIMARY KEY, muni_key text) ON COMMIT DROP")
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO _muni_map (body, muni_key) VALUES %s",
        list(mapping.items()),
    )
    cur.execute(
        f"""
        UPDATE {table} t SET
          municipality_key = m.muni_key,
          province_key = muni.parent_key,
          ccaa_key = prov.parent_key
        FROM _muni_map m
        JOIN territory_catalog muni ON muni.territory_key = m.muni_key
        JOIN territory_catalog prov ON prov.territory_key = muni.parent_key
        WHERE t.{body_column} = m.body
          AND t.administration_level = 'municipal'
          AND t.municipality_key IS NULL
        """
    )
    affected = cur.rowcount
    cur.execute("DROP TABLE IF EXISTS _muni_map")
    return affected


def resolve_links(cur) -> tuple[int, int]:
    index = build_catalog_index(cur)
    if not index:
        return 0, 0

    # Contracts: awarding body carries the municipio for municipal-level rows.
    cur.execute(
        """
        SELECT DISTINCT awarding_body_normalized
        FROM contracts
        WHERE administration_level = 'municipal'
          AND municipality_key IS NULL
          AND awarding_body_normalized IS NOT NULL
        """
    )
    contract_map = {
        body: muni
        for (body,) in cur.fetchall()
        if (muni := resolve_body_to_municipality(body, index))
    }
    contracts_linked = _apply_links(
        cur, "contracts", "awarding_body_normalized", "date", contract_map
    )

    # Subsidies: granting body (órgano concedente) carries the municipio at LOCAL level.
    cur.execute(
        """
        SELECT DISTINCT granting_body_normalized
        FROM subsidies
        WHERE administration_level = 'municipal'
          AND municipality_key IS NULL
          AND granting_body_normalized IS NOT NULL
        """
    )
    subsidy_map = {
        body: muni
        for (body,) in cur.fetchall()
        if (muni := resolve_body_to_municipality(body, index))
    }
    subsidies_linked = _apply_links(
        cur, "subsidies", "granting_body_normalized", "fecha_concesion", subsidy_map
    )

    return contracts_linked, subsidies_linked


def run(*, dry_run: bool = False, skip_resolve: bool = False) -> tuple[int, int, int]:
    municipios = fetch_municipios()
    print(f"INE municipios fetched: {len(municipios)}")

    if dry_run:
        sample = municipios[:3]
        for m in sample:
            print(f"  {m.ine_code} {m.name} -> {m.province_key} ({m.territory_key})")
        print(f"Dry run: would upsert {len(municipios)} municipios; resolution skipped")
        return len(municipios), 0, 0

    conn = get_pg_conn()
    cur = conn.cursor()
    ingested = ingest_catalog(cur, municipios)
    conn.commit()
    print(f"Catalog upserted: {ingested} municipios")

    contracts_linked = subsidies_linked = 0
    if not skip_resolve:
        contracts_linked, subsidies_linked = resolve_links(cur)
        conn.commit()
        print(f"Resolved municipality_key: {contracts_linked} contracts, {subsidies_linked} subsidies")
        cur.execute("SELECT refresh_territory_atlas()")
        conn.commit()
        print("Atlas refreshed")

    cur.close()
    conn.close()
    return ingested, contracts_linked, subsidies_linked


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the INE municipality catalog")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-resolve", action="store_true", help="Only refresh the catalog, skip linking")
    args = parser.parse_args()
    run(dry_run=args.dry_run, skip_resolve=args.skip_resolve)


if __name__ == "__main__":
    main()
