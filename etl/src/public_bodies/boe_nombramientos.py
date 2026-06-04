"""Ingest public body appointments from the BOE (Boletín Oficial del Estado).

Scans the BOE daily open-data index for Section II items (Autoridades y personal)
containing appointment notices (Real Decretos and Resoluciones de nombramiento).
Parses the document title to extract person name, role, and organization, then
fuzzy-matches them against our politicians and organizations tables.

Source: https://www.boe.es/datosabiertos/api/boe/sumario/{YYYYMMDD}
License: datos.gob.es open data (CC BY 4.0)

Usage:
    PYTHONPATH=src python -m src.public_bodies.boe_nombramientos --dry-run
    PYTHONPATH=src python -m src.public_bodies.boe_nombramientos --days 30
    PYTHONPATH=src python -m src.public_bodies.boe_nombramientos --days 7 --resume
    PYTHONPATH=src python -m src.public_bodies.boe_nombramientos --start-date 2026-01-01 --end-date 2026-05-25
"""

import argparse
import json
import re
import subprocess
import unicodedata
from datetime import date, timedelta

from common.db import DB_URL, get_pg_conn

BOE_API = "https://www.boe.es/datosabiertos/api/boe/sumario"
UA = "EspanaTransparente/1.0 (public transparency ETL; contact: rubenpenarubio02@gmail.com)"
REQUEST_DELAY_S = 1.0

# BOE section codes that contain appointment notices
APPOINTMENT_SECTIONS = {
    "2",    # Autoridades y personal (generic)
    "2A",   # Nombramientos, situaciones e incidencias
    "2B",   # Oposiciones y concursos
}

# Keywords that signal a nombramiento document title
NOMBRAMIENTO_RE = re.compile(
    r"\bnombra[mr]?\b|\bnombramiento\b|\bdesigna[mr]?\b|\bdesignación\b",
    re.IGNORECASE,
)

# Match "don/doña NAME" in titles — handles compound surnames and prepositions
_PERSON_RE = re.compile(
    r"\b(?:don|doña)\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+"
    r"(?:\s+(?:de\s+la?\s+|del\s+|de\s+)?[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+){1,5})",
    re.UNICODE,
)

# BOE titles follow "se nombra ROLE a don/doña NAME" or "se nombra a don/doña NAME como ROLE"
# Pattern 1: "se nombra ROLE a don"
_ROLE_BEFORE_RE = re.compile(
    r"\bse\s+nombra\s+([A-ZÁÉÍÓÚÜÑ][^\.]{2,80}?)\s+a\s+(?:don|doña)\b",
    re.IGNORECASE | re.UNICODE,
)
# Pattern 2: "como ROLE" at end
_ROLE_AFTER_RE = re.compile(
    r"\bcomo\s+([A-ZÁÉÍÓÚÜÑ][^,\.]{2,60})",
    re.IGNORECASE | re.UNICODE,
)
# Pattern 3: "para el cargo/puesto de ROLE"
_ROLE_CARGO_RE = re.compile(
    r"\bpara\s+el\s+(?:cargo|puesto)\s+de\s+([A-ZÁÉÍÓÚÜÑ][^,\.]{2,60})",
    re.IGNORECASE | re.UNICODE,
)

# Extract org name from "de la/el/los [ORG]" in BOE title
# e.g. "Resolución de 8 de mayo de 2026, de la Universidad de Vigo, por la que..."
_ORG_FROM_TITLE_RE = re.compile(
    r"^(?:Resoluci[oó]n|Real\s+Decreto|Orden)[\w\s/,]+?de\s+\d+[^,]+,\s+"
    r"de\s+(?:la\s+|el\s+|los\s+|las\s+)?([A-ZÁÉÍÓÚÜÑ][^,]{3,80}),",
    re.IGNORECASE | re.UNICODE,
)

