"""Discover or import revolving-door candidates.

The web only publishes verified rows. This command writes investigation
candidates and their public evidence sources.

Usage:
    PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv data.csv --dry-run
    PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv data.csv

    # Automatic BORME watchlist scan (parses PDFs; uses yesterday if --borme-date omitted):
    PYTHONPATH=src python -m src.puertas_giratorias.ingest --watchlist data/personas_vigiladas.yml
    PYTHONPATH=src python -m src.puertas_giratorias.ingest --watchlist data/personas_vigiladas.yml --borme-date 2026-05-13

CSV columns accepted:
    person_name, political_party, public_role, public_organization,
    public_exit_date, private_role, private_organization, private_start_date,
    authorization_date, sector, source_url, source_name, source_type, title,
    published_at, evidence_text, confidence, discovered_by, discovery_method

BORME scanner:
    Parses Sección A PDFs (Actos inscritos) for Nombramientos entries. Names in
    BORME are in uppercase APELLIDO NOMBRE format; fuzzy matching handles accents
    and ordering differences. Matches found in a Nombramientos context are treated
    as primary sources (confidence 0.65). Matches found only in Ceses/Dimisiones
    are secondary (confidence 0.45). The scanner requires pdftotext (poppler-utils).
"""

import argparse
import csv
import json
import re
import subprocess
import tempfile
import os
import unicodedata
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import yaml
from thefuzz import fuzz

from puertas_giratorias.db import parse_optional_date, save_candidates
from puertas_giratorias.model import RevolvingDoorCandidate, SourceEvidence

BORME_API = "https://www.boe.es/datosabiertos/api/borme/sumario"
BORME_PDF_BASE = "https://www.boe.es/borme/dias"
UA = "EspanaTransparente/1.0 (public transparency ETL; contact: rubenpenarubio02@gmail.com)"

# Minimum fuzzy match score (0-100) to consider a name match
_BORME_MATCH_THRESHOLD = 82


def _first(row: dict[str, str], *keys: str) -> str | None:
    for key in keys:
        value = row.get(key)
        if value and value.strip():
            return value.strip()
    return None


def _float(value: str | None, default: float = 0.0) -> float:
    if not value:
        return default
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return default


def candidate_from_row(row: dict[str, str]) -> RevolvingDoorCandidate:
    person_name = _first(row, "person_name", "persona", "nombre")
    private_role = _first(row, "private_role", "cargo_privado", "cargo")
    private_organization = _first(row, "private_organization", "empresa", "organizacion_privada")
    source_url = _first(row, "source_url", "url", "fuente_url")
    if not person_name or not private_role or not private_organization or not source_url:
        raise ValueError("person_name, private_role, private_organization and source_url are required")

    source_type = (_first(row, "source_type", "tipo_fuente") or "primary").lower()
    if source_type not in {"primary", "secondary", "discovery"}:
        raise ValueError(f"Unsupported source_type: {source_type}")

    source = SourceEvidence(
        source_type=source_type,  # type: ignore[arg-type]
        source_name=_first(row, "source_name", "fuente") or "Fuente pública",
        source_url=source_url,
        title=_first(row, "title", "titulo"),
        published_at=parse_optional_date(_first(row, "published_at", "fecha_publicacion")),
        evidence_text=_first(row, "evidence_text", "evidencia"),
        raw_data={k: v for k, v in row.items() if v},
    )

    return RevolvingDoorCandidate(
        person_name=person_name,
        political_party=_first(row, "political_party", "partido"),
        public_role=_first(row, "public_role", "cargo_publico"),
        public_organization=_first(row, "public_organization", "organizacion_publica"),
        public_exit_date=parse_optional_date(_first(row, "public_exit_date", "fecha_cese")),
        private_role=private_role,
        private_organization=private_organization,
        private_start_date=parse_optional_date(_first(row, "private_start_date", "fecha_inicio_privado")),
        authorization_date=parse_optional_date(_first(row, "authorization_date", "fecha_autorizacion")),
        sector=_first(row, "sector"),
        confidence=_float(_first(row, "confidence", "confianza")),
        discovered_by=_first(row, "discovered_by") or "csv_import",
        discovery_method=_first(row, "discovery_method") or "human_research",
        sources=[source],
        raw_data={k: v for k, v in row.items() if v},
    )


def read_csv(path: Path) -> list[RevolvingDoorCandidate]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [candidate_from_row({k: v for k, v in row.items() if k}) for row in reader]


