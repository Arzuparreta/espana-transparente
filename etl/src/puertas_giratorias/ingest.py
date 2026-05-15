"""Discover or import revolving-door candidates.

The web only publishes verified rows. This command writes investigation
candidates and their public evidence sources.

Usage:
    PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv data.csv --dry-run
    PYTHONPATH=src python -m src.puertas_giratorias.ingest --csv data.csv

    # Automatic BORME watchlist scan (uses yesterday if --borme-date omitted):
    PYTHONPATH=src python -m src.puertas_giratorias.ingest --watchlist data/personas_vigiladas.yml
    PYTHONPATH=src python -m src.puertas_giratorias.ingest --watchlist data/personas_vigiladas.yml --borme-date 2026-05-13

CSV columns accepted:
    person_name, political_party, public_role, public_organization,
    public_exit_date, private_role, private_organization, private_start_date,
    authorization_date, sector, source_url, source_name, source_type, title,
    published_at, evidence_text, confidence, discovered_by, discovery_method
"""

import argparse
import csv
import json
import subprocess
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import yaml

from puertas_giratorias.db import parse_optional_date, save_candidates
from puertas_giratorias.model import RevolvingDoorCandidate, SourceEvidence

BORME_API = "https://www.boe.es/datosabiertos/api/borme/sumario"
UA = "AccionHumana/1.0 (public transparency ETL)"


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


def fetch_borme_summary(day: date) -> dict[str, Any]:
    url = f"{BORME_API}/{day:%Y%m%d}"
    result = subprocess.run(
        ["curl", "-sL", "-H", f"Accept: application/json", "-H", f"User-Agent: {UA}", url],
        capture_output=True,
        text=True,
        timeout=45,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"BORME API did not return JSON for {url}") from exc


def scan_borme(day: date, names: list[str]) -> list[RevolvingDoorCandidate]:
    """Scan a BORME day for exact public-person name mentions.

    BORME is noisy, so this adapter only creates discovery candidates. A human
    must review the linked announcement and classify the role before publishing.
    """
    payload = fetch_borme_summary(day)
    text = json.dumps(payload, ensure_ascii=False)
    candidates: list[RevolvingDoorCandidate] = []
    for name in names:
        if name.lower() not in text.lower():
            continue
        candidates.append(
            RevolvingDoorCandidate(
                person_name=name,
                private_role="Pendiente de revisar",
                private_organization="Pendiente de revisar",
                discovered_by="borme",
                discovery_method=f"borme_summary:{day:%Y-%m-%d}",
                confidence=0.35,
                sources=[
                    SourceEvidence(
                        source_type="discovery",
                        source_name="BORME",
                        source_url=f"{BORME_API}/{day:%Y%m%d}",
                        title=f"Sumario BORME {day:%d/%m/%Y}",
                        published_at=day,
                        raw_data=payload,
                    )
                ],
                raw_data={"matched_name": name, "borme_date": f"{day:%Y-%m-%d}"},
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
    parser.add_argument("--names", nargs="*", default=[], help="Names to search in BORME summary")
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
