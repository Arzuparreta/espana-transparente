"""Scrape PGE budget data from SEPG ROM HTML/CSV format.

Used for prórroga years (2024, 2025) where Civio scraper-pge has no data.
Each section's 'estado de gastos' page lists individual program CSVs.
Amounts are in miles de euros (thousands); we store in euros.

Usage:
    PYTHONPATH=src python -m src.presupuestos.scraper_sepg --year 2024 --dry-run
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import re
import subprocess
import tempfile
import time
from collections import defaultdict
from dataclasses import dataclass, field

REQUEST_DELAY = float(os.getenv("SEPG_REQUEST_DELAY", "1.0"))
_BASE = "https://www.sepg.pap.hacienda.gob.es/Presup"

# ROM folder name per prórroga year  (update when SEPG publishes new ones)
PRORROGA_FOLDERS: dict[int, str] = {
    2024: "PGE2024Prorroga",
    2025: "PGE2025Prorroga",
}


@dataclass
class SepgRecord:
    section_code: str
    section_name: str | None
    program_code: str
    program_name: str | None
    economic_chapter: int
    credit_initial: float  # euros (converted from thousands)


# ─── HTTP helper ─────────────────────────────────────────────────────────────

def _curl_get(url: str, timeout: int = 30) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".tmp", delete=False) as tmp:
        result = subprocess.run(
            [
                "curl", "-sL", "--max-time", str(timeout),
                "-H", "User-Agent: Mozilla/5.0 (compatible; EspanaTransparente/1.0)",
                "-H", "Referer: https://www.sepg.pap.hacienda.gob.es/",
                url, "-o", tmp.name,
            ],
            capture_output=True,
            timeout=timeout + 5,
        )
        if result.returncode != 0:
            raise RuntimeError(f"curl failed [{url}]: {result.stderr.decode()[:200]}")
        with open(tmp.name, "rb") as f:
            data = f.read()
    os.unlink(tmp.name)
    return data


# ─── ROM index parsing ────────────────────────────────────────────────────────

def get_gastos_page_names(folder: str) -> list[str]:
    """Return all 'estado de gastos' page names from the ROM index.

    Each entry is a relative path like 'N_24P_E_R_31_101_1_1_1.htm'.
    These are the depth-9 R_31 pages (serie roja, gastos por programas).
    """
    index_url = f"{_BASE}/{folder}/MaestroDocumentos/PGE-ROM/Indice.htm"
    content = _curl_get(index_url).decode("latin-1")
    pattern = re.compile(r'href="(N_\w+_E_R_31_\d+_\d+_1_1\.htm)"')
    pages = list(dict.fromkeys(pattern.findall(content)))
    return pages


def get_csv_names_from_gastos_page(folder: str, page_name: str) -> list[str]:
    """Fetch a section 'estado de gastos' page and return all program CSV names.

    Returns filenames like 'N_24P_E_R_31_101_1_1_1_1911M_2.CSV' (the _2 suffix
    marks 'estado de gastos'; we skip _3 which is 'resumen orgánico').
    """
    page_url = f"{_BASE}/{folder}/MaestroDocumentos/PGE-ROM/{page_name}"
    content = _curl_get(page_url).decode("latin-1")
    time.sleep(REQUEST_DELAY)
    return list(dict.fromkeys(
        re.findall(r'doc/CSV/([^"\'\s]+_2\.CSV)', content)
    ))


# ─── CSV parsing ─────────────────────────────────────────────────────────────

def _parse_amount(value: str) -> float | None:
    """Parse Spanish thousands format: '1.234,56' → 1234.56"""
    cleaned = value.strip().replace(" ", "")
    if not cleaned:
        return None
    cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        v = float(cleaned)
        return v if v != 0 else None
    except ValueError:
        return None


def parse_sepg_csv(content: bytes) -> list[SepgRecord]:
    """Parse one SEPG ROM program CSV into SepgRecord list (one per chapter).

    Aggregates concept-level rows (3-digit Económica) to chapter level,
    falling back to article (2-digit) if no concept rows are present.
    Amounts are converted from thousands to euros.
    """
    text = content.decode("latin-1")
    lines = text.split("\n")

    # ── Header metadata ────────────────────────────────────────────────────
    section_code = None
    section_name = None
    program_code = None
    program_name = None

    for line in lines[:20]:
        stripped = line.strip().strip(";")
        m = re.match(r"Secci[oó]n:\s*(\d+)\s+(.*)", stripped, re.I)
        if m:
            section_code = m.group(1).strip().zfill(2)
            section_name = m.group(2).strip()
        m = re.match(r"Programa:\s*(\w+)\s+(.*)", stripped, re.I)
        if m:
            program_code = m.group(1).strip()
            program_name = m.group(2).strip()

    if not section_code or not program_code:
        return []

    # ── Table parsing ──────────────────────────────────────────────────────
    concept_amounts: dict[str, float] = {}   # 3-digit economic code → amount (thousands)
    article_amounts: dict[str, float] = {}   # 2-digit economic code → amount (thousands)

    reader = csv.reader(io.StringIO(text), delimiter=";")
    in_table = False

    for row in reader:
        if not row:
            continue
        # Detect header row (contains "Económica" / "Economica")
        if any("con" in c.lower() and "mica" in c.lower() for c in row):
            in_table = True
            continue
        if not in_table:
            continue
        if len(row) < 5:
            continue

        economica = row[1].strip() if len(row) > 1 else ""
        total_raw = row[4].strip() if len(row) > 4 else ""

        if not economica or not total_raw:
            continue
        if not re.match(r"^\d+$", economica):
            continue

        amount = _parse_amount(total_raw)
        if amount is None:
            continue

        if len(economica) == 3:
            concept_amounts[economica] = concept_amounts.get(economica, 0) + amount
        elif len(economica) == 2:
            article_amounts[economica] = article_amounts.get(economica, 0) + amount

    # ── Chapter aggregation ────────────────────────────────────────────────
    # Prefer concept (3-digit) over article (2-digit) to avoid double-counting
    source = concept_amounts if concept_amounts else article_amounts
    chapter_totals: dict[int, float] = defaultdict(float)
    for code, amount_thousands in source.items():
        chapter_totals[int(code[0])] += amount_thousands

    return [
        SepgRecord(
            section_code=section_code,
            section_name=section_name,
            program_code=program_code,
            program_name=program_name,
            economic_chapter=chapter,
            credit_initial=round(amount_thousands * 1000, 2),  # thousands → euros
        )
        for chapter, amount_thousands in sorted(chapter_totals.items())
    ]


# ─── Full-year scrape ─────────────────────────────────────────────────────────

def scrape_year(year: int, *, verbose: bool = True) -> list[SepgRecord]:
    """Download and parse all program CSVs for a prórroga year.

    Returns one SepgRecord per (section, program, chapter) combination.
    Raises RuntimeError if year is not in PRORROGA_FOLDERS.
    """
    if year not in PRORROGA_FOLDERS:
        raise RuntimeError(
            f"No SEPG ROM folder configured for year {year}. "
            f"Available: {sorted(PRORROGA_FOLDERS.keys())}. "
            f"Add to PRORROGA_FOLDERS in scraper_sepg.py."
        )

    folder = PRORROGA_FOLDERS[year]
    if verbose:
        print(f"Fetching ROM index for {folder} ...")

    gastos_pages = get_gastos_page_names(folder)
    if verbose:
        print(f"  {len(gastos_pages)} section 'estado de gastos' pages")

    all_records: list[SepgRecord] = []
    seen_csv_names: set[str] = set()

    for i, page_name in enumerate(gastos_pages, 1):
        if verbose:
            print(f"  [{i:02d}/{len(gastos_pages)}] {page_name}")

        csv_names = get_csv_names_from_gastos_page(folder, page_name)
        new_csv_names = [n for n in csv_names if n not in seen_csv_names]
        seen_csv_names.update(new_csv_names)

        if verbose:
            print(f"    → {len(new_csv_names)} program CSVs")

        for csv_name in new_csv_names:
            csv_url = f"{_BASE}/{folder}/MaestroDocumentos/PGE-ROM/doc/CSV/{csv_name}"
            csv_bytes = _curl_get(csv_url, timeout=30)
            time.sleep(REQUEST_DELAY)

            records = parse_sepg_csv(csv_bytes)
            if not records:
                if verbose:
                    print(f"    WARNING: no records from {csv_name}")
            all_records.extend(records)

    if verbose:
        unique_programs = len({(r.section_code, r.program_code) for r in all_records})
        print(f"\nTotal: {len(all_records)} records across {unique_programs} programs")

    return all_records


# ─── CLI (for dry-run inspection) ────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape SEPG ROM PGE data")
    parser.add_argument("--year", type=int, required=True, help="Prórroga year")
    parser.add_argument("--dry-run", action="store_true",
                        help="Download and parse but print results instead of writing")
    args = parser.parse_args()

    records = scrape_year(args.year, verbose=True)

    if args.dry_run:
        print("\nSample records (first 10):")
        for r in records[:10]:
            print(f"  section={r.section_code} prog={r.program_code} "
                  f"ch={r.economic_chapter} credit_initial={r.credit_initial:,.2f} €")

        sections = {r.section_code: r.section_name for r in records}
        total = sum(r.credit_initial for r in records)
        print(f"\nSections ({len(sections)}):")
        for code, name in sorted(sections.items()):
            sec_total = sum(r.credit_initial for r in records if r.section_code == code)
            print(f"  {code}: {name} — {sec_total/1e9:.1f}B €")
        print(f"\nGrand total: {total/1e9:.1f}B €")


if __name__ == "__main__":
    main()