def _normalize_for_match(name: str) -> str:
    """Lowercase, strip accents and punctuation for fuzzy comparison."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = nfkd.encode("ascii", errors="ignore").decode("ascii")
    return re.sub(r"[^a-z ]", "", ascii_name.lower()).strip()


def _fetch_bytes(url: str, timeout: int = 60) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".tmp", delete=False) as tmp:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", str(timeout),
             "-H", f"User-Agent: {UA}", url, "-o", tmp.name],
            capture_output=True, timeout=timeout + 5,
        )
        if result.returncode != 0:
            raise RuntimeError(f"curl failed [{url}]: {result.stderr.decode()[:200]}")
        with open(tmp.name, "rb") as f:
            data = f.read()
    os.unlink(tmp.name)
    return data


def _pdf_to_text(pdf_bytes: bytes) -> str:
    """Extract text from a PDF using pdftotext (poppler-utils)."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name
    try:
        result = subprocess.run(
            ["pdftotext", tmp_path, "-"],
            capture_output=True, timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"pdftotext failed: {result.stderr.decode()[:200]}")
        return result.stdout.decode("utf-8", errors="replace")
    finally:
        os.unlink(tmp_path)


# Pattern: Nombramientos. Role: NAME1;NAME2. or Ceses/Dimisiones. Role: NAME.
_APPOINTMENT_RE = re.compile(
    r"(?P<action>Nombramientos|Ceses/Dimisiones)\.\s+"
    r"(?P<role>[^:]+):\s+"
    r"(?P<names>[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑA-Za-záéíóúüñ ;,.-]+?)(?=\.\s|\.$)",
    re.MULTILINE,
)


def _extract_appointments(text: str) -> list[dict[str, str]]:
    """Return list of {action, role, name, raw_line} from a BORME section A text."""
    entries = []
    for m in _APPOINTMENT_RE.finditer(text):
        action = m.group("action")
        role = m.group("role").strip()
        raw_names = m.group("names")
        for raw_name in raw_names.split(";"):
            name = raw_name.strip().strip(".")
            if len(name) < 5:
                continue
            entries.append({"action": action, "role": role, "name": name})
    return entries


_PARTICLES = {"de", "del", "la", "las", "los", "el", "y", "i"}


def _best_match(borme_name: str, watchlist: list[str]) -> tuple[str | None, int]:
    """Return (watchlist_name, score) for the best fuzzy match, or (None, 0).

    Uses token_set_ratio but also requires that all significant tokens (excluding
    particles like de/del/la) of the watchlist name appear in the BORME name.
    This handles APELLIDO NOMBRE reordering and guards against short names
    falsely matching longer unrelated ones.
    """
    norm_borme = _normalize_for_match(borme_name)
    borme_tokens = set(norm_borme.split())
    best_name = None
    best_score = 0
    for wl_name in watchlist:
        norm_wl = _normalize_for_match(wl_name)
        wl_tokens = set(norm_wl.split())
        significant = wl_tokens - _PARTICLES
        # All significant watchlist tokens must appear in the BORME name
        if not significant.issubset(borme_tokens):
            continue
        score = fuzz.token_set_ratio(norm_borme, norm_wl)
        if score > best_score:
            best_score = score
            best_name = wl_name
    return (best_name, best_score) if best_score >= _BORME_MATCH_THRESHOLD else (None, 0)


def _get_borme_section_a_pdf_urls(day: date) -> list[tuple[str, str]]:
    """Return [(pdf_url, province_name)] for section A items on a given BORME day."""
    summary_url = f"{BORME_API}/{day:%Y%m%d}"
    try:
        result = subprocess.run(
            ["curl", "-sL", "-H", "Accept: application/json", "-H", f"User-Agent: {UA}", summary_url],
            capture_output=True, text=True, timeout=45,
        )
    except subprocess.TimeoutExpired:
        print(f"  BORME sumario timeout for {day}, skipping")
        return []
    if result.returncode != 0 or not result.stdout.strip():
        return []
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []

    urls = []
    for entrada in payload.get("data", {}).get("sumario", {}).get("diario", []):
        for seccion in entrada.get("seccion", []):
            if seccion.get("codigo") != "A":
                continue
            for item in seccion.get("item", []):
                pdf_url = item.get("url_pdf", {}).get("texto", "")
                province = item.get("titulo", "")
                if pdf_url:
                    urls.append((pdf_url, province))
    return urls


