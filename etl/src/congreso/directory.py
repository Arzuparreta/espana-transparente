"""Helpers for the Congreso deputies open-data directory.

This module centralizes the two stable sources we rely on:
  - The open-data landing page that exposes the current CSV asset URL.
  - The `searchDiputados` JSON endpoint that returns active deputies together
    with `codParlamentario` in a single request.
"""

from __future__ import annotations

import json
import re
import subprocess
import unicodedata
from dataclasses import dataclass

CONGRESO_BASE = "https://www.congreso.es"
OPENDATA_PAGE = f"{CONGRESO_BASE}/opendata/diputados"
SEARCH_DIPUTADOS_URL = (
    f"{CONGRESO_BASE}:443/es/busqueda-de-diputados"
    "?p_p_id=diputadomodule&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view"
    "&p_p_resource_id=searchDiputados&p_p_cacheability=cacheLevelPage"
)
USER_AGENT = "Mozilla/5.0 (compatible; EspanaTransparente/1.0)"

_ACTIVE_CSV_RE = re.compile(
    r'href="(?P<path>/webpublica/opendata/diputados/DiputadosActivos__\d+\.csv)"'
)


@dataclass(frozen=True)
class ActiveDeputyDirectoryEntry:
    full_name: str
    constituency: str
    first_name: str
    last_name: str
    party_formation: str
    group_name: str
    legislature_number: int
    cod_parlamentario: str


def _curl(url: str, *, data: str | None = None) -> str:
    cmd = ["curl", "-sL", "-H", f"User-Agent: {USER_AGENT}"]
    if data is not None:
        cmd.extend(
            [
                "-H",
                "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
                "-X",
                "POST",
                "--data",
                data,
            ]
        )
    cmd.append(url)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"curl failed for {url}: {result.stderr.strip()}")
    return result.stdout


def discover_active_csv_url() -> str:
    """Discover the current DiputadosActivos CSV asset URL."""
    html = _curl(OPENDATA_PAGE)
    match = _ACTIVE_CSV_RE.search(html)
    if not match:
        raise RuntimeError("No se encontro el CSV de diputados activos en la pagina de open data del Congreso")
    return f"{CONGRESO_BASE}{match.group('path')}"


def normalize_name(value: str) -> str:
    nfkd = unicodedata.normalize("NFKD", value.lower().strip())
    ascii_value = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", ascii_value)


def fetch_active_directory() -> list[ActiveDeputyDirectoryEntry]:
    """Fetch the active deputies directory with codParlamentario included."""
    payload = (
        "_diputadomodule_idLegislatura=15"
        "&_diputadomodule_genero=0"
        "&_diputadomodule_grupo="
        "&_diputadomodule_tipo=0"
        "&_diputadomodule_nombre="
        "&_diputadomodule_apellidos="
        "&_diputadomodule_formacion="
        "&_diputadomodule_filtroProvincias=[]"
        "&_diputadomodule_nombreCircunscripcion="
    )
    body = _curl(SEARCH_DIPUTADOS_URL, data=payload)
    parsed = json.loads(body)
    rows = parsed.get("data", [])
    entries: list[ActiveDeputyDirectoryEntry] = []
    for row in rows:
        full_name = str(row.get("apellidosNombre", "")).strip()
        cod = row.get("codParlamentario")
        legislature_number = int(row.get("idLegislatura", 0) or 0)
        if not full_name or cod in (None, "") or legislature_number <= 0:
            continue
        entries.append(
            ActiveDeputyDirectoryEntry(
                full_name=full_name,
                constituency=str(row.get("nombreCircunscripcion", "")).strip(),
                first_name=str(row.get("nombre", "")).strip(),
                last_name=str(row.get("apellidos", "")).strip(),
                party_formation=str(row.get("formacion", "")).strip(),
                group_name=str(row.get("grupo", "")).strip(),
                legislature_number=legislature_number,
                cod_parlamentario=str(cod).strip(),
            )
        )
    if not entries:
        raise RuntimeError("El directorio searchDiputados no devolvio diputados activos")
    return entries


def active_directory_index() -> dict[str, ActiveDeputyDirectoryEntry]:
    """Index active deputies by normalized `Apellido, Nombre`."""
    entries = fetch_active_directory()
    index: dict[str, ActiveDeputyDirectoryEntry] = {}
    for entry in entries:
        index[normalize_name(entry.full_name)] = entry
    return index
