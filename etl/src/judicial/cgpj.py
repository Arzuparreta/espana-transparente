"""CGPJ corruption-process repository ingestion.

The CGPJ reusable files are statistical/procedural sources. They can populate
case/proceeding rows, but named actors and contract links remain behind the
manual review gate.

Usage:
    PYTHONPATH=src python -m judicial.cgpj --dry-run --source-url <csv-or-xlsx-url>
    PYTHONPATH=src python -m judicial.cgpj --source-url <csv-or-xlsx-url>
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from datetime import date
from hashlib import sha256
from io import BytesIO, StringIO
import re
from typing import Any

import httpx
import pandas as pd
import psycopg2.extras
from bs4 import BeautifulSoup

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run

# The main Ficheros-reutilizables listing page requires JavaScript to render
# period-specific detail links. Use detail page URLs (Datos-del-...) directly.
CGPJ_DETAIL_URLS = [
    "https://www.poderjudicial.es/cgpj/es/Temas/Transparencia/"
    "Repositorio-de-datos-sobre-procesos-por-corrupcion/Ficheros-reutilizables/"
    "Datos-del-cuarto-trimestre-2025-Resumen-nacional",
    "https://www.poderjudicial.es/cgpj/es/Temas/Transparencia/"
    "Repositorio-de-datos-sobre-procesos-por-corrupcion/Ficheros-reutilizables/"
    "Datos-del-cuarto-trimestre-2025-Comunidades-Autonomas",
]

CGPJ_REUSABLE_FILES_URL = CGPJ_DETAIL_URLS[0]  # default: latest national summary

STATUS_VALUES = {
    "procesamiento_o_juicio_oral",
    "condena_no_firme",
    "condena_firme",
    "absuelto",
    "sobreseido",
    "desconocido",
}


@dataclass(frozen=True)
class JudicialCase:
    title: str
    source_url: str
    external_id: str
    source_name: str = "CGPJ"
    source_type: str = "cgpj"
    court_body: str | None = None
    territory: str | None = None
    offence_category: str | None = None
    procedural_status: str = "desconocido"
    procedure_type: str | None = None
    summary: str | None = None
    source_published_at: date | None = None
    last_verified_at: date = field(default_factory=date.today)
    raw_data: dict[str, Any] = field(default_factory=dict)


def normalize_header(value: str) -> str:
    text = value.strip().lower()
    text = (
        text.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ü", "u")
        .replace("ñ", "n")
    )
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def clean_cell(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return None
    return text


def first_value(row: dict[str, Any], *candidates: str) -> str | None:
    for candidate in candidates:
        value = clean_cell(row.get(candidate))
        if value:
            return value
    return None


def map_status(*values: str | None) -> str:
    text = " ".join(value for value in values if value).lower()
    if not text:
        return "desconocido"
    if re.search(r"\babsolu(?:cion|ción|t[oa])s?\b", text):
        return "absuelto"
    if "sobresei" in text or "archivo" in text:
        return "sobreseido"
    if "conden" in text and "no firme" in text:
        return "condena_no_firme"
    if "conden" in text and ("firme" in text or "ejecutoria" in text):
        return "condena_firme"
    if "conden" in text:
        return "condena_no_firme"
    if "juicio oral" in text or "procesamiento" in text or "procesad" in text:
        return "procesamiento_o_juicio_oral"
    return "desconocido"


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return date.fromisoformat(value)
    for dayfirst in (True, False):
        parsed = pd.to_datetime(value, dayfirst=dayfirst, errors="coerce")
        if not pd.isna(parsed):
            return parsed.date()
    return None


def stable_external_id(source_url: str, row_index: int, row: dict[str, Any]) -> str:
    basis = "|".join(
        clean_cell(row.get(key)) or ""
        for key in sorted(row)
        if not key.startswith("unnamed")
    )
    digest = sha256(f"{source_url}|{row_index}|{basis}".encode("utf-8")).hexdigest()
    return digest[:32]


def build_case(row: dict[str, Any], row_index: int, source_url: str) -> JudicialCase | None:
    title = first_value(
        row,
        "titulo",
        "procedimiento",
        "tipo_de_procedimiento",
        "tipo_procedimiento",
        "organo_judicial",
        "ambito",
    )
    court = first_value(row, "organo_judicial", "organo", "tribunal", "juzgado")
    territory = first_value(row, "territorio", "comunidad_autonoma", "ccaa", "provincia", "ambito")
    offence = first_value(row, "delito", "tipo_delito", "categoria", "materia")
    procedure_type = first_value(row, "tipo_procedimiento", "tipo_de_procedimiento", "procedimiento")
    status_text = first_value(row, "estado", "situacion", "fase", "tipo_dato", "indicador")
    status = map_status(title, procedure_type, status_text, offence)
    summary = first_value(row, "resumen", "descripcion", "observaciones", "indicador")
    published_at = parse_date(first_value(row, "fecha", "periodo", "trimestre"))

    if not title:
        title = "Proceso judicial por corrupción"
    detail = " · ".join(part for part in [territory, court, procedure_type] if part)
    if detail:
        title = f"{title} · {detail}"

    raw = {key: clean_cell(value) for key, value in row.items() if clean_cell(value)}
    return JudicialCase(
        title=title[:500],
        court_body=court,
        territory=territory,
        offence_category=offence,
        procedural_status=status if status in STATUS_VALUES else "desconocido",
        procedure_type=procedure_type,
        summary=summary,
        source_url=source_url,
        source_published_at=published_at,
        external_id=stable_external_id(source_url, row_index, row),
        raw_data=raw,
    )


def cases_from_dataframe(df: pd.DataFrame, source_url: str) -> list[JudicialCase]:
    normalized = df.rename(columns={column: normalize_header(str(column)) for column in df.columns})
    cases: list[JudicialCase] = []
    for index, row in normalized.iterrows():
        case = build_case(row.to_dict(), int(index), source_url)
        if case:
            cases.append(case)
    return cases


def read_cases_from_bytes(content: bytes, source_url: str) -> list[JudicialCase]:
    suffix = source_url.lower().split("?")[0]
    if suffix.endswith((".xlsx", ".xls")):
        df = pd.read_excel(BytesIO(content))
    else:
        text = content.decode("utf-8-sig")
        separator = ";" if text.count(";") >= text.count(",") else ","
        df = pd.read_csv(StringIO(text), sep=separator)
    return cases_from_dataframe(df, source_url)


def discover_reusable_file_url(html: str, base_url: str) -> str | None:
    """Find the .xlsx/.csv download link embedded in a CGPJ detail page."""
    soup = BeautifulSoup(html, "html.parser")
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if re.search(r"\.(csv|xlsx?|ods)(\?|$)", href.lower()):
            return str(httpx.URL(base_url).join(href))
    return None


def fetch_cases_from_detail_page(client: httpx.Client, detail_url: str) -> list[JudicialCase]:
    """Fetch and parse cases from a single CGPJ detail page.

    Each detail page (e.g. Datos-del-cuarto-trimestre-2025-Resumen-nacional)
    contains a link to the actual .xlsx file.
    """
    response = client.get(detail_url)
    response.raise_for_status()
    file_url = discover_reusable_file_url(response.text, str(response.url))
    if not file_url:
        raise RuntimeError(f"No .xlsx/.csv link found on detail page: {detail_url}")
    file_resp = client.get(file_url)
    file_resp.raise_for_status()
    return read_cases_from_bytes(file_resp.content, str(file_resp.url))


def fetch_cases(source_url: str) -> list[JudicialCase]:
    """Fetch cases from a CGPJ URL.

    Supports:
      - Direct .xlsx/.csv URL → download and parse immediately.
      - Detail page URL (Datos-del-...) → discover the embedded .xlsx link.
    """
    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        response = client.get(source_url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        final_url = str(response.url)

        # Direct file URL
        if final_url.lower().endswith((".csv", ".xls", ".xlsx")):
            return read_cases_from_bytes(response.content, final_url)

        if "text/html" in content_type:
            return fetch_cases_from_detail_page(client, final_url)

        raise RuntimeError(f"Unexpected content type: {content_type}")


def upsert_cases(cur, cases: list[JudicialCase]) -> int:
    count = 0
    for case in cases:
        cur.execute(
            """
            INSERT INTO corruption_cases (
              source_type, source_name, external_id, title, court_body, territory,
              offence_category, procedural_status, procedure_type, summary,
              source_url, source_published_at, last_verified_at, raw_data
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (source_type, external_id) WHERE external_id IS NOT NULL
            DO UPDATE SET
              title = EXCLUDED.title,
              court_body = EXCLUDED.court_body,
              territory = EXCLUDED.territory,
              offence_category = EXCLUDED.offence_category,
              procedural_status = EXCLUDED.procedural_status,
              procedure_type = EXCLUDED.procedure_type,
              summary = EXCLUDED.summary,
              source_url = EXCLUDED.source_url,
              source_published_at = EXCLUDED.source_published_at,
              last_verified_at = EXCLUDED.last_verified_at,
              raw_data = EXCLUDED.raw_data,
              updated_at = now()
            """,
            (
                case.source_type,
                case.source_name,
                case.external_id,
                case.title,
                case.court_body,
                case.territory,
                case.offence_category,
                case.procedural_status,
                case.procedure_type,
                case.summary,
                case.source_url,
                case.source_published_at,
                case.last_verified_at,
                psycopg2.extras.Json(case.raw_data),
            ),
        )
        count += 1
    return count


def run(source_url: str, dry_run: bool = False, all_periods: bool = False) -> tuple[int, int]:
    """Run CGPJ ingestion.

    By default, ingests from the given source_url (default: latest national detail page).
    With --all, ingests from all known CGPJ_DETAIL_URLS.
    """
    urls = CGPJ_DETAIL_URLS if all_periods else [source_url]
    all_cases: list[JudicialCase] = []

    for url in urls:
        cases = fetch_cases(url)
        all_cases.extend(cases)

    if dry_run:
        print(f"[DRY-RUN] Parsed {len(all_cases)} CGPJ rows from {len(urls)} source(s)")
        for case in all_cases[:10]:
            print(f"  {case.procedural_status} | {case.title[:120]} | {case.source_url}")
        return len(all_cases), 0

    conn = get_pg_conn()
    run_id = None
    try:
        with conn.cursor() as cur:
            chunk_key = "all" if all_periods else source_url
            run_id = start_run(cur, pipeline="judicial.cgpj", chunk_key=chunk_key)
            inserted = upsert_cases(cur, all_cases)
            finish_run(cur, run_id=run_id, status="succeeded", rows_read=len(all_cases), rows_updated=inserted)
            conn.commit()
        print(f"CGPJ judicial rows: read={len(all_cases)} upserted={inserted}")
        return len(all_cases), inserted
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:
                finish_run(cur, run_id=run_id, status="failed", rows_read=len(all_cases), error_summary=str(exc)[:500])
                conn.commit()
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest CGPJ corruption-process reusable files")
    parser.add_argument("--source-url", default=CGPJ_REUSABLE_FILES_URL,
                        help="Detail page URL or direct .xlsx URL (default: latest national summary)")
    parser.add_argument("--all", action="store_true",
                        help="Ingest all known periods (national + CCAA detail pages)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", action="store_true",
                        help="Accepted for scheduler compatibility; upserts are idempotent.")
    args = parser.parse_args()
    run(source_url=args.source_url, dry_run=args.dry_run, all_periods=args.all)


if __name__ == "__main__":
    main()
