"""OCR-based structured extraction from Congreso declaration PDFs.

The Congreso publishes scanned-image PDFs (not machine-readable). This module:
1. Downloads PDFs referenced in economic_declarations
2. Converts pages to images via pdf2image
3. Runs EasyOCR (Spanish) to extract text
4. Parses income/asset fields with regex
5. Upserts structured data into economic_declarations.raw_data

Usage:
    PYTHONPATH=src python -m src.congreso.declaraciones_ocr --dry-run
    PYTHONPATH=src python -m src.congreso.declaraciones_ocr --limit 5
    PYTHONPATH=src python -m src.congreso.declaraciones_ocr  # all
    PYTHONPATH=src python -m src.congreso.declaraciones_ocr --resume
    PYTHONPATH=src python -m src.congreso.declaraciones_ocr --kind intereses_economicos --resume
"""

import argparse
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import numpy as np
import psycopg2.extras
from pdf2image import convert_from_path

from common.db import get_pg_conn

# ── Configuration ────────────────────────────────────────────────────────────

REQUEST_DELAY = 2.0  # seconds between PDF downloads (be nice to congreso.es)
OCR_DPI = 150  # resolution for PDF→image conversion (150 is good enough for Spanish text)
BATCH_SIZE = 5  # how many PDFs to process before committing
PDF_CONVERT_TIMEOUT = 60  # seconds per PDF conversion
PDF_CONVERT_THREADS = 2
PARALLEL_WORKERS = 4  # number of parallel OCR workers
OCR_MAX_PAGES = 3  # only OCR first N pages (skip boilerplate instruction pages)

DECLARATION_KIND_PATTERNS = {
    "bienes_rentas": "%docbienes%",
    "intereses_economicos": "%docacteco%",
}

# ── Regex patterns for field extraction ──────────────────────────────────────

# Spanish-formatted numbers: 55.348,17 or 1.234 or 123,45
AMOUNT_RE = re.compile(r"(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*(?:€|euros|EUROS)?")

# Income source patterns
INCOME_LINE_RE = re.compile(
    r"(.{5,80}?)[\s:]+(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)",
    re.IGNORECASE,
)

# IRPF total
IRPF_RE = re.compile(
    r"(?:cuota\s+l[íi]quida|IRPF|pagada\s+en\s+el\s+ejercicio).*?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2}))",
    re.IGNORECASE | re.DOTALL,
)

# Total income sum
TOTAL_INCOME_RE = re.compile(
    r"(?:total|suma)\s+(?:rentas|ingresos|percepciones).*?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2}))",
    re.IGNORECASE | re.DOTALL,
)

# Bienes inmuebles (real estate)
INMUEBLE_RE = re.compile(
    r"(?:inmueble|vivienda|piso|apartamento|casa|garaje|trastero|finca|parcela|local)",
    re.IGNORECASE,
)

# Vehículos
VEHICULO_RE = re.compile(
    r"(?:veh[ií]culo|autom[oó]vil|coche|moto|turismo)",
    re.IGNORECASE,
)

# Financial assets
FINANCIERO_RE = re.compile(
    r"(?:cuenta\s+(?:corriente|bancaria|ahorro)|dep[oó]sito|fondo\s+de\s+inversi[oó]n|acciones|participaciones|plan\s+de\s+pensiones)",
    re.IGNORECASE,
)


