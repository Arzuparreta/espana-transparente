"""ETL: load institutional appointments (TC, CGPJ, RTVE, SEPI) from YAML.

Reads etl/data/instituciones_nombramientos.yml and upserts records into
institutional_appointments. Fuzzy-matches person names against politicians
to populate politician_id when confidence >= 0.85.

Usage:
    PYTHONPATH=src python -m src.instituciones.instituciones
    PYTHONPATH=src python -m src.instituciones.instituciones --dry-run
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path
from typing import Any

import psycopg2.extras
import yaml

from common.db import get_pg_conn
from puertas_giratorias.db import match_politician

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "instituciones_nombramientos.yml"

VALID_INSTITUTIONS = {
    "TC", "CGPJ", "RTVE", "SEPI",
    # SEPI majority-owned subsidiaries (empresas participadas mayoritariamente)
    "SEPI-NAVANTIA",
    "SEPI-CORREOS",
    "SEPI-TRAGSA",
    "SEPI-MERCASA",
    "SEPI-HUNOSA",
    "SEPI-ENUSA",
    "SEPI-ENSA",
    "SEPI-SEPIDES",
    "SEPI-EFE",
    "SEPI-CETARSA",
    "SEPI-MAYASA",
    "SEPI-SAECA",
}
MATCH_THRESHOLD = 0.85


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def load_appointments(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        doc = yaml.safe_load(f) or {}

    rows = []
    for entry in doc.get("appointments", []):
        institution = entry.get("institution", "").strip().upper()
        if institution not in VALID_INSTITUTIONS:
            raise ValueError(f"Unknown institution: {institution!r}")
        person = entry.get("person", "").strip()
        if not person:
            raise ValueError(f"Missing person in entry: {entry}")
        rows.append({
            "institution": institution,
            "position_title": entry.get("position_title", "").strip(),
            "person_name": person,
            "political_party": (entry.get("party") or "").strip() or None,
            "nominating_body": (entry.get("nominating_body") or "").strip() or None,
            "appointment_date": _parse_date(entry.get("start")),
            "end_date": _parse_date(entry.get("end")),
            "source_url": (entry.get("source") or "").strip() or None,
            "raw_data": {k: str(v) for k, v in entry.items() if v is not None},
        })
    return rows


def upsert_appointments(rows: list[dict], dry_run: bool = False) -> tuple[int, int]:
    conn = get_pg_conn()
    cur = conn.cursor()
    inserted = 0
    matched = 0

    for row in rows:
        politician_id, _, score = match_politician(cur, row["person_name"])
        if politician_id:
            matched += 1
            row = {**row, "politician_id": politician_id}
        else:
            row = {**row, "politician_id": None}

        if dry_run:
            match_info = f" [politician match score={score:.2f}]" if politician_id else ""
            print(f"  DRY-RUN {row['institution']:4s} {row['position_title']:<25s} {row['person_name']}{match_info}")
            inserted += 1
            continue

        cur.execute(
            """
            INSERT INTO institutional_appointments
              (institution, position_title, person_name, politician_id,
               political_party, nominating_body, appointment_date, end_date,
               source_url, raw_data)
            VALUES (%(institution)s, %(position_title)s, %(person_name)s, %(politician_id)s,
                    %(political_party)s, %(nominating_body)s, %(appointment_date)s, %(end_date)s,
                    %(source_url)s, %(raw_data)s)
            ON CONFLICT (lower(person_name), institution, COALESCE(appointment_date, '1900-01-01'))
            DO UPDATE SET
              position_title   = EXCLUDED.position_title,
              politician_id    = COALESCE(EXCLUDED.politician_id, institutional_appointments.politician_id),
              political_party  = COALESCE(EXCLUDED.political_party, institutional_appointments.political_party),
              nominating_body  = COALESCE(EXCLUDED.nominating_body, institutional_appointments.nominating_body),
              end_date         = EXCLUDED.end_date,
              source_url       = COALESCE(EXCLUDED.source_url, institutional_appointments.source_url),
              raw_data         = institutional_appointments.raw_data || EXCLUDED.raw_data,
              updated_at       = now()
            """,
            {**row, "raw_data": psycopg2.extras.Json(row["raw_data"])},
        )
        inserted += 1

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()
    return inserted, matched


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--file", type=Path, default=DATA_FILE)
    args = parser.parse_args()

    rows = load_appointments(args.file)
    print(f"Loaded {len(rows)} appointments from YAML")
    inserted, matched = upsert_appointments(rows, dry_run=args.dry_run)
    print(f"{'[DRY-RUN] ' if args.dry_run else ''}Processed {inserted} rows ({matched} politician matches)")


if __name__ == "__main__":
    main()
