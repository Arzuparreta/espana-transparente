"""ETL: ingest former senators (bajas) from the Senate's altas-y-bajas page.

The senadores.py scraper only captures currently active senators. This module
scrapes the alphabetical "Bajas de Senadores y Senadoras" list to add former
senators who have left during Legislature XV.  Each former senator gets a
politician row and a politician_membership with is_active=false and ended_at
set to the departure date.

This closes the gap where Senate vote data references senators who have since
left — without these entries, build_senator_index() in votaciones.py cannot
match votes to politicians.

Usage:
    PYTHONPATH=src python -m src.senado.bajas --dry-run
    PYTHONPATH=src python -m src.senado.bajas
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import time
from dataclasses import dataclass, field

import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run

BASE = "https://www.senado.es"
BAJAS_ALFABETICA_URL = (
    f"{BASE}/web/composicionorganizacion/senadores/composicionsenado/"
    "modificacionescomposicion/ListaAlfabetica/index.html"
)
UA = "Mozilla/5.0 (compatible; EspanaTransparente/1.0)"
REQUEST_DELAY = 1.5
LEGISLATURE_NUMBER = 15

GROUP_MAP = {
    "GPS": "PSOE",
    "GPP": "PP",
    "GPV": "EAJ-PNV",
    "GPMX": "SUMAR",
    "GPMXS": "SUMAR",
    "GPCS": "JUNTS",
    "GPEPC": "ERC",
    "GPEHB": "EH Bildu",
    "GPERB": "ERC",
    "GPPLU": "JUNTS",
    "GPNA": "UPN",
    "GPCC": "PP",
    "GPAR": "PP",
}

CANONICAL_PARTY_NAMES = {
    "PP": "Partido Popular",
    "PSOE": "Partido Socialista Obrero Español",
    "VOX": "VOX",
    "SUMAR": "SUMAR",
    "ERC": "Esquerra Republicana de Catalunya",
    "JUNTS": "Junts per Catalunya",
    "EH Bildu": "EH Bildu",
    "EAJ-PNV": "Partido Nacionalista Vasco",
    "UPN": "Unión del Pueblo Navarro",
    "CCa": "Coalición Canaria",
    "BNG": "Bloque Nacionalista Galego",
}

PARTY_COLORS = {
    "PP": "#0055A7",
    "PSOE": "#E01021",
    "VOX": "#63BE21",
    "SUMAR": "#E01065",
    "ERC": "#FFB232",
    "JUNTS": "#20C0C2",
    "EH Bildu": "#00D4AA",
    "EAJ-PNV": "#008000",
    "UPN": "#2A52BE",
    "CCa": "#FFD700",
    "BNG": "#6CB6FF",
}

PARTY_NAME_MAP = {
    "PARTIDO POPULAR": "PP",
    "PARTIDO SOCIALISTA OBRERO ESPAÑOL": "PSOE",
    "VOX": "VOX",
    "SUMAR": "SUMAR",
    "ESQUERRA REPUBLICANA DE CATALUNYA": "ERC",
    "ESQUERRA REPUBLICANA": "ERC",
    "JUNTS PER CATALUNYA": "JUNTS",
    "JUNTS": "JUNTS",
    "EH BILDU": "EH Bildu",
    "EUSKAL HERRIA BILDU": "EH Bildu",
    "EAJ-PNV": "EAJ-PNV",
    "PARTIDO NACIONALISTA VASCO": "EAJ-PNV",
    "UNIÓN DEL PUEBLO NAVARRO": "UPN",
    "BLOQUE NACIONALISTA GALEGO": "BNG",
    "PODEMOS": "Podemos",
    "CIUDADANOS": "Ciudadanos",
}

MONTHS_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


@dataclass
class FormerSenator:
    name_last_first: str  # "APELLIDOS, NOMBRE"
    group_abbrev: str  # "GPS", "GPP", etc.
    departure_date: str  # "YYYY-MM-DD"
    senate_id: str  # id1 number
    replacement_name: str | None = None
    note: str | None = None  # "Nueva designación: DATE" or similar
    # Populated from ficha page:
    full_name: str = ""
    first_name: str = ""
    last_name: str = ""
    sexo: str = ""
    tipo: str = ""  # ELECTO / DESIGNADO
    procedencia: str = ""
    partido: str = ""
    grupo: str = ""
    photo_url: str = ""
    party_acronym: str = ""


def curl_text(url: str, delay: float = REQUEST_DELAY) -> str:
    if delay:
        time.sleep(delay)
    result = subprocess.run(
        ["curl", "-sL", "--compressed", "-H", f"User-Agent: {UA}", url],
        capture_output=True,
        timeout=60,
    )
    raw = result.stdout
    for enc in ("utf-8", "iso-8859-1", "windows-1252", "latin1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def senate_id_from_name(full_name: str) -> str:
    slug = (
        full_name.strip().lower()
        .replace(" ", "-").replace(",", "")
        .replace("á", "a").replace("é", "e").replace("í", "i")
        .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
        .replace("ü", "u")
    )
    h = hashlib.md5(slug.encode()).hexdigest()[:8]
    return f"sen-{slug[:50]}-{h}"


def parse_date_dmy(raw: str) -> str | None:
    """Parse DD/MM/YYYY → YYYY-MM-DD."""
    match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw.strip())
    if not match:
        return None
    day, month, year = match.groups()
    return f"{year}-{int(month):02d}-{int(day):02d}"


def parse_name_last_first(name: str) -> tuple[str, str]:
    """'APELLIDOS, NOMBRE' → (first_name, last_name)."""
    name = name.strip()
    if "," in name:
        surnames, first = name.split(",", 1)
        return first.strip().title(), surnames.strip().title()
    parts = name.split()
    if len(parts) >= 3:
        return " ".join(parts[:-2]).title(), " ".join(parts[-2:]).title()
    if len(parts) == 2:
        return parts[0].title(), parts[1].title()
    return name.title(), ""


def parse_bajas_page(html: str) -> list[dict]:
    """Parse the alphabetical bajas page into structured records.

    The page structure (within .main-content or similar) alternates between:
      <a href="...fichasenador...id1=NNN">NAME_SURNAME, NAME</a> GROUP DATE [note]

    We extract: senate_id (id1), name, group_abbrev, departure_date,
    and any "Sustituido por X" / "Nueva designación" note.
    """
    # Strategy: find all ficha links, then extract surrounding text.
    # The first link in each "group" is the baja; subsequent links are replacements.

    # Find all <a> links to ficha pages
    link_pattern = re.compile(
        r'<a\s[^>]*href="[^"]*fichasenador[^"]*\?[^"]*id1=(\d+)[^"]*"[^>]*>'
        r'([^<]+)'
        r'</a>',
        re.DOTALL,
    )
    links = link_pattern.findall(html)

    # Split the page into blocks by links — each block starts with a link
    # and contains subsequent text until the next link.
    # Simpler: just extract text between links using split.
    parts = re.split(
        r'(<a\s[^>]*href="[^"]*fichasenador[^"]*\?[^"]*id1=\d+[^"]*"[^>]*>[^<]+</a>)',
        html,
    )
    # parts alternates: [text_before_link1, link1, text_between_link1_link2, link2, ...]

    bajas: list[dict] = []
    seen_ids: set[str] = set()

    for i in range(1, len(parts), 2):
        if i >= len(parts):
            break
        link_html = parts[i]
        after_text = parts[i + 1] if i + 1 < len(parts) else ""

        # Extract senate_id and name from link
        link_match = re.search(
            r'href="[^"]*id1=(\d+)[^"]*"[^>]*>([^<]+)</a>',
            link_html,
        )
        if not link_match:
            continue

        senate_id = link_match.group(1)
        name = link_match.group(2).strip()

        # Skip duplicates (same id)
        if senate_id in seen_ids:
            continue

        # Determine if this is a baja (APELLIDOS, NOMBRE) or replacement (NOMBRE APELLIDOS)
        # Bajas have comma; replacements generally don't.
        # But we need to look at the following text to be sure.
        after_clean = re.sub(r"<[^>]+>", " ", after_text)
        after_clean = re.sub(r"\s+", " ", after_clean).strip()

        # Extract group abbreviation (2-6 uppercase letters after the name)
        group_match = re.match(r"^\s*([A-Z]{2,6})\b", after_clean)
        if not group_match:
            continue

        group_abbrev = group_match.group(1)
        rest = after_clean[group_match.end():].strip()

        # Extract date DD/MM/YYYY
        date_match = re.match(r"(\d{1,2}/\d{1,2}/\d{4})", rest)
        if not date_match:
            continue

        departure_date = parse_date_dmy(date_match.group(1))
        rest = rest[date_match.end():].strip()

        # Check for "Sustituido por" or "Nueva designación"
        replacement: str | None = None
        note: str | None = None

        if "Sustituido por" in rest or "sustituido por" in rest:
            # The replacement name is either in the following link or as plain text
            # Look ahead at the next link if it exists
            if i + 2 < len(parts):
                next_link_match = re.search(
                    r'href="[^"]*id1=(\d+)[^"]*"[^>]*>([^<]+)</a>',
                    parts[i + 2],
                )
                if next_link_match:
                    replacement = next_link_match.group(2).strip()
            replacement = replacement or rest.replace("Sustituido por", "").strip()
        elif "Nueva designación" in rest:
            note = rest.strip()

        seen_ids.add(senate_id)
        bajas.append({
            "senate_id": senate_id,
            "name_last_first": name,
            "group_abbrev": group_abbrev,
            "departure_date": departure_date,
            "replacement": replacement,
            "note": note,
        })

    return bajas


def _get_meta(html: str, name: str) -> str:
    m = re.search(
        rf'<meta\s+name="{re.escape(name)}"\s+content\s*=\s*"([^"]*)"',
        html, re.IGNORECASE,
    )
    return m.group(1).strip() if m else ""


def scrape_ficha(senate_id: str) -> dict:
    """Fetch ficha page for a senator and extract metadata."""
    url = f"{BASE}/web/composicionorganizacion/senadores/composicionsenado/fichasenador/index.html?id1={senate_id}&legis={LEGISLATURE_NUMBER}"
    html = curl_text(url)

    photo_m = re.search(
        r'<img[^>]*src="(https://www\.senado\.es/legis\d+/senadores/fotos/[^"]+)"',
        html,
    )

    return {
        "nombre": _get_meta(html, "Nombre"),
        "sexo": _get_meta(html, "Sexo"),
        "tipo_procedencia": _get_meta(html, "Tipo Procedencia"),
        "procedencia": _get_meta(html, "Procedencia"),
        "grupo_parlamentario": _get_meta(html, "GP baja") or _get_meta(html, "Grupo Parlamentario"),
        "partido": _get_meta(html, "Partido politico"),
        "photo_url": photo_m.group(1) if photo_m else None,
    }


def acronym_from_party(partido: str) -> str:
    partido_up = partido.strip().upper()
    for full, acr in PARTY_NAME_MAP.items():
        if full.upper() == partido_up:
            return acr
    # Try partial match
    for acr in sorted(PARTY_COLORS.keys(), key=len, reverse=True):
        if acr.upper() in partido_up.split():
            return acr
    words = partido.split()
    return words[0][:15] if words else "Otro"


def run(dry_run: bool = False) -> None:
    print("Fetching alphabetical bajas page...")
    html = curl_text(BAJAS_ALFABETICA_URL, delay=0)
    records = parse_bajas_page(html)
    print(f"Found {len(records)} former senators (bajas)")

    if dry_run:
        for r in records:
            print(f"  {r['name_last_first']} | {r['group_abbrev']} | {r['departure_date']} | id1={r['senate_id']}")
        return

    conn = get_pg_conn()
    run_id = None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM legislatures WHERE number = %s LIMIT 1", (LEGISLATURE_NUMBER,))
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f"Legislature {LEGISLATURE_NUMBER} not found in DB")
            legislature_id = row[0]

            run_id = start_run(cur, pipeline="senado.bajas", chunk_key="former")
            conn.commit()

            added = 0
            skipped = 0
            for i, rec in enumerate(records):
                senate_id = rec["senate_id"]
                label = f"[{i+1}/{len(records)}] {rec['name_last_first']}"

                # Check if this politician already exists via senate_id
                cur.execute(
                    "SELECT id FROM politicians WHERE senate_id = %s LIMIT 1",
                    (senate_id,),
                )
                existing_pol = cur.fetchone()

                if existing_pol:
                    pol_id = existing_pol[0]
                    # Check if they already have a senate membership for this legislature
                    cur.execute(
                        """
                        SELECT id, is_active FROM politician_memberships
                        WHERE politician_id = %s AND legislature_id = %s AND chamber = 'senate'
                        LIMIT 1
                        """,
                        (pol_id, legislature_id),
                    )
                    existing_mem = cur.fetchone()
                    if existing_mem:
                        print(f"  {label} — already has senate membership (active={existing_mem[1]}), skipping")
                        skipped += 1
                        continue

                # Fetch ficha page for full metadata
                print(f"  {label} — fetching ficha (id1={senate_id})...")
                try:
                    ficha = scrape_ficha(senate_id)
                except Exception as e:
                    print(f"    WARNING: ficha failed for {rec['name_last_first']}: {e}")
                    ficha = {}

                nombre = ficha.get("nombre") or rec["name_last_first"]
                partido = ficha.get("partido") or ""
                grupo = ficha.get("grupo_parlamentario") or ""
                first_name, last_name = parse_name_last_first(nombre)
                acr = acronym_from_party(partido)
                if not acr or acr == "Otro":
                    group_acr = GROUP_MAP.get(rec["group_abbrev"])
                    if group_acr:
                        acr = group_acr
                party_name = CANONICAL_PARTY_NAMES.get(acr, partido or acr or "Otro")

                # Upsert party
                cur.execute(
                    """
                    INSERT INTO parties (name, acronym, color)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (name) DO UPDATE SET acronym = EXCLUDED.acronym, color = EXCLUDED.color
                    """,
                    (party_name, acr, PARTY_COLORS.get(acr, "#718096")),
                )
                cur.execute("SELECT id FROM parties WHERE name = %s", (party_name,))
                party_row = cur.fetchone()
                party_id = party_row[0] if party_row else None

                if existing_pol:
                    pol_id = existing_pol[0]
                else:
                    cid = senate_id_from_name(nombre)
                    # Upsert politician
                    cur.execute(
                        """
                        INSERT INTO politicians
                            (congress_id, senate_id, first_name, last_name, full_name, photo_url, raw_data)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (congress_id) DO UPDATE SET
                            senate_id = EXCLUDED.senate_id,
                            first_name = EXCLUDED.first_name,
                            last_name = EXCLUDED.last_name,
                            full_name = EXCLUDED.full_name,
                            raw_data = EXCLUDED.raw_data,
                            updated_at = now()
                        RETURNING id
                        """,
                        (
                            cid,
                            int(senate_id),
                            first_name,
                            last_name,
                            nombre,
                            ficha.get("photo_url"),
                            psycopg2.extras.Json({
                                "sexo": ficha.get("sexo", ""),
                                "tipo_procedencia": ficha.get("tipo_procedencia", ""),
                                "procedencia": ficha.get("procedencia", ""),
                                "grupo_parlamentario": grupo,
                                "partido": partido,
                                "senate_id_num": senate_id,
                                "source": "senado_bajas",
                                "departure_date": rec["departure_date"],
                                "replacement": rec["replacement"],
                                "note": rec["note"],
                            }),
                        ),
                    )
                    pol_id = cur.fetchone()[0]

                # Create historical membership (is_active=false, end_date set)
                cur.execute(
                    """
                    INSERT INTO politician_memberships
                        (politician_id, legislature_id, party_id, constituency,
                         is_active, group_parliamentary, chamber, end_date, raw_data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::date, %s)
                    ON CONFLICT (politician_id, legislature_id, chamber) DO NOTHING
                    """,
                    (
                        pol_id,
                        legislature_id,
                        party_id,
                        ficha.get("procedencia", ""),
                        False,
                        grupo or rec["group_abbrev"],
                        "senate",
                        rec["departure_date"],
                        psycopg2.extras.Json({
                            "source": "senado_bajas",
                            "departure_date": rec["departure_date"],
                            "replacement": rec["replacement"],
                            "note": rec["note"],
                            "group_abbrev_bajas_page": rec["group_abbrev"],
                        }),
                    ),
                )
                added += 1

                if added % 10 == 0:
                    conn.commit()
                    print(f"    Committed {added} so far...")

            conn.commit()

            finish_run(
                cur,
                run_id=run_id,
                status="succeeded",
                rows_read=len(records),
                rows_inserted=added,
            )
            conn.commit()

            print(f"Done: {added} former senators added, {skipped} skipped (already existed).")

    except Exception as exc:
        if run_id:
            with conn.cursor() as cur:
                finish_run(cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
                conn.commit()
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest former Senate members from bajas page")
    parser.add_argument("--dry-run", action="store_true", help="Parse and print without writing to DB")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
