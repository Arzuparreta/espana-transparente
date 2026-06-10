"""ETL: ingest Presupuestos Generales del Estado (PGE) into budget_lines.

Primary source: Civio scraper-pge (2016-2023), via GitHub raw CSVs.
  gastos.csv: spending lines keyed by CENTRO GESTOR + FUNCIONAL + ECONOMICA
  estructura_organica.csv: section/service name lookup

Usage:
    PYTHONPATH=src python -m src.presupuestos.presupuestos --year 2023
    PYTHONPATH=src python -m src.presupuestos.presupuestos --year 2023 --dry-run
    PYTHONPATH=src python -m src.presupuestos.presupuestos --from-year 2016 --to-year 2023 --resume
"""

from __future__ import annotations

import argparse
import csv
import io
import zipfile
from collections import defaultdict
from datetime import date
from typing import Iterator

import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, is_chunk_succeeded, start_run
from common.responsibility import normalize_public_body
from presupuestos.sources import BudgetSource, available_years, download_funcional, download_gastos
from presupuestos.scraper_sepg import SepgRecord, scrape_year as scrape_sepg_year


# ─── Amount parsing ───────────────────────────────────────────────────────────

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


# ─── Civio-format parser ─────────────────────────────────────────────────────

def _load_organica(organica_bytes: bytes) -> dict[str, str]:
    """Build {CENTRO_GESTOR: section_name} lookup from estructura_organica.csv."""
    text = organica_bytes.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    lookup = {}
    for row in reader:
        key = row.get("CENTRO GESTOR", "").strip()
        name = row.get("DESCRIPCION LARGA", "").strip()
        if key and name:
            lookup[key] = name
    return lookup


def _load_funcional(funcional_bytes: bytes) -> dict[str, str]:
    """Build {program_code: program_name} lookup from estructura_funcional.csv."""
    if not funcional_bytes:
        return {}
    text = funcional_bytes.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    lookup = {}
    for row in reader:
        code = row.get("PROGRAMA", "").strip()
        name = (row.get("DESCRIPCION LARGA", "") or row.get("DESCRIPCION CORTA", "")).strip()
        if code and name:
            lookup[code] = name
    return lookup


def parse_civio_records(
    gastos_bytes: bytes,
    organica_bytes: bytes,
    source: BudgetSource,
    program_names: dict[str, str] | None = None,
) -> list[dict]:
    """Parse Civio scraper-pge gastos.csv into budget_lines records.

    Aggregates spending by (section_code, program_code, economic_chapter),
    keeping only chapter-level rows (ECONOMICA = single digit 1-9).
    IMPORTE is in euros.
    """
    organica = _load_organica(organica_bytes) if organica_bytes else {}

    text = gastos_bytes.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    raw_rows = list(reader)
    print(f"  Raw rows: {len(raw_rows)}")

    # Aggregate: sum IMPORTE by (section_code, program_code, chapter)
    totals: dict[tuple, int] = defaultdict(int)
    programs: dict[tuple, str] = {}   # (section, program) → description

    for row in raw_rows:
        centro = row.get("CENTRO GESTOR", "").strip()
        funcional = row.get("FUNCIONAL", "").strip()
        economica = row.get("ECONOMICA", "").strip()
        importe_raw = row.get("IMPORTE", "").strip()
        desc = row.get("DESCRIPCION", "").strip()

        if not centro or not funcional or not economica or not importe_raw:
            continue

        # Only chapter-level rows (ECONOMICA is a single digit 1-9)
        if not (economica.isdigit() and len(economica) == 1):
            continue

        chapter = int(economica)
        section_code = centro[:2]

        try:
            importe = int(importe_raw)
        except ValueError:
            try:
                importe = int(float(importe_raw))
            except ValueError:
                continue

        key = (section_code, funcional, chapter)
        totals[key] += importe

        # Keep the description of the chapter row as a hint for section/program
        if (section_code, funcional) not in programs and desc:
            programs[(section_code, funcional)] = desc

    print(f"  Aggregated to {len(totals)} section×program×chapter combinations")

    records = []
    for (section_code, program_code, chapter), credit_initial in totals.items():
        section_name = organica.get(section_code)
        # Fallback: try to find the section name from any matching key
        if not section_name:
            for k, v in organica.items():
                if k.startswith(section_code) and len(k) > 2:
                    section_name = organica.get(section_code) or v
                    break

        records.append({
            "year":                source.year,
            "budget_type":         source.budget_type,
            "source_kind":         "published",
            "source_year":         source.year,
            "in_force_year":       source.in_force_year or source.year,
            "section_code":        section_code,
            "section_name":        section_name,
            "service_code":        None,
            "service_name":        None,
            "program_code":        program_code,
            "program_name":        program_names.get(program_code) if program_names else None,
            "economic_chapter":    chapter,
            "economic_article":    None,
            "economic_concept":    None,
            "credit_initial":      float(credit_initial),
            "credit_final":        None,
            "ministry_normalized": normalize_public_body(section_name),
            "administration_level": "state",
            "source_url":          source.gastos_url,
            "raw_data":            psycopg2.extras.Json({
                "section_code": section_code,
                "program_code": program_code,
                "chapter":      chapter,
                "source":       source.notes,
                "budget_type": source.budget_type,
                "source_kind": "published",
            }),
        })

    print(f"  Built {len(records)} records for year {source.year}")
    return records


