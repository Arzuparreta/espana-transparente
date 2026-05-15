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
    fmt: str          # "civio" | "sepg_prorroga" | "csv_semicolon" | "unknown"
    gastos_url: str   # primary spending data
    organica_url: str = ""  # section/service names lookup
    budget_type: str = "ley"  # "ley" | "prorroga" | "proyecto"
    in_force_year: int | None = None
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


def _civio_source(year: int, folder: str, *, budget_type: str = "ley", notes: str = "") -> BudgetSource:
    base = f"{_CIVIO_BASE}/{folder}"
    return BudgetSource(
        year=year,
        fmt="civio",
        gastos_url=f"{base}/gastos.csv",
        organica_url=f"{base}/estructura_organica.csv",
        budget_type=budget_type,
        notes=notes or f"Civio scraper-pge, folder={folder}",
    )


_SEPG_PRORROGA_BASE = "https://www.sepg.pap.hacienda.gob.es/sitios/sepg/es-ES/Presupuestos/PGE"
_SEPG_PRORROGA_YEARS: dict[int, tuple[str, int]] = {
    2024: ("PGE2024Prorroga", 2023),
    2025: ("PGE2025Prorroga", 2023),
}


def _sepg_prorroga_source(year: int, folder: str, in_force_year: int) -> BudgetSource:
    return BudgetSource(
        year=year,
        fmt="sepg_prorroga",
        gastos_url=f"{_SEPG_PRORROGA_BASE}/{folder}/paginas/{folder.lower()}.aspx",
        budget_type="prorroga",
        in_force_year=in_force_year,
        notes=f"SEPG ROM prorroga, folder={folder}, PGE en vigor={in_force_year}",
    )


# ─── Public registry ─────────────────────────────────────────────────────────

def get_source(year: int) -> BudgetSource:
    """Return a BudgetSource for the given year. Raises RuntimeError if not found."""
    if year in _CIVIO_YEARS:
        budget_type = "proyecto" if year == 2019 else "ley"
        return _civio_source(year, _CIVIO_YEARS[year], budget_type=budget_type)
    if year in _SEPG_PRORROGA_YEARS:
        folder, in_force_year = _SEPG_PRORROGA_YEARS[year]
        return _sepg_prorroga_source(year, folder, in_force_year)

    raise RuntimeError(
        f"No PGE source found for year {year}. "
        f"Available years: {available_years()}. "
        f"To add a new year, update _CIVIO_YEARS or _SEPG_PRORROGA_YEARS in sources.py."
    )


def available_years() -> list[int]:
    return sorted(set(_CIVIO_YEARS) | set(_SEPG_PRORROGA_YEARS))


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
    if source.fmt == "sepg_prorroga":
        print(f"Using SEPG prorroga source for {year}: {source.notes}")
        return b"", b"", source

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
            print(f"  {y}: fmt={s.fmt}  type={s.budget_type}  notes={s.notes}")
        return

    if args.year:
        _cmd_inspect(args.year)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
