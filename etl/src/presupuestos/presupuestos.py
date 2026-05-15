"""ETL: ingest Presupuestos Generales del Estado (PGE) into budget_lines.

Downloads the annual budget file from SEPG / datos.gob.es, parses the
section → program → economic chapter hierarchy, normalises ministry names,
and upserts to the budget_lines table.

Usage:
    PYTHONPATH=src python -m src.presupuestos.presupuestos --year 2025
    PYTHONPATH=src python -m src.presupuestos.presupuestos --year 2025 --dry-run
    PYTHONPATH=src python -m src.presupuestos.presupuestos --from-year 2016 --to-year 2026 --resume
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import zipfile
from datetime import date
from typing import Iterator

import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, is_chunk_succeeded, start_run
from common.responsibility import normalize_public_body
from presupuestos.sources import BudgetSource, download_source


# ─── Column name aliases ──────────────────────────────────────────────────────
# Different years use slightly different column headers. These dicts map
# expected canonical names to lists of observed aliases (lowercase stripped).

_COL_SECTION_CODE  = {"seccion", "sec", "sección", "cod_seccion"}
_COL_SECTION_NAME  = {"denominacion_seccion", "den_seccion", "nombre_seccion", "seccion_nombre"}
_COL_SERVICE_CODE  = {"organismo", "org", "servicio", "cod_organismo"}
_COL_SERVICE_NAME  = {"denominacion_organismo", "den_organismo", "nombre_organismo"}
_COL_PROGRAM_CODE  = {"programa", "prog", "cod_programa"}
_COL_PROGRAM_NAME  = {"denominacion_programa", "den_programa", "nombre_programa"}
_COL_CHAPTER       = {"capitulo", "cap", "cod_capitulo", "economic_chapter"}
_COL_ARTICLE       = {"articulo", "art", "cod_articulo"}
_COL_CONCEPT       = {"concepto", "con", "cod_concepto"}
_COL_CREDIT_INIT   = {
    "creditos_iniciales", "credito_inicial", "credito_ini",
    "dotacion_inicial", "inicial", "euros", "importe",
}
_COL_CREDIT_FINAL  = {
    "creditos_definitivos", "credito_definitivo", "credito_def",
    "dotacion_definitiva", "definitivo",
}


def _resolve_col(header: list[str], aliases: set[str]) -> str | None:
    """Return the actual column name from header that matches any alias."""
    for col in header:
        if col.lower().strip().replace(" ", "_") in aliases:
            return col
    return None


def _parse_amount(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = value.strip().replace(" ", "")
    if not cleaned:
        return None

    has_dot   = "." in cleaned
    has_comma = "," in cleaned

    if has_dot and has_comma:
        # Spanish thousands format: "1.234.567,89" → strip dots, swap comma
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif has_comma:
        # Comma-only decimal: "1234567,89"
        cleaned = cleaned.replace(",", ".")
    # else: dot-only decimal "1234567.89" or integer — no change needed

    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def detect_delimiter(first_line: str) -> str:
    if first_line.count(";") > first_line.count(","):
        return ";"
    if "\t" in first_line:
        return "\t"
    return ","


# ─── Parsing ─────────────────────────────────────────────────────────────────

def _iter_csv_rows(data: bytes, encoding: str, delimiter: str) -> Iterator[dict]:
    text = data.decode(encoding, errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    for row in reader:
        yield row


def parse_records(raw: bytes, source: BudgetSource) -> list[dict]:
    """Parse raw bytes from a source file into a list of normalised record dicts."""
    data = raw
    filename = ""

    if source.fmt == "zip" or (len(raw) > 2 and raw[:2] == b"PK"):
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            names = zf.namelist()
            target = next(
                (n for n in names if n.lower().endswith((".csv", ".txt"))),
                names[0] if names else None,
            )
            if not target:
                raise RuntimeError(f"No CSV/TXT found in ZIP. Contents: {names}")
            data = zf.read(target)
            filename = target
            print(f"  Extracted {target} ({len(data)} bytes) from ZIP")

    # Detect encoding
    for enc in (source.encoding, "utf-8-sig", "utf-8", "latin-1"):
        try:
            sample = data[:4096].decode(enc)
            encoding = enc
            break
        except UnicodeDecodeError:
            continue
    else:
        encoding = "latin-1"

    first_line = data.decode(encoding, errors="replace").split("\n")[0]
    delimiter = detect_delimiter(first_line)
    print(f"  Format: enc={encoding}, delimiter={repr(delimiter)}, file={filename or 'inline'}")

    rows = list(_iter_csv_rows(data, encoding, delimiter))
    if not rows:
        raise RuntimeError("No rows found in source file")

    header = list(rows[0].keys())
    print(f"  Header ({len(header)} cols): {header[:10]}")

    # Resolve column names
    col_section_code = _resolve_col(header, _COL_SECTION_CODE)
    col_section_name = _resolve_col(header, _COL_SECTION_NAME)
    col_service_code = _resolve_col(header, _COL_SERVICE_CODE)
    col_service_name = _resolve_col(header, _COL_SERVICE_NAME)
    col_program_code = _resolve_col(header, _COL_PROGRAM_CODE)
    col_program_name = _resolve_col(header, _COL_PROGRAM_NAME)
    col_chapter      = _resolve_col(header, _COL_CHAPTER)
    col_article      = _resolve_col(header, _COL_ARTICLE)
    col_concept      = _resolve_col(header, _COL_CONCEPT)
    col_credit_init  = _resolve_col(header, _COL_CREDIT_INIT)
    col_credit_final = _resolve_col(header, _COL_CREDIT_FINAL)

    missing = [name for name, col in [
        ("section_code", col_section_code),
        ("program_code", col_program_code),
        ("chapter", col_chapter),
        ("credit_initial", col_credit_init),
    ] if col is None]

    if missing:
        raise RuntimeError(
            f"Could not find required columns {missing} in header {header}. "
            f"Add column aliases to presupuestos.py or update sources.py for year {source.year}. "
            f"Run: PYTHONPATH=src python -m src.presupuestos.sources --year {source.year}"
        )

    records = []
    skipped = 0
    for row in rows:
        section_code = (row.get(col_section_code) or "").strip()
        program_code = (row.get(col_program_code) or "").strip()
        chapter_raw  = (row.get(col_chapter) or "").strip()

        if not section_code or not program_code or not chapter_raw:
            skipped += 1
            continue

        try:
            chapter = int(chapter_raw)
        except ValueError:
            skipped += 1
            continue

        section_name = (row.get(col_section_name, "") or "").strip() or None
        service_code = (row.get(col_service_code, "") or "").strip() or None if col_service_code else None
        service_name = (row.get(col_service_name, "") or "").strip() or None if col_service_name else None
        program_name = (row.get(col_program_name, "") or "").strip() or None
        article      = (row.get(col_article, "") or "").strip() or None if col_article else None
        concept      = (row.get(col_concept, "") or "").strip() or None if col_concept else None
        credit_init  = _parse_amount(row.get(col_credit_init))
        credit_final = _parse_amount(row.get(col_credit_final)) if col_credit_final else None

        records.append({
            "year":                source.year,
            "section_code":        section_code,
            "section_name":        section_name,
            "service_code":        service_code,
            "service_name":        service_name,
            "program_code":        program_code,
            "program_name":        program_name,
            "economic_chapter":    chapter,
            "economic_article":    article,
            "economic_concept":    concept,
            "credit_initial":      credit_init,
            "credit_final":        credit_final,
            "ministry_normalized": normalize_public_body(section_name),
            "administration_level": "state",
            "source_url":          source.url,
            "raw_data":            psycopg2.extras.Json(dict(row)),
        })

    print(f"  Parsed {len(records)} records, skipped {skipped} incomplete rows")
    return records


# ─── Upsert ───────────────────────────────────────────────────────────────────

def upsert(conn, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    for rec in records:
        cur.execute("""
            INSERT INTO budget_lines (
              year, section_code, section_name, service_code, service_name,
              program_code, program_name,
              economic_chapter, economic_article, economic_concept,
              credit_initial, credit_final,
              ministry_normalized, administration_level,
              source_url, raw_data, updated_at
            ) VALUES (
              %(year)s, %(section_code)s, %(section_name)s,
              %(service_code)s, %(service_name)s,
              %(program_code)s, %(program_name)s,
              %(economic_chapter)s, %(economic_article)s, %(economic_concept)s,
              %(credit_initial)s, %(credit_final)s,
              %(ministry_normalized)s, %(administration_level)s,
              %(source_url)s, %(raw_data)s, now()
            )
            ON CONFLICT (year, section_code, program_code, economic_chapter) DO UPDATE SET
              section_name        = EXCLUDED.section_name,
              service_code        = EXCLUDED.service_code,
              service_name        = EXCLUDED.service_name,
              program_name        = EXCLUDED.program_name,
              economic_article    = EXCLUDED.economic_article,
              economic_concept    = EXCLUDED.economic_concept,
              credit_initial      = EXCLUDED.credit_initial,
              credit_final        = coalesce(EXCLUDED.credit_final, budget_lines.credit_final),
              ministry_normalized = EXCLUDED.ministry_normalized,
              source_url          = EXCLUDED.source_url,
              raw_data            = EXCLUDED.raw_data,
              updated_at          = now()
        """, rec)
    conn.commit()
    cur.close()
    return len(records)


# ─── Run ─────────────────────────────────────────────────────────────────────

def run_year(*, year: int, resume: bool, dry_run: bool) -> tuple[int, int]:
    window_start = date(year, 1, 1)
    window_end   = date(year, 12, 31)
    pipeline     = "presupuestos"
    chunk_key    = str(year)

    conn = None if dry_run else get_pg_conn()
    cur  = conn.cursor() if conn else None

    if cur and resume and is_chunk_succeeded(
        cur,
        pipeline=pipeline,
        chunk_key=chunk_key,
        window_start=window_start,
        window_end=window_end,
    ):
        print(f"Skipping {year}: already succeeded")
        cur.close()
        conn.close()
        return 0, 0

    run_id = None
    if cur:
        run_id = start_run(
            cur,
            pipeline=pipeline,
            chunk_key=chunk_key,
            window_start=window_start,
            window_end=window_end,
        )
        conn.commit()

    try:
        raw, source = download_source(year)
        records = parse_records(raw, source)
        upserted = 0

        if conn:
            upserted = upsert(conn, records)
            cur = conn.cursor()
            finish_run(
                cur,
                run_id=run_id,
                status="succeeded",
                rows_read=len(records),
                rows_inserted=upserted,
            )
            conn.commit()
            cur.close()
            conn.close()

        print(f"Done! year={year}  read={len(records)}  upserted={upserted}")
        return len(records), upserted

    except Exception as exc:
        if conn and run_id:
            cur = conn.cursor()
            finish_run(
                cur,
                run_id=run_id,
                status="failed",
                rows_read=0,
                error_summary=str(exc)[:500],
            )
            conn.commit()
            cur.close()
            conn.close()
        raise


def run_backfill(*, from_year: int, to_year: int, resume: bool, dry_run: bool) -> None:
    for year in range(from_year, to_year + 1):
        print(f"\n== presupuestos {year} ==")
        try:
            run_year(year=year, resume=resume, dry_run=dry_run)
        except RuntimeError as exc:
            # Source not found for this year: log and continue
            print(f"  SKIP year {year}: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest PGE budget lines")
    parser.add_argument("--year", type=int, help="Single year to ingest")
    parser.add_argument("--from-year", type=int, help="Start of backfill range")
    parser.add_argument("--to-year",   type=int, help="End of backfill range (inclusive)")
    parser.add_argument("--resume", action="store_true",
                        help="Skip years already marked succeeded in etl_runs")
    parser.add_argument("--dry-run", action="store_true",
                        help="Download and parse but skip DB writes")
    args = parser.parse_args()

    if args.from_year or args.to_year:
        from_year = args.from_year or 2016
        to_year   = args.to_year   or args.from_year
        run_backfill(from_year=from_year, to_year=to_year, resume=args.resume, dry_run=args.dry_run)
        return

    if args.year:
        run_year(year=args.year, resume=args.resume, dry_run=args.dry_run)
        return

    # Default: current year
    import datetime
    run_year(year=datetime.date.today().year, resume=args.resume, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
