"""Helpers for multilevel responsibility loading and money-data normalization."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import re
import unicodedata

# Province (normalized, no accents, uppercase) → canonical CCAA display name
_PROVINCE_TO_CCAA: dict[str, str] = {
    # Andalucía
    "ALMERIA": "Andalucía", "CADIZ": "Andalucía", "CORDOBA": "Andalucía",
    "GRANADA": "Andalucía", "HUELVA": "Andalucía", "JAEN": "Andalucía",
    "MALAGA": "Andalucía", "SEVILLA": "Andalucía",
    # Aragón
    "HUESCA": "Aragón", "TERUEL": "Aragón", "ZARAGOZA": "Aragón",
    # Asturias
    "ASTURIAS": "Asturias", "OVIEDO": "Asturias",
    # Illes Balears
    "BALEARES": "Illes Balears", "ILLES BALEARS": "Illes Balears",
    "MALLORCA": "Illes Balears", "MENORCA": "Illes Balears",
    # Canarias
    "LAS PALMAS": "Canarias", "SANTA CRUZ DE TENERIFE": "Canarias",
    "TENERIFE": "Tenerife", "GRAN CANARIA": "Gran Canaria",
    "LA LAGUNA": "Tenerife", "CANDELARIA": "Tenerife",
    "LANZAROTE": "Lanzarote",
    "FUERTEVENTURA": "Fuerteventura", "LA PALMA": "La Palma",
    # Cantabria
    "CANTABRIA": "Cantabria",
    # Castilla y León
    "AVILA": "Castilla y León", "BURGOS": "Castilla y León", "LEON": "Castilla y León",
    "PALENCIA": "Castilla y León", "SALAMANCA": "Castilla y León",
    "SEGOVIA": "Castilla y León", "SORIA": "Castilla y León",
    "VALLADOLID": "Castilla y León", "ZAMORA": "Castilla y León",
    # Castilla-La Mancha
    "ALBACETE": "Castilla-La Mancha", "CIUDAD REAL": "Castilla-La Mancha",
    "CUENCA": "Castilla-La Mancha", "GUADALAJARA": "Castilla-La Mancha",
    "TOLEDO": "Castilla-La Mancha",
    # Cataluña
    "BARCELONA": "Catalunya", "GIRONA": "Catalunya", "LLEIDA": "Catalunya", "TARRAGONA": "Catalunya",
    # Extremadura
    "CACERES": "Extremadura", "BADAJOZ": "Extremadura",
    # Galicia
    "A CORUNA": "Galicia", "LUGO": "Galicia", "OURENSE": "Galicia", "PONTEVEDRA": "Galicia",
    # La Rioja
    "LA RIOJA": "La Rioja",
    # Madrid
    "MADRID": "Madrid",
    # Murcia
    "MURCIA": "Murcia",
    # Navarra
    "NAVARRA": "Navarra",
    # País Vasco
    "ALAVA": "País Vasco", "GIPUZKOA": "País Vasco", "BIZKAIA": "País Vasco",
    # Comunitat Valenciana
    "ALICANTE": "Comunitat Valenciana", "CASTELLON": "Comunitat Valenciana",
    "VALENCIA": "Comunitat Valenciana",
}

# CCAA keyword substrings → canonical display name (ordered longest-match first)
_CCAA_KEYWORDS: list[tuple[str, str]] = [
    ("CASTILLA-LA MANCHA", "Castilla-La Mancha"),
    ("CASTILLA LA MANCHA", "Castilla-La Mancha"),
    ("CASTILLA Y LEON", "Castilla y León"),
    ("PAIS VASCO", "País Vasco"),
    ("ILLES BALEARS", "Illes Balears"),
    ("ISLAS BALEARES", "Illes Balears"),
    ("COMUNITAT VALENCIANA", "Comunitat Valenciana"),
    ("COMUNIDAD VALENCIANA", "Comunitat Valenciana"),
    ("PRINCIPADO DE ASTURIAS", "Asturias"),
    ("GRAN CANARIA", "Gran Canaria"),
    ("REGION DE MURCIA", "Murcia"),
    ("ARAGONESA", "Aragón"),
    ("ARAGONES", "Aragón"),
    ("ARAGON", "Aragón"),
    ("ANDALUCIA", "Andalucía"),
    ("EXTREMADURA", "Extremadura"),
    ("CANTABRIA", "Cantabria"),
    ("GALICIA", "Galicia"),
    ("GALLEGA", "Galicia"),
    ("GALLEGO", "Galicia"),
    ("MURCIA", "Murcia"),
    ("MURCIANO", "Murcia"),
    ("NAVARRA", "Navarra"),
    ("ASTURIAS", "Asturias"),
    ("TENERIFE", "Tenerife"),
    ("CANARIAS", "Canarias"),
    ("RIOJA", "La Rioja"),
    # Aragonese-specific terminology
    ("DEPARTAMENTO DE EDUCACION", "Aragón"),
    ("COMARCA", "Aragón"),
    # Valencian health department naming convention
    ("DEPARTAMENTO DE SALUD", "Comunitat Valenciana"),
    # Balearic institutions
    ("BALEAR", "Illes Balears"),
    # Specific institutional identifiers with no geographic keyword
    ("OPAEF", "Andalucía"),
    ("REY JUAN CARLOS", "Madrid"),
    ("SERVICIO REGIONAL DE EMPLEO Y FORMACION", "Murcia"),
]


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
        "PLENO DEL AYUNTAMIENTO",
        "DISTRITO DE ",
        "EMPRESA MUNICIPAL",
        "PATRONATO MUNICIPAL",
        "INSTITUTO MUNICIPAL",
        "ENTIDAD PUBLICA EMPRESARIAL LOCAL",
        "MUNICIPALIZADA",
        "MUNICIPALIZADO",
        "MANCOMUNIDAD",
        "MUNICIPIO DE ",
        "FUNDACION DEPORTIVA MUNICIPAL",
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
        "RECTOR DE LA UNIVERSIDAD",
        "SOCIEDAD REGIONAL",
        "TELEVISION AUTONOMICA",
        "HOSPITAL UNIVERSITARIO",
        "GERENCIA REGIONAL",
        "GERENCIA SECTOR SANITARIO",
        "ORGANISMO PROVINCIAL",
        "SERVICIO REGIONAL",
        "SERVICIO DE SALUD DE",
        "DEPARTAMENTO DE ",
        "COMARCA DE ",
        "INSTITUTO ARAGONES",
        "INSTITUTO CANTABRO",
        "INSTITUTO ASTURIANO",
        "INSTITUTO GALLEGO",
        "INSTITUTO MURCIANO",
        "INSTITUTO BALEAR",
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
        "SOCIEDAD MERCANTIL ESTATAL",
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
        "INSTITUTO DE LAS MUJERES",
        "RED.ES",
        "INTENDENTE DE ",
        "INTENDENCIA DE ",
        "JEFATURA DE INTENDENCIA",
        "JEFATURA DE ASUNTOS ECONOMICOS",
        "DIVISION ECONOMICA",
        "ARSENAL DE ",
        "INSTITUTO SOCIAL DE LA MARINA",
        "AENA",
        "DEFENSA",
        "CENTRO NACIONAL",
        "FUNDACION ESTATAL",
        "FUNDACION BIODIVERSIDAD",
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
        "ORGANISMO AUTONOMO PARQUES NACIONALES",
        "PARQUES NACIONALES",
        "ENRESA",
        "SEIASA",
        "INECO",
        "NAVANTIA",
        "FABRICA NACIONAL DE MONEDA",
        "INSTITUTO DE CREDITO OFICIAL",
        "COFIDES",
        "EMPRESA NACIONAL",
        "CUERPO NACIONAL DE POLICIA",
    )
    if any(m in body for m in state_markers):
        return "state"

    return None


def infer_municipal_territory(body_normalized: str | None) -> str | None:
    if not body_normalized:
        return None
    if body_normalized.startswith("AYUNTAMIENTO DE "):
        return body_normalized.replace("AYUNTAMIENTO DE ", "", 1).strip() or None
    # Governing body patterns: "Junta de Gobierno (Local) del Ayuntamiento de X", "Pleno del Ayuntamiento de X", etc.
    m = re.match(
        r"^(?:ALCALDIA|JUNTA DE GOBIERNO(?: LOCAL)?|ORGANOS DIRECTIVOS|PLENO) DEL? AYUNTAMIENTO DE (.+)$",
        body_normalized,
    )
    if m:
        return m.group(1).strip() or None
    # "Empresa Municipal de X de {city}" — city is the last "DE {city}" segment
    m = re.match(r"^EMPRESA MUNICIPAL\b.+\bDE ([A-Z][A-Z\s]+?)(?:\s*,|\s+S\.A\.|\s+S\.L\.|\s+SAU|\s+SAM|\s*$)", body_normalized)
    if m:
        return m.group(1).strip().title() or None
    # "Empresa de Serveis del Municipi de {city}"
    m = re.match(r"^.+\bMUNICIPI DE ([A-Z][A-Z\s]+?)(?:\s*,|\s+S\.A\.|\s+S\.L\.|\s*$)", body_normalized)
    if m:
        return m.group(1).strip().title() or None
    # EMAYA (Palma water company — name has no city after DE)
    if "EMAYA" in body_normalized:
        return "Palma"
    # Greedy last "DE {place}" for island/local entities like "... de Lanzarote"
    m = re.search(r".+\bDE ([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)*)(?:\s*[\(,\-]|\s*$)", body_normalized)
    if m:
        return m.group(1).strip().title() or None
    return None


def infer_autonomic_territory(body_normalized: str | None) -> str | None:
    """Extract autonomous community or province from an autonomic awarding body name."""
    if not body_normalized:
        return None

    # Pattern 1: "Consejería de X del Principado de Asturias" → "Asturias"
    # Only matches complete, known government identifiers — no partial DIPUTACION match.
    m = re.search(
        r"(?:DEL|DE LA|DE LAS|DE LOS|DE)\s+"
        r"(PRINCIPADO DE ASTURIAS"
        r"|GOBIERNO VASCO"
        r"|GENERALITAT (?:DE |VALENCIANA|CATALUNYA)"
        r"|GOBIERNO DE (?:NAVARRA|ARAGON|CANARIAS|CANTABRIA|LA RIOJA|EXTREMADURA|LAS ISLAS BALEARES|ILLES BALEARS)"
        r"|JUNTA DE (?:ANDALUCIA|CASTILLA Y LEON|CASTILLA-LA MANCHA|EXTREMADURA|GALICIA|COMUNIDADES DE CASTILLA-LA MANCHA)"
        r"|XUNTA DE GALICIA)",
        body_normalized,
    )
    if m:
        region = m.group(1).strip()
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
        return region_map.get(region, None)

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

    # Pattern 4: "Diputación (Provincial/Foral) de {province}" → CCAA
    m = re.search(r"DIPUTACION (?:PROVINCIAL |FORAL |)DE (?:LA |EL )?(.+?)(?:\s*[\(,]|\s*$)", body_normalized)
    if m:
        province = m.group(1).strip()
        if province in _PROVINCE_TO_CCAA:
            return _PROVINCE_TO_CCAA[province]

    # Pattern 5: "Provincia de {province}" in body → CCAA
    m = re.search(r"PROVINCIA DE (?:LA |EL )?(.+?)(?:\s*[\(,\-]|\s*$)", body_normalized)
    if m:
        province = m.group(1).strip()
        if province in _PROVINCE_TO_CCAA:
            return _PROVINCE_TO_CCAA[province]

    # Pattern 6: CCAA keyword scan — longest keywords first to avoid partial matches
    for keyword, ccaa in _CCAA_KEYWORDS:
        if keyword in body_normalized:
            return ccaa

    # Pattern 7: greedy scan for last "DE {place}" in names like
    # "Rectorado de la Universidad de Zaragoza" → "Zaragoza"
    # The leading .+ is greedy so the regex anchors to the LAST "DE " in the string.
    m = re.search(r".+\bDE ([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)*)(?:\s*[\(,\-]|\s*$)", body_normalized)
    if m:
        place = m.group(1).strip()
        if place in _PROVINCE_TO_CCAA:
            return _PROVINCE_TO_CCAA[place]

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
