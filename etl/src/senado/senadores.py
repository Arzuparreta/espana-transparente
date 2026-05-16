"""ETL: scrape active senators from the Spanish Senate website.

Scraping strategy:
  1. Fetch alphabetical list A-Z+Ñ → senator name, senate_id (id1), group, constituency, type.
  2. For each senator: fetch ficha page → meta tags (party, group full name, gender, photo URL).
  3. Upsert parties → politicians (senate_id) → politician_memberships (chamber='senate').

Rate limiting: 1.5 s between requests (same policy as Congreso scrapers).
"""

import argparse
import hashlib
import re
import subprocess
import time
import psycopg2.extras
from common.db import get_pg_conn

BASE_URL = "https://www.senado.es"
REQUEST_DELAY = 1.5
UA = "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0"
LEGISLATURE_NUMBER = 15

LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["%c3%91"]  # Ñ URL-encoded

SENATE_GROUP_MAP = {
    "GPS": "PSOE",
    "GPP": "PP",
    "GPV": "EAJ-PNV",
    "GPMX": "SUMAR",
    "GPCS": "JUNTS",
    "GPEPC": "ERC",
    "GPEHB": "EH Bildu",
    "GPCC": "PP",  # Coalición Canaria (popular)
    "GPAR": "PP",  # Aragón
    "GPMXSM": "SUMAR",
    "GPNA": "UPN",
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


def _fetch(url: str) -> str:
    result = subprocess.run(
        ["curl", "-sL", "--compressed", "-A", UA, url],
        capture_output=True, timeout=30
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed for {url}: {result.stderr.decode()[:200]}")
    return result.stdout.decode("utf-8", errors="replace")


def _get_meta(html: str, name: str) -> str:
    m = re.search(
        rf'<meta\s+name="{re.escape(name)}"\s+content\s*=\s*"([^"]*)"',
        html, re.IGNORECASE
    )
    return m.group(1).strip() if m else ""


def senate_id_from_name(full_name: str) -> str:
    """Stable congress_id-style slug for a senator (used as politicians.congress_id)."""
    slug = (
        full_name.strip().lower()
        .replace(" ", "-").replace(",", "")
        .replace("á", "a").replace("é", "e").replace("í", "i")
        .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
        .replace("ü", "u")
    )
    h = hashlib.md5(slug.encode()).hexdigest()[:8]
    return f"sen-{slug[:50]}-{h}"


def scrape_list() -> list[dict]:
    """Scrape senators from the alphabetical index, one letter at a time."""
    senators = []
    seen_ids = set()

    for letter in LETTERS:
        url = f"{BASE_URL}/web/composicionorganizacion/senadores/composicionsenado/consultaordenalfabetico/index.html?id={letter}"
        html = _fetch(url)
        time.sleep(REQUEST_DELAY)

        # Each senator is in a <li> that contains a <a href="...fichasenador...?id1=NNN&legis=15">
        items = re.findall(
            r'<a\s[^>]*href="(/web/[^"]*fichasenador[^"]*id1=(\d+)[^"]*)"[^>]*>(.*?)</a>',
            html, re.DOTALL | re.IGNORECASE
        )
        for href, senate_id_num, _name_in_link in items:
            if senate_id_num in seen_ids:
                continue
            seen_ids.add(senate_id_num)

            # The surrounding <li> has the structured text: "NAME    GROUP    type: CONSTITUENCY"
            # Find the <li> that contains this href
            li_match = re.search(
                rf'<li[^>]*>.*?{re.escape(href.split(";")[0])}.*?</li>',
                html, re.DOTALL
            )
            li_text = re.sub(r"<[^>]+>", " ", li_match.group(0)).strip() if li_match else ""
            li_text = re.sub(r"\s+", " ", li_text)

            senators.append({
                "senate_id_num": senate_id_num,
                "ficha_path": href,
                "li_text": li_text,
            })

        print(f"  {letter}: {len(items)} senators")

    return senators


def scrape_ficha(path: str) -> dict:
    """Fetch individual senator page; return dict of meta-tag values."""
    url = f"{BASE_URL}{path}"
    html = _fetch(url)
    time.sleep(REQUEST_DELAY)

    photo_m = re.search(r'<img[^>]*src="(https://www\.senado\.es/legis\d+/senadores/fotos/[^"]+)"', html)

    return {
        "nombre": _get_meta(html, "Nombre"),
        "sexo": _get_meta(html, "Sexo"),
        "tipo_procedencia": _get_meta(html, "Tipo Procedencia"),
        "procedencia": _get_meta(html, "Procedencia"),
        "grupo_parlamentario": _get_meta(html, "Grupo Parlamentario"),
        "partido": _get_meta(html, "Partido politico"),
        "photo_url": photo_m.group(1) if photo_m else None,
    }


def parse_name(full_name_raw: str) -> tuple[str, str]:
    """'APELLIDOS, NOMBRE' → (first_name, last_name)."""
    full_name_raw = full_name_raw.strip()
    if "," in full_name_raw:
        surnames, first = full_name_raw.split(",", 1)
        return first.strip().title(), surnames.strip().title()
    parts = full_name_raw.split()
    if len(parts) >= 3:
        return " ".join(parts[:-2]).title(), " ".join(parts[-2:]).title()
    if len(parts) == 2:
        return parts[0].title(), parts[1].title()
    return full_name_raw.title(), ""


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

GRUPO_NAME_MAP = {
    "GRUPO PARLAMENTARIO POPULAR": "PP",
    "GRUPO PARLAMENTARIO SOCIALISTA": "PSOE",
    "GRUPO PARLAMENTARIO VOX": "VOX",
    "GRUPO PARLAMENTARIO VASCO": "EAJ-PNV",
    "GRUPO PARLAMENTARIO DE ESQUERRA REPUBLICANA": "ERC",
    "GRUPO PARLAMENTARIO JUNTS": "JUNTS",
    "GRUPO PARLAMENTARIO EH BILDU": "EH Bildu",
    "GRUPO PARLAMENTARIO MIXTO": "Otro",
}


def acronym_from_party(partido: str, grupo: str) -> str:
    """Infer party acronym from Senado group/party strings."""
    partido_up = partido.strip().upper() if partido else ""
    grupo_up = grupo.strip().upper() if grupo else ""

    # Exact match on partido name
    for full, acr in PARTY_NAME_MAP.items():
        if full.upper() == partido_up:
            return acr

    # Substring match on grupo name (longest prefix first)
    for prefix, acr in sorted(GRUPO_NAME_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        if grupo_up.startswith(prefix.upper()):
            return acr

    # Substring match on known acronyms inside combined string
    combined = f"{partido_up} {grupo_up}"
    for acr in sorted(PARTY_COLORS.keys(), key=len, reverse=True):
        if acr.upper() in combined.split():
            return acr

    # Fallback: first word of party name
    words = partido.split() if partido else grupo.split()
    return words[0][:15] if words else "Otro"


def canonical_party_name(partido: str, grupo: str) -> str:
    acronym = acronym_from_party(partido, grupo)
    if acronym in CANONICAL_PARTY_NAMES:
        return CANONICAL_PARTY_NAMES[acronym]
    return partido or grupo or acronym


def run(dry_run: bool = False) -> None:
    conn = get_pg_conn()
    cur = conn.cursor()

    # Ensure legislature 15
    cur.execute("""
        INSERT INTO legislatures (number, name, is_active)
        VALUES (%s, %s, %s)
        ON CONFLICT (number) DO UPDATE SET is_active = EXCLUDED.is_active
        RETURNING id
    """, (LEGISLATURE_NUMBER, "Legislatura XV", True))
    leg_id = cur.fetchone()[0]

    print("Scraping senator list (A-Z+Ñ)...")
    raw_list = scrape_list()
    print(f"Total senators found: {len(raw_list)}")

    ok = 0
    for i, entry in enumerate(raw_list):
        senate_id_num = entry["senate_id_num"]
        print(f"[{i+1}/{len(raw_list)}] Fetching ficha id1={senate_id_num}...")

        try:
            ficha = scrape_ficha(entry["ficha_path"])
        except Exception as e:
            print(f"  WARNING: ficha failed for {senate_id_num}: {e}")
            continue

        nombre = ficha["nombre"]
        if not nombre:
            # Fall back to parsing li_text
            nombre = entry["li_text"].split("G")[0].strip()

        if not nombre:
            print(f"  SKIP: no name for id1={senate_id_num}")
            continue

        first_name, last_name = parse_name(nombre)
        full_name = nombre.strip()
        partido = ficha["partido"]
        grupo = ficha["grupo_parlamentario"]
        procedencia = ficha["procedencia"]
        tipo = ficha["tipo_procedencia"]  # ELECTO / DESIGNADO
        photo_url = ficha["photo_url"]
        acr = acronym_from_party(partido, grupo)

        cid = senate_id_from_name(full_name)

        if dry_run:
            print(f"  DRY RUN: {full_name} | {acr} | {procedencia} | {tipo} | photo={photo_url}")
            continue

        party_name = canonical_party_name(partido, grupo)

        # Party upsert
        cur.execute("""
            INSERT INTO parties (name, acronym, color)
            VALUES (%s, %s, %s)
            ON CONFLICT (name) DO UPDATE SET acronym = EXCLUDED.acronym, color = EXCLUDED.color
        """, (party_name, acr, PARTY_COLORS.get(acr, "#718096")))

        cur.execute("SELECT id FROM parties WHERE name = %s", (party_name,))
        row = cur.fetchone()
        party_id = row[0] if row else None

        # Politician upsert — only touch photo_url on insert (same policy as diputados.py)
        cur.execute("""
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
        """, (
            cid, senate_id_num, first_name, last_name, full_name,
            photo_url,
            psycopg2.extras.Json({
                "sexo": ficha["sexo"],
                "tipo_procedencia": tipo,
                "procedencia": procedencia,
                "grupo_parlamentario": grupo,
                "partido": partido,
                "senate_id_num": senate_id_num,
            }),
        ))

        cur.execute("SELECT id FROM politicians WHERE congress_id = %s", (cid,))
        pol_id = cur.fetchone()[0]

        # Membership upsert — chamber='senate'
        cur.execute("""
            INSERT INTO politician_memberships
                (politician_id, legislature_id, party_id, constituency,
                 is_active, group_parliamentary, chamber, raw_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (politician_id, legislature_id, chamber) DO UPDATE SET
                party_id = EXCLUDED.party_id,
                constituency = EXCLUDED.constituency,
                is_active = EXCLUDED.is_active,
                group_parliamentary = EXCLUDED.group_parliamentary,
                raw_data = EXCLUDED.raw_data
        """, (
            pol_id, leg_id, party_id,
            procedencia,
            True,
            grupo,
            "senate",
            psycopg2.extras.Json({"tipo_procedencia": tipo}),
        ))

        ok += 1

        if (ok % 20) == 0:
            conn.commit()
            print(f"  Committed {ok} senators so far...")

    if not dry_run:
        conn.commit()
        print(f"Done: {ok}/{len(raw_list)} senators upserted.")
    else:
        print(f"Dry run complete: {len(raw_list)} senators would be upserted.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape senators from Senado portal")
    parser.add_argument("--dry-run", action="store_true", help="Print without writing to DB")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