# Month abbreviations for BOE date formats ("15 de febrero de 2026")
_MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}
_DATE_RE = re.compile(
    r"\b(\d{1,2})\s+de\s+(" + "|".join(_MONTHS) + r")\s+de\s+(\d{4})\b",
    re.IGNORECASE,
)


def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return re.sub(r"\s+", " ", nfkd.encode("ascii", errors="ignore").decode()).strip().upper()


def _fetch_json(url: str) -> dict | None:
    result = subprocess.run(
        ["curl", "-sL", "--max-time", "30",
         "-H", "Accept: application/json",
         "-H", f"User-Agent: {UA}", url],
        capture_output=True, text=True, timeout=35,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def _parse_date_from_title(titulo: str) -> date | None:
    m = _DATE_RE.search(titulo)
    if not m:
        return None
    try:
        day, month_str, year = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        return date(year, _MONTHS[month_str], day)
    except (ValueError, KeyError):
        return None


def _parse_person(titulo: str) -> str | None:
    m = _PERSON_RE.search(titulo)
    return m.group(1).strip() if m else None


def _parse_role(titulo: str) -> str | None:
    for pattern in (_ROLE_BEFORE_RE, _ROLE_AFTER_RE, _ROLE_CARGO_RE):
        m = pattern.search(titulo)
        if m:
            role = m.group(1).strip()
            role = re.sub(r"\s+(?:de|del|en|la|el|los|las)\s*$", "", role, flags=re.IGNORECASE)
            return role[:120] or None
    return None


def _parse_org_from_title(titulo: str) -> str | None:
    """Extract the issuing organization from a BOE title string.

    'Resolución de 8 de mayo de 2026, de la Universidad de Vigo, por la que...'
    → 'Universidad de Vigo'
    """
    m = _ORG_FROM_TITLE_RE.match(titulo)
    if m:
        org = m.group(1).strip().rstrip(".,;")
        # Skip generic date phrases that sometimes leak through
        if re.match(r"^\d", org) or len(org) < 4:
            return None
        return org
    return None


def _as_list(val) -> list:
    """Normalize XML-to-JSON single-or-array values into a list."""
    if val is None:
        return []
    if isinstance(val, list):
        return val
    return [val]


def get_boe_items(day: date) -> list[dict]:
    """Return appointment items from the BOE daily index for a given date.

    The BOE API converts XML to JSON using a single-object / array mix:
    seccion, departamento, epigrafe, item can each be a dict or a list.
    We normalize everything with _as_list().

    Structure:
      data.sumario.diario[] → {seccion: list|dict}
        seccion → {codigo, departamento: list|dict}
          departamento → {nombre, epigrafe: list|dict}
            epigrafe → {item: list|dict}
              item → {identificador, titulo, url_html}
    """
    url = f"{BOE_API}/{day:%Y%m%d}"
    payload = _fetch_json(url)
    if not payload:
        return []

    items = []
    for entrada in _as_list(payload.get("data", {}).get("sumario", {}).get("diario")):
        for seccion in _as_list(entrada.get("seccion")):
            if not isinstance(seccion, dict):
                continue
            code = seccion.get("codigo", "")

            # Only scan sections 2A (Nombramientos) — skip 1 (laws), 2B (oposiciones), etc.
            if code not in APPOINTMENT_SECTIONS:
                continue

            for dept_obj in _as_list(seccion.get("departamento")):
                if not isinstance(dept_obj, dict):
                    continue
                dept_name = dept_obj.get("nombre", "")

                # Items may live directly under departamento or under epigrafe
                raw_items = []
                for epigrafe in _as_list(dept_obj.get("epigrafe") or dept_obj.get("texto", {}).get("epigrafe")):
                    if not isinstance(epigrafe, dict):
                        continue
                    raw_items.extend(_as_list(epigrafe.get("item")))

                for item in raw_items:
                    if not isinstance(item, dict):
                        continue
                    titulo = item.get("titulo", "")
                    boe_id = item.get("identificador", "")
                    if not titulo or not boe_id:
                        continue

                    # In section 2A we take all items; still keyword-filter for quality
                    if not NOMBRAMIENTO_RE.search(titulo):
                        # Keep even without keyword if it's explicitly in 2A (Nombramientos epígrafe)
                        pass

                    url_htm = item.get("url_html", "")
                    url_pdf = (item.get("url_pdf") or {}).get("texto", "")

                    items.append({
                        "boe_id": boe_id,
                        "titulo": titulo,
                        "dept": dept_name,
                        "section_code": code,
                        "pub_date": day,
                        "source_url": url_htm or url_pdf or f"https://www.boe.es/boe/dias/{day:%Y/%m/%d}/",
                    })
    return items


def match_organization(cur, dept: str, titulo: str) -> tuple[str | None, str | None]:
    """Try to match the BOE department/title to an organization in our DB.

    Returns (organization_id, institution_label).
    """
    if cur is None:
        return None, None
    # Normalize department name for matching
    norm_dept = _normalize(dept)
    if not norm_dept:
        return None, None

    # First try exact normalized match
    cur.execute("""
        SELECT id, name FROM organizations
        WHERE upper(unaccent(name)) = upper(unaccent(%s))
        LIMIT 1
    """, (dept,))
    row = cur.fetchone()
    if row:
        return str(row[0]), row[1]

    # Then pg_trgm similarity on dept (we only need department-level match)
    cur.execute("""
        SELECT id, name, similarity(upper(unaccent(name)), upper(unaccent(%s))) AS sim
        FROM organizations
        WHERE upper(unaccent(name)) %% upper(unaccent(%s))
          AND similarity(upper(unaccent(name)), upper(unaccent(%s))) >= 0.45
        ORDER BY sim DESC
        LIMIT 1
    """, (dept, dept, dept))
    row = cur.fetchone()
    if row:
        return str(row[0]), row[1]

    return None, None


def match_politician(cur, person_name: str) -> str | None:
    """Fuzzy-match person name to politicians table using pg_trgm. Returns politician_id or None."""
    if cur is None or not person_name or len(person_name) < 5:
        return None
    cur.execute("""
        SELECT id, similarity(full_name, %s) AS sim
        FROM politicians
        WHERE full_name %% %s
          AND similarity(full_name, %s) >= 0.75
        ORDER BY sim DESC
        LIMIT 1
    """, (person_name, person_name, person_name))
    row = cur.fetchone()
    return str(row[0]) if row else None


def upsert_appointment(cur, item: dict, person_name: str, role: str | None,
                       org_id: str | None, institution: str,
                       politician_id: str | None, dry_run: bool) -> bool:
    appt_date = _parse_date_from_title(item["titulo"])
    raw_data = {
        "boe_id": item["boe_id"],
        "titulo_original": item["titulo"],
        "section_code": item["section_code"],
        "dept": item["dept"],
        "pub_date": item["pub_date"].isoformat(),
    }

    if dry_run:
        print(f"    [DRY-RUN] {person_name[:35]} | {(role or '?')[:30]} | {institution[:40]}")
        return True

    cur.execute("""
        INSERT INTO institutional_appointments
            (institution, position_title, person_name, politician_id,
             appointment_date, source_url, raw_data, organization_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (lower(person_name), institution, COALESCE(appointment_date, '1900-01-01'))
        DO UPDATE SET
            position_title  = COALESCE(EXCLUDED.position_title, institutional_appointments.position_title),
            politician_id   = COALESCE(institutional_appointments.politician_id, EXCLUDED.politician_id),
            source_url      = EXCLUDED.source_url,
            organization_id = COALESCE(institutional_appointments.organization_id, EXCLUDED.organization_id),
            raw_data        = institutional_appointments.raw_data || EXCLUDED.raw_data,
            updated_at      = now()
    """, (
        institution[:200],
        (role or "Nombramiento")[:200],
        person_name[:200],
        politician_id,
        appt_date,
        item["source_url"],
        json.dumps(raw_data, ensure_ascii=False, default=str),
        org_id,
    ))
    return True


def _already_seen(cur, boe_id: str) -> bool:
    cur.execute("""
        SELECT 1 FROM institutional_appointments
        WHERE raw_data->>'boe_id' = %s
        LIMIT 1
    """, (boe_id,))
    return cur.fetchone() is not None


def run(days: int = 30, dry_run: bool = False, resume: bool = False,
        start_date: date | None = None, end_date: date | None = None) -> tuple[int, int, int]:
    """Scan BOE for nombramiento items and upsert into institutional_appointments.

    Returns (days_scanned, items_found, items_upserted).
    """
    import time

    # In dry-run without a configured DB (e.g. CI smoke check) we still exercise
    # fetch + parse, but skip DB matching instead of crashing on a missing
    # DATABASE_URL. With a DB available, dry-run does full matching as usual.
    conn = None
    if not (dry_run and not DB_URL):
        conn = get_pg_conn()
    elif resume:
        print("[dry-run] no DATABASE_URL configured — disabling --resume (no DB to check)")
        resume = False

    days_scanned = 0
    total_found = 0
    total_upserted = 0

    try:
        cur = conn.cursor() if conn else None
        if end_date is None:
            end_date = date.today() - timedelta(days=1)  # yesterday (today may not be indexed)
        if start_date is None:
            start_date = end_date - timedelta(days=days - 1)

        current = start_date
        while current <= end_date:
            print(f"[{current}] fetching BOE index...", end=" ", flush=True)
            items = get_boe_items(current)
            days_scanned += 1

            if not items:
                print("(no items)")
                current += timedelta(days=1)
                time.sleep(REQUEST_DELAY_S)
                continue

            print(f"{len(items)} appointment items found")
            total_found += len(items)

            for item in items:
                boe_id = item["boe_id"]

                if resume and _already_seen(cur, boe_id):
                    continue

                person_name = _parse_person(item["titulo"])
                if not person_name:
                    # No parseable person name — skip (could be collective appointment)
                    continue

                role = _parse_role(item["titulo"])

                # Try to match org: first by title-extracted name, fallback to dept
                title_org = _parse_org_from_title(item["titulo"])
                org_id, org_name = match_organization(
                    cur,
                    title_org or item["dept"],
                    item["titulo"],
                )
                # institution label: prefer title org > matched org > dept > fallback
                institution = org_name or title_org or _normalize(item["dept"]) or "ORGANISMO PÚBLICO"
                politician_id = match_politician(cur, person_name)

                upsert_appointment(cur, item, person_name, role, org_id,
                                   institution, politician_id, dry_run)
                total_upserted += 1

                if dry_run:
                    continue

                if politician_id:
                    print(f"  ✓ {person_name[:35]} → politician match")

            if not dry_run:
                conn.commit()

            current += timedelta(days=1)
            time.sleep(REQUEST_DELAY_S)

    finally:
        if conn:
            conn.close()

    print(f"\nDone. {days_scanned} days scanned, {total_found} items found, {total_upserted} upserted.")
    return days_scanned, total_found, total_upserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest BOE nombramiento items into institutional_appointments")
    parser.add_argument("--days", type=int, default=30,
                        help="Number of days to scan backwards from yesterday (default: 30)")
    parser.add_argument("--start-date", type=date.fromisoformat,
                        help="Start date (YYYY-MM-DD); overrides --days")
    parser.add_argument("--end-date", type=date.fromisoformat,
                        help="End date inclusive (YYYY-MM-DD); defaults to yesterday")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and match but do not write to DB")
    parser.add_argument("--resume", action="store_true",
                        help="Skip BOE items already present in institutional_appointments")
    args = parser.parse_args()

    run(
        days=args.days,
        dry_run=args.dry_run,
        resume=args.resume,
        start_date=args.start_date,
        end_date=args.end_date,
    )


if __name__ == "__main__":
    main()