def scan_borme(day: date, watchlist: list[str]) -> list[RevolvingDoorCandidate]:
    """Scan BORME Sección A PDFs for watchlist person names in appointment records.

    Downloads each province's section-A PDF, extracts text, finds Nombramientos
    entries that fuzzy-match a watchlist person, and creates candidates with the
    PDF as a primary source (confidence 0.65) or secondary source if found only
    in Ceses/Dimisiones context (confidence 0.45).

    Requires pdftotext (poppler-utils) in PATH.
    """
    pdf_items = _get_borme_section_a_pdf_urls(day)
    if not pdf_items:
        print(f"  No BORME section A items found for {day}")
        return []

    print(f"  BORME {day}: {len(pdf_items)} province PDFs to scan")

    # Collect matches: {watchlist_name: [(action, role, borme_name, pdf_url, province)]}
    found: dict[str, list[dict[str, str]]] = {}

    for pdf_url, province in pdf_items:
        try:
            pdf_bytes = _fetch_bytes(pdf_url, timeout=60)
            text = _pdf_to_text(pdf_bytes)
        except Exception as exc:
            print(f"    SKIP {province}: {exc}")
            continue

        for entry in _extract_appointments(text):
            matched_name, score = _best_match(entry["name"], watchlist)
            if matched_name:
                found.setdefault(matched_name, []).append({
                    "action": entry["action"],
                    "role": entry["role"],
                    "borme_name": entry["name"],
                    "pdf_url": pdf_url,
                    "province": province,
                    "score": str(score),
                })

    candidates: list[RevolvingDoorCandidate] = []
    for watchlist_name, matches in found.items():
        nombramientos = [m for m in matches if m["action"] == "Nombramientos"]
        primary_matches = nombramientos or matches

        source_type: Any = "primary" if nombramientos else "secondary"
        confidence = 0.65 if nombramientos else 0.45

        best = primary_matches[0]
        private_role = best["role"] if nombramientos else "Pendiente de revisar"
        evidence = (
            f"BORME {day:%d/%m/%Y} ({best['province']}): "
            f"{best['action']}. {best['role']}: {best['borme_name']}"
        )

        print(
            f"  MATCH: {watchlist_name!r} → {best['action']} {best['role']} "
            f"({best['province']}, score={best['score']})"
        )

        candidates.append(
            RevolvingDoorCandidate(
                person_name=watchlist_name,
                private_role=private_role,
                private_organization="Pendiente de revisar",
                discovered_by="borme_pdf",
                discovery_method=f"borme_pdf_nombramientos:{day:%Y-%m-%d}",
                confidence=confidence,
                sources=[
                    SourceEvidence(
                        source_type=source_type,
                        source_name="BORME",
                        source_url=best["pdf_url"],
                        title=f"BORME {day:%d/%m/%Y} · {best['province']} · {best['role']}",
                        published_at=day,
                        evidence_text=evidence,
                        raw_data={"matches": matches, "borme_date": f"{day:%Y-%m-%d}"},
                    )
                ],
                raw_data={
                    "matched_name": watchlist_name,
                    "borme_name": best["borme_name"],
                    "borme_date": f"{day:%Y-%m-%d}",
                    "match_score": best["score"],
                },
            )
        )

    return candidates


def load_watchlist(path: Path) -> list[str]:
    """Return the list of person names from a personas_vigiladas YAML file."""
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    personas = data.get("personas", [])
    names = [p["name"] for p in personas if p.get("name")]
    if not names:
        raise ValueError(f"No names found in watchlist {path}")
    return names


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, help="CSV exported from investigation work")
    parser.add_argument("--borme-date", type=lambda s: date.fromisoformat(s), help="YYYY-MM-DD (default: yesterday when using --watchlist)")
    parser.add_argument("--names", nargs="*", default=[], help="Names to search in BORME section A PDFs (use with --borme-date)")
    parser.add_argument("--watchlist", type=Path, help="YAML watchlist (personas_vigiladas.yml); scans BORME for all names")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    candidates: list[RevolvingDoorCandidate] = []
    if args.csv:
        candidates.extend(read_csv(args.csv))

    borme_names: list[str] = list(args.names)
    if args.watchlist:
        borme_names.extend(load_watchlist(args.watchlist))

    if borme_names:
        borme_day = args.borme_date or (date.today() - timedelta(days=1))
        candidates.extend(scan_borme(borme_day, borme_names))

    if not args.csv and not borme_names:
        raise SystemExit("No candidates. Use --csv, --borme-date --names, or --watchlist.")

    count = save_candidates(candidates, dry_run=args.dry_run)
    print(f"Processed {count} revolving-door candidates")


if __name__ == "__main__":
    main()
