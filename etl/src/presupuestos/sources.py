"""Resolves PGE source URLs by year.

Primary source: Civio scraper-pge GitHub repository (2007-2023).
  https://github.com/civio/scraper-pge/tree/master/output/{year}/

Each year has:
  gastos.csv        — spending lines (CENTRO GESTOR, FUNCIONAL, ECONOMICA, IMPORTE)
  estructura_organica.csv — section/service name lookup

Usage (standalone inspection):
    PYTHONPATH=src python -m src.presupuestos.sources --year 2023
    PYTHONPATH=src python -m src.presupuestos.sources --list
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
import os
from dataclasses import dataclass, field


@dataclass
class BudgetSource:
    year: int
    fmt: str          # "civio" | "csv_semicolon" | "unknown"
    gastos_url: str   # primary spending data
    organica_url: str = ""  # section/service names lookup
    notes: str = ""


# ─── Civio scraper-pge repository ────────────────────────────────────────────
_CIVIO_BASE = "https://raw.githubusercontent.com/civio/scraper-pge/master/output"

# Non-P = approved (ley); P = draft project (proyecto). Prefer ley where available.
# Years NOT in the repo: 2019 ley (never approved), 2020 (extended), 2024+
_CIVIO_YEARS: dict[int, str] = {
    2016: "2016",
    2017: "2017",
    2018: "2018",
    2019: "2019P",   # no approved 2019 budget; use proyecto as closest available
    2021: "2021",
    2022: "2022",
    2023: "2023",
}


def _civio_source(year: int, folder: str) -> BudgetSource:
    base = f"{_CIVIO_BASE}/{folder}"
    return BudgetSource(
        year=year,
        fmt="civio",
        gastos_url=f"{base}/gastos.csv",
        organica_url=f"{base}/estructura_organica.csv",
        notes=f"Civio scraper-pge, folder={folder}",
    )


# ─── Public registry ─────────────────────────────────────────────────────────

def get_source(year: int) -> BudgetSource:
    """Return a BudgetSource for the given year. Raises RuntimeError if not found."""
    if year in _CIVIO_YEARS:
        return _civio_source(year, _CIVIO_YEARS[year])

    raise RuntimeError(
        f"No PGE source found for year {year}. "
        f"Available years: {sorted(_CIVIO_YEARS.keys())}. "
        f"To add a new year, update _CIVIO_YEARS in sources.py."
    )


def available_years() -> list[int]:
    return sorted(_CIVIO_YEARS.keys())


# ─── Download helpers ─────────────────────────────────────────────────────────

def _curl_get(url: str, timeout: int = 30) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".tmp", delete=False) as tmp:
        result = subprocess.run(
            [
                "curl", "-sL", "--max-time", str(timeout),
                "-H", "User-Agent: Mozilla/5.0 (compatible; EspanaTransparente/1.0)",
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


def download_gastos(year: int) -> tuple[bytes, bytes, BudgetSource]:
    """Download gastos.csv and estructura_organica.csv for the given year.

    Returns (gastos_bytes, organica_bytes, source).
    """
    source = get_source(year)
    print(f"Downloading PGE {year} gastos from {source.gastos_url} ...")
    gastos = _curl_get(source.gastos_url, timeout=60)
    print(f"  gastos: {len(gastos):,} bytes")

    organica = b""
    if source.organica_url:
        print(f"Downloading organica from {source.organica_url} ...")
        organica = _curl_get(source.organica_url, timeout=30)
        print(f"  organica: {len(organica):,} bytes")

    return gastos, organica, source


# ─── CLI inspection helpers ──────────────────────────────────────────────────

def _cmd_inspect(year: int) -> None:
    gastos_bytes, organica_bytes, source = download_gastos(year)
    print(f"\nSource: {source}")

    import csv, io
    reader = csv.DictReader(io.StringIO(gastos_bytes.decode("utf-8")), delimiter=";")
    rows = list(reader)
    print(f"gastos rows: {len(rows)}")
    print(f"fields: {list(rows[0].keys()) if rows else []}")
    print("first 3 rows:")
    for r in rows[:3]:
        print(" ", dict(r))

    if organica_bytes:
        org_reader = csv.DictReader(io.StringIO(organica_bytes.decode("utf-8")), delimiter=";")
        org_rows = list(org_reader)
        print(f"\norganica rows: {len(org_rows)}")
        # Show section-level (2-char) entries
        sections = [r for r in org_rows if len(r["CENTRO GESTOR"]) == 2]
        print(f"Sections ({len(sections)}):")
        for s in sections[:10]:
            print(f"  {s['CENTRO GESTOR']}: {s['DESCRIPCION LARGA']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect PGE source files")
    parser.add_argument("--year", type=int, help="Year to inspect")
    parser.add_argument("--list", action="store_true", help="List all available years")
    args = parser.parse_args()

    if args.list:
        print("Available years:")
        for y in available_years():
            s = get_source(y)
            print(f"  {y}: folder={_CIVIO_YEARS[y]}  fmt={s.fmt}")
        return

    if args.year:
        _cmd_inspect(args.year)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