def parse_sepg_records(rows: list[SepgRecord], source: BudgetSource) -> list[dict]:
    """Convert SEPG prorroga rows into budget_lines records."""
    records = []
    for row in rows:
        records.append({
            "year":                 source.year,
            "budget_type":          source.budget_type,
            "source_kind":          "published_prorroga",
            "source_year":          source.year,
            "in_force_year":        source.in_force_year or source.year,
            "section_code":         row.section_code,
            "section_name":         row.section_name,
            "service_code":         None,
            "service_name":         None,
            "program_code":         row.program_code,
            "program_name":         row.program_name,
            "economic_chapter":     row.economic_chapter,
            "economic_article":     None,
            "economic_concept":     None,
            "credit_initial":       row.credit_initial,
            "credit_final":         None,
            "ministry_normalized":  normalize_public_body(row.section_name),
            "administration_level": "state",
            "source_url":           source.gastos_url,
            "raw_data":             psycopg2.extras.Json({
                "source": source.notes,
                "budget_type": source.budget_type,
                "source_kind": "published_prorroga",
                "in_force_year": source.in_force_year,
                "section_code": row.section_code,
                "program_code": row.program_code,
                "economic_chapter": row.economic_chapter,
            }),
        })

    print(f"  Built {len(records)} SEPG records for year {source.year}")
    return records


def build_carried_forward_records(
    base_records: list[dict],
    source: BudgetSource,
    *,
    section_codes: set[str],
) -> list[dict]:
    """Clone missing prórroga sections from the in-force approved budget."""
    if source.budget_type != "prorroga" or source.in_force_year is None:
        return []

    carried = []
    for base in base_records:
        section_code = str(base.get("section_code") or "")
        if section_code not in section_codes:
            continue

        raw = dict(base.get("raw_data") or {})
        raw.update({
            "source": source.notes,
            "budget_type": source.budget_type,
            "source_kind": "carried_forward",
            "source_year": source.in_force_year,
            "in_force_year": source.in_force_year,
        })

        carried.append({
            **base,
            "year": source.year,
            "budget_type": source.budget_type,
            "source_kind": "carried_forward",
            "source_year": source.in_force_year,
            "in_force_year": source.in_force_year,
            "source_url": source.gastos_url,
            "raw_data": psycopg2.extras.Json(raw),
        })

    return carried


