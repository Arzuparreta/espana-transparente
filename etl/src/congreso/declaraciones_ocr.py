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
"""

import argparse
import json
import re
import subprocess
import sys
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
OCR_DPI = 200  # resolution for PDF→image conversion
BATCH_SIZE = 5  # how many PDFs to process before committing

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


def _ocr_pdf(pdf_path: Path, reader) -> str:
    """Convert PDF to images and run OCR, return concatenated text."""
    try:
        images = convert_from_path(str(pdf_path), dpi=OCR_DPI)
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


def run(
    dry_run: bool = False,
    limit: int | None = None,
    resume: bool = False,
) -> None:
    conn = get_pg_conn()
    cur = conn.cursor()

    # Fetch declarations that need OCR processing
    where = ""
    if resume:
        where = "AND raw_data->>'ocr_preview' IS NULL"
    else:
        where = ""

    cur.execute(
        f"""
        SELECT id, politician_id, declaration_date, source_url, raw_data
        FROM economic_declarations
        WHERE source_url IS NOT NULL
          AND source_url LIKE '%docbienes%'
          {where}
        ORDER BY declaration_date DESC NULLS LAST
        {"LIMIT " + str(limit) if limit else ""}
        """,
    )
    rows = cur.fetchall()
    print(f"Found {len(rows)} bienes_rentas declarations to OCR-process")

    if dry_run:
        print("[DRY-RUN] Would process these declarations (no OCR will run)")
        for row in rows[:10]:
            print(f"  {row[1]} | {row[2]} | {row[3][:80]}...")
        print(f"  ... and {len(rows) - 10} more" if len(rows) > 10 else "")
        cur.close()
        conn.close()
        return

    # Initialize EasyOCR once (slow first load)
    print("Loading EasyOCR Spanish model (one-time)...")
    import easyocr
    reader = easyocr.Reader(["es"], gpu=False)
    print("OCR ready.")

    processed = 0
    errors = 0

    for i, (decl_id, pol_id, decl_date, source_url, raw_data) in enumerate(rows):
        if i > 0:
            time.sleep(REQUEST_DELAY)

        label = f"[{i+1}/{len(rows)}]"
        print(f"{label} Decl {decl_id[:8]}... | {decl_date or 'no-date'}", end=" ", flush=True)

        with TemporaryDirectory() as tmpdir:
            pdf_path = Path(tmpdir) / "decl.pdf"

            if not _download_pdf(source_url, pdf_path):
                print("DOWNLOAD FAILED")
                errors += 1
                continue

            ocr_text = _ocr_pdf(pdf_path, reader)
            if not ocr_text:
                print("OCR EMPTY")
                errors += 1
                continue

            fields = _extract_fields(ocr_text)

            # Merge with existing raw_data
            existing = raw_data or {}
            merged = {**existing, **fields, "ocr_processed_at": datetime.now(timezone.utc).isoformat()}

            if not dry_run:
                cur.execute(
                    """
                    UPDATE economic_declarations
                    SET raw_data = %s
                    WHERE id = %s
                    """,
                    (psycopg2.extras.Json(merged), decl_id),
                )
                processed += 1

            income_count = len(fields.get("incomes", []))
            total = fields.get("total_income")
            total_str = f", total={total:,.0f}€" if total else ""
            print(f"OK ({income_count} incomes{total_str})")

        # Commit periodically
        if processed > 0 and processed % BATCH_SIZE == 0 and not dry_run:
            conn.commit()
            print(f"  [committed {processed} records]")

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone! {processed} processed, {errors} errors.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--resume", action="store_true",
                        help="Only process declarations not yet OCR'd")
    args = parser.parse_args()
    run(dry_run=args.dry_run, limit=args.limit, resume=args.resume)


if __name__ == "__main__":
    main()
