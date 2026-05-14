"""ETL script: scrape active deputies from Spanish Congress Open Data"""

import csv
import io
import hashlib
import httpx
import psycopg2.extras
from common.db import get_pg_conn

CONGRESO_BASE = "https://www.congreso.es"
DIPUTADOS_CSV = "https://www.congreso.es/webpublica/opendata/diputados/DiputadosActivos__20260513050012.csv"

LEGISLATURE_MAP = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5,
    "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10,
    "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15,
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
    "Podemos": "#7B2D8B",
    "Ciudadanos": "#F25A29",
    "PRC": "#DDE223",
}

EXACT_PARTY_MAP = {
    "PP": "PP", "PSOE": "PSOE", "VOX": "VOX",
    "SUMAR": "SUMAR", "ERC": "ERC", "EH Bildu": "EH Bildu",
    "EAJ-PNV": "EAJ-PNV", "UPN": "UPN", "BNG": "BNG",
    "JxCAT-JUNTS": "JUNTS", "PSC-PSOE": "PSOE", "PsdeG-PSOE": "PSOE",
    "PSIB-PSOE": "PSOE", "PSE-EE (PSOE)": "PSOE", "PSN-PSOE": "PSOE",
}


def congress_id_from_name(name: str) -> str:
    slug = name.strip().lower().replace(" ", "-").replace(",", "").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    short_hash = hashlib.md5(slug.encode()).hexdigest()[:8]
    return f"{slug[:50]}-{short_hash}"


def extract_acronym(formacion: str, grupo: str) -> str:
    # First, check formacion (electoral formation) which has clearer acronyms
    upper_f = formacion.upper() if formacion else ""
    upper_g = grupo.upper() if grupo else ""

    # Direct mapping of electoral formations
    for full, acr in EXACT_PARTY_MAP.items():
        if full.upper() in upper_f:
            return acr

    # Group-based heuristics
    combined = f"{upper_g} {upper_f}"
    for acr in sorted(PARTY_COLORS.keys(), key=len, reverse=True):
        if acr.upper() in combined:
            return acr

    # Fallback to group name first word
    words = upper_g.split() if upper_g else upper_f.split()
    return words[0][:15] if words else "Desconocido"


def get_conn():
    return get_pg_conn()


def parse_date(d: str):
    if not d:
        return None
    parts = d.split("/")
    if len(parts) == 3:
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return None


def run():
    conn = get_conn()
    cur = conn.cursor()

    print("Ensuring legislatures...")
    for roman, num in LEGISLATURE_MAP.items():
        cur.execute("""
            INSERT INTO legislatures (number, name, is_active)
            VALUES (%s, %s, %s)
            ON CONFLICT (number) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active
        """, (num, f"Legislatura {roman}", num == 15))

    cur.execute("SELECT id FROM legislatures WHERE number = 15")
    xv_leg_id = cur.fetchone()[0]

    print(f"Fetching active deputies from: {DIPUTADOS_CSV}")
    import subprocess
    result = subprocess.run(
        ["curl", "-sL", "-H", "User-Agent: Mozilla/5.0 (compatible; AccionHumana/1.0)", DIPUTADOS_CSV],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed: {result.stderr}")
    reader = csv.DictReader(io.StringIO(result.stdout), delimiter=";")
    # Strip BOM from first column name if present
    if reader.fieldnames and reader.fieldnames[0].startswith('\ufeff'):
        reader.fieldnames[0] = reader.fieldnames[0][1:]
    diputados = list(reader)

    print(f"Found {len(diputados)} deputies")

    parties_done = set()
    pol_count = 0
    mem_count = 0

    for d in diputados:
        full_name = d.get("NOMBRE", "").strip()
        if not full_name:
            continue

        cid = congress_id_from_name(full_name)
        constituency = d.get("CIRCUNSCRIPCION", "").strip()
        formacion = d.get("FORMACIONELECTORAL", "").strip()
        grupo = d.get("GRUPOPARLAMENTARIO", "").strip()
        biografia = d.get("BIOGRAFIA", "").strip()
        fecha_alta = d.get("FECHAALTA", "").strip()
        cod_parlamentario = d.get("CODPARLAMENTARIO", "").strip()
        photo_url = f"https://www.congreso.es/img/diputados/{cod_parlamentario}.jpg" if cod_parlamentario else None

        # Split name
        if "," in full_name:
            surnames, first = full_name.split(",", 1)
            first_name = first.strip()
            last_name = surnames.strip()
        else:
            parts = full_name.split()
            first_name = " ".join(parts[:-2]) if len(parts) >= 3 else (parts[0] if parts else "")
            last_name = " ".join(parts[-2:]) if len(parts) >= 2 else (parts[-1] if parts else "")

        # Politician upsert
        cur.execute("""
            INSERT INTO politicians (congress_id, first_name, last_name, full_name, photo_url, raw_data)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (congress_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                full_name = EXCLUDED.full_name,
                photo_url = EXCLUDED.photo_url,
                raw_data = EXCLUDED.raw_data,
                updated_at = now()
        """, (cid, first_name, last_name, full_name, photo_url,
              psycopg2.extras.Json({"biografia": biografia, "formacion": formacion, "grupo": grupo})))
        pol_count += 1

        # Party
        party_name = grupo or formacion
        acronym = extract_acronym(formacion, grupo)
        if acronym and acronym not in parties_done:
            cur.execute("""
                INSERT INTO parties (name, acronym, color)
                VALUES (%s, %s, %s)
                ON CONFLICT (name) DO UPDATE SET acronym = EXCLUDED.acronym, color = EXCLUDED.color
            """, (party_name, acronym, PARTY_COLORS.get(acronym, "#718096")))
            parties_done.add(acronym)

        # Get IDs
        cur.execute("SELECT id FROM politicians WHERE congress_id = %s", (cid,))
        pol_id = cur.fetchone()[0]

        party_id = None
        if acronym:
            cur.execute("SELECT id FROM parties WHERE acronym = %s", (acronym,))
            row = cur.fetchone()
            if row:
                party_id = row[0]

        # Membership upsert
        cur.execute("""
            INSERT INTO politician_memberships
                (politician_id, legislature_id, party_id, constituency,
                 is_active, group_parliamentary, start_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (politician_id, legislature_id) DO UPDATE SET
                party_id = EXCLUDED.party_id,
                constituency = EXCLUDED.constituency,
                is_active = EXCLUDED.is_active,
                group_parliamentary = EXCLUDED.group_parliamentary,
                start_date = EXCLUDED.start_date
        """, (pol_id, xv_leg_id, party_id, constituency, True, party_name, parse_date(fecha_alta)))
        mem_count += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Done! Upserted {pol_count} politicians, {mem_count} memberships, {len(parties_done)} parties")


if __name__ == "__main__":
    run()
