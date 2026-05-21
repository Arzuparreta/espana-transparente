"""Helpers for multilevel responsibility loading and money-data normalization."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import re
import unicodedata


def normalize_public_body(value: str | None) -> str | None:
    if not value:
        return None
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"\s+", " ", normalized).strip().upper()
    return normalized or None


def administration_level_from_bdns(nivel1: str | None) -> str | None:
    mapping = {
        "ESTADO": "state",
        "AUTONOMICA": "autonomic",
        "LOCAL": "municipal",
    }
    return mapping.get((nivel1 or "").upper())


def infer_contract_administration_level(
    awarding_body_normalized: str | None, ministry_normalized: str | None
) -> str | None:
    if ministry_normalized:
        return "state"

    body = awarding_body_normalized or ""

    # Municipal patterns
    municipal_markers = (
        "AYUNTAMIENTO DE ",
        "AJUNTAMENT DE ",
        "CONCEJALIA ",
        "CONCEJALIA DE ",
        "REGIDORIA ",
        "ALCALDIA ",
        "ALCALDIA DE ",
        "ALCALDIA DEL ",
        "JUNTA DE GOBIERNO DEL AYUNTAMIENTO",
        "JUNTA DE GOBIERNO LOCAL",
        "ORGANOS DIRECTIVOS DEL AYUNTAMIENTO",
        "DISTRITO DE ",
        "EMPRESA MUNICIPAL",
        "PATRONATO MUNICIPAL",
        "INSTITUTO MUNICIPAL",
        "ENTIDAD PUBLICA EMPRESARIAL LOCAL",
    )
    if any(body.startswith(m) or m in body for m in municipal_markers):
        return "municipal"

    # Autonomic patterns
    autonomic_markers = (
        "CONSEJERIA ",
        "CONSELLERIA ",
        "JUNTA DE ",
        "GOBIERNO DE ",
        "GENERALITAT ",
        "XUNTA DE ",
        "GOBIERNO VASCO",
        "PRINCIPADO DE ASTURIAS",
        "DIPUTACION PROVINCIAL",
        "DIPUTACION FORAL",
        "DIPUTACION DE ",
        "CABILDO INSULAR",
        "CONSELL INSULAR",
        "DIRECCION PROVINCIAL",
        "DELEGACION PROVINCIAL",
        "DELEGACION TERRITORIAL",
        "UNIVERSIDAD ",
        "UNIVERSITAT ",
        "RECTORADO ",
        "SOCIEDAD REGIONAL",
        "TELEVISION AUTONOMICA",
        "HOSPITAL UNIVERSITARIO",
        "GERENCIA REGIONAL",
        "GERENCIA SECTOR SANITARIO",
        "ORGANISMO PROVINCIAL",
        "SERVICIO REGIONAL",
        "INSTITUTO ARAGONES",
        "INSTITUTO CANTABRO",
        "INSTITUTO ASTURIANO",
        "INSTITUTO GALLEGO",
        "FUNDACION JOVENES Y DEPORTE",
    )
    if any(m in body for m in autonomic_markers):
        return "autonomic"

    # State patterns (explicit markers of national-level entities)
    state_markers = (
        "MINISTERIO ",
        "SECRETARIA DE ESTADO",
        "SECRETARIA GENERAL",
        "DIRECCION GENERAL",
        "AGENCIA ESTATAL",
        "BANCO DE ESPANA",
        "CONFEDERACION HIDROGRAFICA",
        "AUTORIDAD PORTUARIA",
        "SOCIEDAD ESTATAL",
        "CORPORACION DE RADIO Y TELEVISION",
        "MUTUAL MIDAT",
        "FREMAP",
        "MUFACE",
        "TRAGSA",
        "TRAGSATEC",
        "PARADORES DE TURISMO",
        "ENAIRE",
        "ADIF",
        "RENFE",
        "CORREOS Y TELEGRAFOS",
        "SALVAMENTO Y SEGURIDAD MARITIMA",
        "SENADO",
        "CONGRESO",
        "TRIBUNAL ",
        "DEFENSOR DEL PUEBLO",
        "CONSEJO DE SEGURIDAD NUCLEAR",
        "COMISION NACIONAL",
        "INSTITUTO NACIONAL",
        "INSTITUTO DE MAYORES",
        "RED.ES",
        "INTENDENTE DE ",
        "ARSENAL DE ",
        "INSTITUTO SOCIAL DE LA MARINA",
        "AENA",
        "DEFENSA",
        "CENTRO NACIONAL",
        "FUNDACION ESTATAL",
        "MUTUA COLABORADORA",
        "MUSEO NACIONAL",
        "BIBLIOTECA NACIONAL",
        "PATRIMONIO NACIONAL",
        "LOTERIAS",
        "CONSEJO SUPERIOR DE ",
        "CENTRO DE INVESTIGACIONES",
        "INSPECCION GENERAL",
        "COMITE DE DIRECCION DE EQUIPOS NUCLEARES",
        "INSTITUTO DE SALUD CARLOS III",
    )
    if any(m in body for m in state_markers):
        return "state"

    return None


def infer_municipal_territory(body_normalized: str | None) -> str | None:
    if not body_normalized:
        return None
    if body_normalized.startswith("AYUNTAMIENTO DE "):
        return body_normalized.replace("AYUNTAMIENTO DE ", "", 1).strip() or None
    # Also match variant patterns
    m = re.match(r"^(?:ALCALDIA|JUNTA DE GOBIERNO|ORGANOS DIRECTIVOS) DEL? AYUNTAMIENTO DE (.+)$", body_normalized)
    if m:
        return m.group(1).strip() or None
    return None


def infer_autonomic_territory(body_normalized: str | None) -> str | None:
    """Extract autonomous community or province from an autonomic awarding body name."""
    if not body_normalized:
        return None

    # Pattern 1: "Consejería de X del Principado de Asturias" → "Asturias"
    m = re.search(r"(?:DEL|DE LA|DE LAS|DE LOS|DE|DEL)\s+(PRINCIPADO DE ASTURIAS|GOBIERNO VASCO|GENERALITAT (?:DE |VALENCIANA|CATALUNYA)|GOBIERNO DE (?:NAVARRA|ARAGON|CANARIAS|CANTABRIA|LA RIOJA|EXTREMADURA|LAS ISLAS BALEARES|ILLES BALEARS)|JUNTA DE (?:ANDALUCIA|CASTILLA Y LEON|CASTILLA-LA MANCHA|EXTREMADURA|GALICIA|COMUNIDADES DE CASTILLA-LA MANCHA)|XUNTA DE GALICIA|CABILDO DE|CONSELL DE|DIPUTACION (?:FORAL|PROVINCIAL) DE)",
        body_normalized)
    if m:
        region = m.group(1).strip()
        # Map common patterns to canonical region names
        region_map = {
            "PRINCIPADO DE ASTURIAS": "Asturias",
            "GOBIERNO VASCO": "País Vasco",
            "GENERALITAT VALENCIANA": "Comunitat Valenciana",
            "GENERALITAT DE CATALUNYA": "Catalunya",
            "GOBIERNO DE NAVARRA": "Navarra",
            "GOBIERNO DE ARAGON": "Aragón",
            "GOBIERNO DE CANARIAS": "Canarias",
            "GOBIERNO DE CANTABRIA": "Cantabria",
            "GOBIERNO DE LA RIOJA": "La Rioja",
            "GOBIERNO DE EXTREMADURA": "Extremadura",
            "GOBIERNO DE LAS ISLAS BALEARES": "Illes Balears",
            "GOBIERNO DE ILLES BALEARS": "Illes Balears",
            "JUNTA DE ANDALUCIA": "Andalucía",
            "JUNTA DE CASTILLA Y LEON": "Castilla y León",
            "JUNTA DE CASTILLA-LA MANCHA": "Castilla-La Mancha",
            "JUNTA DE COMUNIDADES DE CASTILLA-LA MANCHA": "Castilla-La Mancha",
            "JUNTA DE EXTREMADURA": "Extremadura",
            "JUNTA DE GALICIA": "Galicia",
            "XUNTA DE GALICIA": "Galicia",
        }
        return region_map.get(region, region.title())

    # Pattern 2: "Delegación Provincial de ... en Ciudad Real" → "Ciudad Real"
    m = re.search(r" EN ([\w\s]+?)$", body_normalized)
    if m:
        return m.group(1).strip().title() or None

    # Pattern 3: "... de la Junta de Comunidades de Castilla-La Mancha" → "Castilla-La Mancha"
    m = re.search(r"(JUNTA DE (?:COMUNIDADES DE )?(?:CASTILLA-LA MANCHA|CASTILLA Y LEON|ANDALUCIA|EXTREMADURA|GALICIA))", body_normalized)
    if m:
        region = m.group(1)
        region_map = {
            "JUNTA DE COMUNIDADES DE CASTILLA-LA MANCHA": "Castilla-La Mancha",
            "JUNTA DE CASTILLA Y LEON": "Castilla y León",
            "JUNTA DE ANDALUCIA": "Andalucía",
            "JUNTA DE EXTREMADURA": "Extremadura",
            "JUNTA DE GALICIA": "Galicia",
        }
        return region_map.get(region, region)

    return None


def month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return start, end


def iter_months(start: date, end: date) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    cursor = date(start.year, start.month, 1)
    last = date(end.year, end.month, 1)
    while cursor <= last:
        months.append((cursor.year, cursor.month))
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return months


def iter_date_chunks(start: date, end: date, days: int) -> list[tuple[date, date]]:
    chunks: list[tuple[date, date]] = []
    cursor = start
    while cursor <= end:
        chunk_end = min(end, cursor + timedelta(days=days - 1))
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return chunks


@dataclass(slots=True)
class ResponsibilityPosition:
    administration_level: str
    position_type: str
    territory_name: str | None
    territory_code: str | None
    organization_name: str
    organization_aliases: list[str]
    person_name: str
    political_party: str | None
    government: str | None
    start_date: str
    end_date: str | None
    source_url: str | None


@dataclass(slots=True)
class PublicBodyMapEntry:
    body_normalized: str
    administration_level: str
    territory_name: str | None
    territory_code: str | None
    ministry_or_department_normalized: str
    match_strategy: str
    start_date: str
    end_date: str | None
    source_url: str | None
