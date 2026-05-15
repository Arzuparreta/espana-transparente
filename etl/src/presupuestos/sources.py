"""Resolves PGE source URLs by year via datos.gob.es catalog or known static mappings.

Usage (standalone inspection):
    PYTHONPATH=src python -m src.presupuestos.sources --year 2025
    PYTHONPATH=src python -m src.presupuestos.sources --list
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
import os
from dataclasses import dataclass


@dataclass
class BudgetSource:
    year: int
    url: str
    fmt: str          # "csv_semicolon" | "csv_comma" | "txt_fixed"
    encoding: str     # "utf-8" | "latin-1" | "utf-8-sig"
    notes: str = ""


# ─── Known verified sources ───────────────────────────────────────────────────
# Populated after manual inspection. Add entries here after running --year N
# to discover and confirm the correct URL and format for each year.
# Keys: integer year.
KNOWN_SOURCES: dict[int, BudgetSource] = {
    # Example (replace with verified data after first run):
    # 2025: BudgetSource(
    #     year=2025,
    #     url="https://...",
    #     fmt="csv_semicolon",
    #     encoding="utf-8-sig",
    # ),
}

# datos.gob.es catalog search endpoint
_DATOSGOB_API = "https://datos.gob.es/apidata/catalog/dataset.json"

# SEPG base URL pattern (fallback if datos.gob.es returns nothing useful)
_SEPG_BASE = "https://www.sepg.pap.hacienda.gob.es"


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


def discover_url(year: int) -> BudgetSource | None:
    """Query datos.gob.es catalog to find a PGE download URL for the given year.

    Returns a BudgetSource with fmt='unknown' if a candidate URL is found but
    not yet verified. Returns None if nothing is found.
    """
    query = f"presupuestos generales estado {year}"
    params = (
        f"?q={query.replace(' ', '+')}"
        "&theme=http%3A%2F%2Fwww.europeandataportal.eu%2Fthemes%2F0014"
        "&_sort=modified"
        "&_pageSize=10"
    )
    print(f"  Querying datos.gob.es for year {year}...")
    try:
        raw = _curl_get(_DATOSGOB_API + params)
        catalog = json.loads(raw)
    except Exception as exc:
        print(f"  datos.gob.es query failed: {exc}")
        return None

    results = catalog.get("result", {}).get("items", [])
    for item in results:
        title = item.get("title", [{}])
        title_text = title[0].get("_value", "") if isinstance(title, list) else str(title)
        if str(year) not in title_text:
            continue

        # Look for CSV or ZIP distributions
        for dist in item.get("distribution", []):
            access_url = dist.get("accessURL", "")
            if not access_url:
                continue
            lower = access_url.lower()
            if any(ext in lower for ext in (".csv", ".zip", ".txt")):
                fmt = "unknown"
                if ".csv" in lower:
                    fmt = "csv_semicolon"
                elif ".zip" in lower:
                    fmt = "zip"
                print(f"  Found candidate: {access_url}")
                return BudgetSource(
                    year=year,
                    url=access_url,
                    fmt=fmt,
                    encoding="utf-8-sig",
                    notes="discovered via datos.gob.es — verify format before production use",
                )

    print(f"  No candidate found via datos.gob.es for year {year}.")
    return None


def get_source(year: int) -> BudgetSource:
    """Return a BudgetSource for the given year.

    Priority:
    1. KNOWN_SOURCES (manually verified)
    2. datos.gob.es discovery (candidate, may need format verification)

    Raises RuntimeError if no source can be found.
    """
    if year in KNOWN_SOURCES:
        return KNOWN_SOURCES[year]

    discovered = discover_url(year)
    if discovered:
        return discovered

    raise RuntimeError(
        f"No PGE source found for year {year}. "
        f"Add an entry to KNOWN_SOURCES in sources.py after manually verifying the URL. "
        f"Run: PYTHONPATH=src python -m src.presupuestos.sources --year {year}"
    )


def download_source(year: int) -> tuple[bytes, BudgetSource]:
    """Download the raw source file for the given year. Returns (raw_bytes, source)."""
    source = get_source(year)
    print(f"Downloading PGE {year} from {source.url} ...")
    raw = _curl_get(source.url, timeout=120)
    print(f"  Downloaded {len(raw) / 1_000_000:.1f} MB (fmt={source.fmt}, enc={source.encoding})")
    return raw, source


def _cmd_inspect(year: int) -> None:
    """CLI helper: download and print the first few lines of the source file."""
    import io
    import zipfile

    raw, source = download_source(year)

    data = raw
    if source.fmt == "zip" or (len(raw) > 2 and raw[:2] == b"PK"):
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            names = zf.namelist()
            print(f"  ZIP contents: {names}")
            # Pick first CSV or TXT file
            target = next(
                (n for n in names if n.lower().endswith((".csv", ".txt"))),
                names[0] if names else None,
            )
            if not target:
                print("  No usable file found in ZIP.")
                return
            data = zf.read(target)
            print(f"  Inspecting: {target} ({len(data)} bytes)")

    # Try to decode and print first 10 lines
    for enc in (source.encoding, "utf-8", "latin-1"):
        try:
            text = data.decode(enc)
            lines = text.splitlines()
            print(f"\n  Encoding: {enc}  |  Total lines: {len(lines)}")
            print("  First 10 lines:")
            for i, line in enumerate(lines[:10], 1):
                print(f"    {i:3}: {line[:120]}")
            print(f"\n  Detected delimiter: {'semicolon' if ';' in (lines[0] if lines else '') else 'comma/tab/fixed-width'}")
            break
        except UnicodeDecodeError:
            continue


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect PGE source files")
    parser.add_argument("--year", type=int, help="Year to inspect")
    parser.add_argument("--list", action="store_true", help="List all known sources")
    args = parser.parse_args()

    if args.list:
        if not KNOWN_SOURCES:
            print("No known sources yet. Run --year N to discover.")
        for year, src in sorted(KNOWN_SOURCES.items()):
            print(f"  {year}: {src.url}  fmt={src.fmt}  enc={src.encoding}")
        return

    if args.year:
        _cmd_inspect(args.year)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