def _parse_amount(text: str) -> float | None:
    """Parse a Spanish-formatted number like 55.348,17 → 55348.17"""
    if not text:
        return None
    cleaned = text.strip().replace("€", "").replace("euros", "").replace("EUROS", "")
    cleaned = cleaned.replace(" ", "")
    # Spanish format: 55.348,17 → remove dots, replace comma with dot
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(".", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _download_pdf(url: str, dest: Path) -> bool:
    """Download a PDF, return True on success."""
    try:
        result = subprocess.run(
            [
                "curl", "-sL", "--max-time", "30",
                "-H", "User-Agent: Mozilla/5.0 (compatible; AccionHumana/1.0)",
                "-o", str(dest), url,
            ],
            capture_output=True, text=True, timeout=35,
        )
        return result.returncode == 0 and dest.stat().st_size > 1000
    except Exception:
        return False


def _source_filter_for_kind(kind: str) -> tuple[str, list[str]]:
    if kind == "all":
        placeholders = " OR ".join(["source_url LIKE %s"] * len(DECLARATION_KIND_PATTERNS))
        return f"AND ({placeholders})", list(DECLARATION_KIND_PATTERNS.values())
    return "AND source_url LIKE %s", [DECLARATION_KIND_PATTERNS[kind]]


def _resume_filter(retry_failed: bool) -> str:
    status_filter = "" if retry_failed else "AND COALESCE(raw_data->>'ocr_status', '') != 'failed'"
    return f"""
          AND raw_data->>'ocr_processed_at' IS NULL
          {status_filter}
    """


def _with_ocr_success(existing: dict[str, Any], fields: dict[str, Any]) -> dict[str, Any]:
    merged = {
        **existing,
        **fields,
        "ocr_status": "ok",
        "ocr_processed_at": datetime.now(timezone.utc).isoformat(),
    }
    merged.pop("ocr_error", None)
    return merged


def _with_ocr_failure(existing: dict[str, Any], error: str) -> dict[str, Any]:
    return {
        **existing,
        "ocr_status": "failed",
        "ocr_error": error,
        "ocr_attempted_at": datetime.now(timezone.utc).isoformat(),
    }


def _commit_if_batch_boundary(conn, touched: int, dry_run: bool) -> None:
    if touched > 0 and touched % BATCH_SIZE == 0 and not dry_run:
        conn.commit()
        print(f"  [committed {touched} touched records]")


def _ocr_pdf(pdf_path: Path, reader, max_pages: int = OCR_MAX_PAGES) -> str:
    """Convert PDF to images and run OCR, return concatenated text."""
    try:
        images = convert_from_path(
            str(pdf_path),
            dpi=OCR_DPI,
            first_page=1,
            last_page=min(max_pages, 99),
            thread_count=PDF_CONVERT_THREADS,
            timeout=PDF_CONVERT_TIMEOUT,
        )
    except Exception as exc:
        print(f"    pdf2image error: {exc}")
        return ""

    texts = []
    for i, img in enumerate(images):
        try:
            # EasyOCR needs a numpy array, not a PIL Image
            img_array = np.array(img)
            results = reader.readtext(img_array, detail=0, paragraph=True)
            page_text = "\n".join(results)
            texts.append(page_text)
        except Exception as exc:
            print(f"    OCR error on page {i}: {exc}")

    return "\n--- PAGE BREAK ---\n".join(texts)


def _extract_fields(ocr_text: str) -> dict[str, Any]:
    """Extract structured fields from OCR'd declaration text."""
    fields: dict[str, Any] = {}

    # Extract income lines: look for label ending with Spanish-formatted number
    # Only match numbers with thousand separators (e.g. 55.348,17) to avoid noise
    incomes = []
    for match in INCOME_LINE_RE.finditer(ocr_text):
        label = match.group(1).strip()
        amount_str = match.group(2)
        amount = _parse_amount(amount_str)
        # Only accept amounts > 100€ (filter out page numbers, dates, etc.)
        if amount and amount > 100 and len(label) > 5:
            # Filter out obvious non-income lines
            skip_words = [
                "página", "pagina", "fecha", "libro", "cortes", "legislatura",
                "nombre", "apellidos", "diputado", "senador", "diciembre",
                "enero", "febrero", "marzo", "abril", "mayo", "junio",
                "julio", "agosto", "septiembre", "octubre", "noviembre",
                "circunscripción", "estado civil", "régimen",
            ]
            if not any(w in label.lower() for w in skip_words):
                incomes.append({"source": label[:120], "amount": round(amount, 2)})

    # Deduplicate by source prefix
    seen = set()
    unique_incomes = []
    for inc in incomes:
        key = inc["source"][:30]
        if key not in seen:
            seen.add(key)
            unique_incomes.append(inc)

    if unique_incomes:
        fields["incomes"] = unique_incomes
        fields["total_income"] = round(sum(inc["amount"] for inc in unique_incomes), 2)

    # Extract IRPF
    irpf_match = IRPF_RE.search(ocr_text)
    if irpf_match:
        irpf = _parse_amount(irpf_match.group(1))
        if irpf:
            fields["irpf_paid"] = irpf

    # Count asset types mentioned
    fields["inmuebles_mentioned"] = len(INMUEBLE_RE.findall(ocr_text))
    fields["vehiculos_mentioned"] = len(VEHICULO_RE.findall(ocr_text))
    fields["financial_assets_mentioned"] = len(FINANCIERO_RE.findall(ocr_text))

    # Store full OCR text for reference (researchers can read it)
    fields["ocr_text"] = ocr_text

    return fields


def _process_one(row: tuple, reader) -> dict:
    """Process a single declaration: download, OCR, extract. Returns result dict."""
    decl_id, pol_id, decl_date, source_url, raw_data = row
    existing = raw_data or {}
    started = time.monotonic()

    with TemporaryDirectory() as tmpdir:
        pdf_path = Path(tmpdir) / "decl.pdf"

        if not _download_pdf(source_url, pdf_path):
            return {
                "id": decl_id,
                "status": "download_failed",
                "raw_data": _with_ocr_failure(existing, "download_failed"),
                "elapsed": time.monotonic() - started,
            }

        ocr_text = _ocr_pdf(pdf_path, reader)
        if not ocr_text:
            return {
                "id": decl_id,
                "status": "ocr_empty",
                "raw_data": _with_ocr_failure(existing, "ocr_empty"),
                "elapsed": time.monotonic() - started,
            }

        fields = _extract_fields(ocr_text)
        merged = _with_ocr_success(existing, fields)
        return {
            "id": decl_id,
            "status": "ok",
            "raw_data": merged,
            "incomes": len(fields.get("incomes", [])),
            "total": fields.get("total_income"),
            "elapsed": time.monotonic() - started,
        }


def run(
    dry_run: bool = False,
    limit: int | None = None,
    resume: bool = False,
    kind: str = "bienes_rentas",
    retry_failed: bool = False,
    workers: int = PARALLEL_WORKERS,
) -> None:
    conn = get_pg_conn()
    cur = conn.cursor()

    # Fetch declarations that need OCR processing
    kind_filter, params = _source_filter_for_kind(kind)
    resume_filter = _resume_filter(retry_failed) if resume else ""
    limit_clause = "LIMIT %s" if limit else ""
    if limit:
        params.append(limit)

    cur.execute(
        f"""
        SELECT id, politician_id, declaration_date, source_url, raw_data
        FROM economic_declarations
        WHERE source_url IS NOT NULL
          {kind_filter}
          {resume_filter}
        ORDER BY declaration_date DESC NULLS LAST
        {limit_clause}
        """,
        params,
    )
    rows = cur.fetchall()
    total = len(rows)
    print(f"Found {total} {kind} declarations to OCR-process (workers={workers})")

    if dry_run:
        print("[DRY-RUN] Would process these declarations (no OCR will run)")
        for row in rows[:10]:
            print(f"  {row[1]} | {row[2]} | {row[3][:80]}...")
        if len(rows) > 10:
            print(f"  ... and {len(rows) - 10} more")
        cur.close()
        conn.close()
        return

    # Load EasyOCR once, then parallelize with threads (GIL is released during inference)
    print("Loading EasyOCR Spanish model (one-time)...")
    import easyocr
    reader = easyocr.Reader(["es"], gpu=False)
    print(f"OCR ready. Processing with {workers} threads.")

    from concurrent.futures import ThreadPoolExecutor, as_completed

    processed = 0
    errors = 0
    touched = 0
    started_at = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_process_one, row, reader): i
            for i, row in enumerate(rows)
        }

        for future in as_completed(futures):
            idx = futures[future]
            try:
                result = future.result()
            except Exception as exc:
                print(f"[{idx+1}/{total}] WORKER CRASH: {exc}")
                errors += 1
                continue

            status = result["status"]
            elapsed = result.get("elapsed", 0)

            if status == "ok":
                cur.execute(
                    "UPDATE economic_declarations SET raw_data = %s WHERE id = %s",
                    (psycopg2.extras.Json(result["raw_data"]), result["id"]),
                )
                total_str = f", total={result['total']:,.0f}€" if result.get("total") else ""
                print(f"[{idx+1}/{total}] OK ({result['incomes']} incomes{total_str}, {elapsed:.1f}s)")
                processed += 1
            else:
                cur.execute(
                    "UPDATE economic_declarations SET raw_data = %s WHERE id = %s",
                    (psycopg2.extras.Json(result["raw_data"]), result["id"]),
                )
                print(f"[{idx+1}/{total}] {status.upper()} ({elapsed:.1f}s)")
                errors += 1

            touched += 1
            _commit_if_batch_boundary(conn, touched, dry_run)

            # Progress estimate
            if touched % 10 == 0:
                elapsed_total = time.monotonic() - started_at
                rate = touched / elapsed_total
                remaining = (total - touched) / rate if rate > 0 else 0
                print(f"  [{touched}/{total}] {rate:.2f}/s, ETA {remaining/60:.0f}m")

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()
    total_elapsed = time.monotonic() - started_at
    print(f"\nDone! {processed} processed, {errors} errors in {total_elapsed/60:.1f}m")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--resume", action="store_true",
                        help="Only process declarations not yet OCR'd")
    parser.add_argument("--kind", choices=[*DECLARATION_KIND_PATTERNS.keys(), "all"],
                        default="bienes_rentas")
    parser.add_argument("--retry-failed", action="store_true",
                        help="Include previously failed OCR records when used with --resume")
    parser.add_argument("--workers", type=int, default=PARALLEL_WORKERS,
                        help=f"Number of parallel OCR workers (default: {PARALLEL_WORKERS})")
    args = parser.parse_args()
    run(
        dry_run=args.dry_run,
        limit=args.limit,
        resume=args.resume,
        kind=args.kind,
        retry_failed=args.retry_failed,
        workers=args.workers,
    )


if __name__ == "__main__":
    main()