def load_base_budget_records(conn, *, source: BudgetSource, section_codes: set[str]) -> list[dict]:
    if source.in_force_year is None or not section_codes:
        return []

    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT
          section_code,
          section_name,
          service_code,
          service_name,
          program_code,
          program_name,
          economic_chapter,
          economic_article,
          economic_concept,
          credit_initial,
          credit_final,
          ministry_normalized,
          administration_level,
          source_url,
          raw_data
        FROM budget_lines
        WHERE year = %s
          AND budget_type = 'ley'
          AND section_code = ANY(%s)
        """,
        (source.in_force_year, list(section_codes)),
    )
    rows = [dict(row) for row in cur.fetchall()]
    cur.close()
    return rows


def add_carried_forward_prorroga_sections(conn, records: list[dict], source: BudgetSource) -> list[dict]:
    """Include budget sections that remain in force but are absent from SEPG prórroga ROM."""
    if source.budget_type != "prorroga" or source.in_force_year is None:
        return records

    required_sections = {"60"}  # Seguridad Social: published in PGE 2023, omitted from SEPG prórroga ROM.
    present_sections = {str(record.get("section_code") or "") for record in records}
    missing_sections = required_sections - present_sections
    if not missing_sections:
        return records

    base_records = load_base_budget_records(conn, source=source, section_codes=missing_sections)
    carried = build_carried_forward_records(base_records, source, section_codes=missing_sections)
    if missing_sections and not carried:
        raise RuntimeError(
            f"Cannot carry forward sections {sorted(missing_sections)} for {source.year}: "
            f"no approved {source.in_force_year} budget rows found."
        )

    print(
        f"  Carried forward {len(carried)} rows from PGE {source.in_force_year} "
        f"for sections {', '.join(sorted(missing_sections))}"
    )
    return records + carried


# ─── Generic CSV parser (fallback / tests) ───────────────────────────────────

def detect_delimiter(first_line: str) -> str:
    if first_line.count(";") > first_line.count(","):
        return ";"
    if "\t" in first_line:
        return "\t"
    return ","


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
    for col in header:
        if col.lower().strip().replace(" ", "_") in aliases:
            return col
    return None


def parse_records(raw: bytes, source: BudgetSource) -> list[dict]:
    """Generic CSV/ZIP parser for non-Civio sources (used in tests and as fallback)."""
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

    for enc in (source.encoding if hasattr(source, "encoding") else "utf-8", "utf-8-sig", "utf-8", "latin-1"):
        try:
            sample = data[:4096].decode(enc)
            encoding = enc
            break
        except (UnicodeDecodeError, AttributeError):
            continue
    else:
        encoding = "latin-1"

    first_line = data.decode(encoding, errors="replace").split("\n")[0]
    delimiter = detect_delimiter(first_line)
    print(f"  Format: enc={encoding}, delimiter={repr(delimiter)}, file={filename or 'inline'}")

    rows = list(csv.DictReader(io.StringIO(data.decode(encoding, errors="replace")), delimiter=delimiter))
    if not rows:
        raise RuntimeError("No rows found in source file")

    header = list(rows[0].keys())
    print(f"  Header ({len(header)} cols): {header[:10]}")

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
            "budget_type":         source.budget_type,
            "source_kind":         "published",
            "source_year":         source.year,
            "in_force_year":       source.in_force_year or source.year,
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
            "source_url":          getattr(source, "gastos_url", getattr(source, "url", "")),
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
              budget_type, source_kind, source_year, in_force_year,
              program_code, program_name,
              economic_chapter, economic_article, economic_concept,
              credit_initial, credit_final,
              ministry_normalized, administration_level,
              source_url, raw_data, updated_at
            ) VALUES (
              %(year)s, %(section_code)s, %(section_name)s,
              %(service_code)s, %(service_name)s,
              %(budget_type)s, %(source_kind)s, %(source_year)s, %(in_force_year)s,
              %(program_code)s, %(program_name)s,
              %(economic_chapter)s, %(economic_article)s, %(economic_concept)s,
              %(credit_initial)s, %(credit_final)s,
              %(ministry_normalized)s, %(administration_level)s,
              %(source_url)s, %(raw_data)s, now()
            )
            ON CONFLICT (year, budget_type, section_code, program_code, economic_chapter) DO UPDATE SET
              section_name        = EXCLUDED.section_name,
              service_code        = EXCLUDED.service_code,
              service_name        = EXCLUDED.service_name,
              source_kind         = EXCLUDED.source_kind,
              source_year         = EXCLUDED.source_year,
              in_force_year       = EXCLUDED.in_force_year,
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
        # Record the skip as a succeeded run with zero rows so that
        # v_etl_pipeline_status reflects the fact that the ETL ran
        # and decided the chunk was up to date. Without this, the
        # freshness view keeps showing the previous run's date and
        # the portal marks the pipeline as "delayed" forever.
        run_id = start_run(
            cur,
            pipeline=pipeline,
            chunk_key=chunk_key,
            window_start=window_start,
            window_end=window_end,
        )
        conn.commit()
        finish_run(
            cur,
            run_id=run_id,
            status="succeeded",
            rows_read=0,
            rows_inserted=0,
        )
        conn.commit()
        cur.close()
        conn.close()
        print(f"Skipping {year}: already succeeded (recorded as succeeded with 0 rows)")
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
        gastos_bytes, organica_bytes, source = download_gastos(year)

        if source.fmt == "civio":
            funcional_bytes = download_funcional(source)
            funcional = _load_funcional(funcional_bytes)
            print(f"  funcional lookup: {len(funcional)} program codes")
            records = parse_civio_records(gastos_bytes, organica_bytes, source, program_names=funcional)
        elif source.fmt == "sepg_prorroga":
            records = parse_sepg_records(scrape_sepg_year(year, verbose=not dry_run), source)
            if conn:
                records = add_carried_forward_prorroga_sections(conn, records, source)
            else:
                print("  Dry run: skipping DB-backed carried-forward prórroga sections")
        else:
            records = parse_records(gastos_bytes, source)

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
            print(f"  SKIP year {year}: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest PGE budget lines")
    parser.add_argument("--year", type=int, help="Single year to ingest")
    parser.add_argument("--from-year", type=int, help="Start of backfill range (default 2016)")
    parser.add_argument("--to-year",   type=int, help="End of backfill range (default 2023)")
    parser.add_argument("--resume", action="store_true",
                        help="Skip years already marked succeeded in etl_runs")
    parser.add_argument("--dry-run", action="store_true",
                        help="Download and parse but skip DB writes")
    parser.add_argument("--list-years", action="store_true",
                        help="List available years and exit")
    args = parser.parse_args()

    if args.list_years:
        print("Available years:", available_years())
        return

    if args.from_year or args.to_year:
        from_year = args.from_year or 2016
        to_year   = args.to_year   or max(available_years())
        run_backfill(from_year=from_year, to_year=to_year, resume=args.resume, dry_run=args.dry_run)
        return

    if args.year:
        run_year(year=args.year, resume=args.resume, dry_run=args.dry_run)
        return

    # Default: most recent available year
    run_year(year=max(available_years()), resume=args.resume, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
