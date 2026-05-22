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


# Governance / role prefixes that obscure the real awarding body name.
# When these appear at the start of the name, the classifier should look
# past them to find the actual entity.
_GOVERNANCE_PREFIXES: list[str] = [
    "CONSEJO DE ADMINISTRACION DE ",
    "CONSEJO DE ADMINISTRACION DE LA ",
    "CONSEJO DE ADMINISTRACION DEL ",
    "CONSEJO RECTOR DE ",
    "CONSEJO RECTOR DE LA ",
    "CONSEJO RECTOR DEL ",
    "PRESIDENCIA DE ",
    "PRESIDENCIA DE LA ",
    "PRESIDENCIA DEL ",
    "PRESIDENCIA EJECUTIVA DE ",
    "PRESIDENCIA EJECUTIVA DE LA ",
    "PRESIDENCIA EJECUTIVA DEL ",
    "PRESIDENTE DE ",
    "PRESIDENTE DE LA ",
    "PRESIDENTE DEL ",
    "VICEPRESIDENCIA DE ",
    "VICEPRESIDENCIA DE LA ",
    "VICEPRESIDENCIA DEL ",
    "GERENCIA DE ",
    "GERENCIA DE LA ",
    "GERENCIA DEL ",
    "GERENCIA MUNICIPAL DE ",
    "GERENCIA TERRITORIAL DE ",
    "DIRECCION DE ",
    "DIRECCION DE LA ",
    "DIRECCION DEL ",
    "DIRECCION GERENCIA DE ",
    "DIRECCION GERENCIA DE LA ",
    "DIRECCION GERENCIA DEL ",
    "DIRECCION GERENTE DE ",
    "DIRECCION GERENTE DEL ",
    "DIRECCION ECONOMICA DE ",
    "DIRECCION ECONOMICA DEL ",
    "DIRECCION DE GESTION DE ",
    "DIRECCION DE GESTION DE LA ",
    "DIRECCION DE GESTION DEL ",
    "DIRECTOR DE ",
    "DIRECTOR DE LA ",
    "DIRECTOR DEL ",
    "DIRECTOR CIENTIFICO DE ",
    "DIRECTOR CIENTIFICO DEL ",
    "CONSEJERO DELEGADO DE ",
    "CONSEJERO DELEGADO DE LA ",
    "CONSEJERO DELEGADO DEL ",
    "CONSEJERO DE ",
    "CONSEJERO DE LA ",
    "CONSEJERO DEL ",
    "DIPUTADO DELEGADO DE ",
    "DIPUTADO DELEGADO DEL ",
    "DIPUTADO DEL ",
    "JEFATURA DE ",
    "JEFATURA DE LA ",
    "JEFATURA DEL ",
    "COMISION EJECUTIVA DE ",
    "COMISION EJECUTIVA DE LA ",
    "COMISION EJECUTIVA DEL ",
    "COMITE EJECUTIVO DE ",
    "COMITE EJECUTIVO DE LA ",
    "COMITE EJECUTIVO DEL ",
    "COMISION PERMANENTE DE ",
    "COMISION PERMANENTE DE LA ",
    "COMISION PERMANENTE DEL ",
    "SECCION DE ASUNTOS ECONOMICOS DE ",
    "SECCION DE ASUNTOS ECONOMICOS DE LA ",
    "SECCION DE ASUNTOS ECONOMICOS DEL ",
    "SECRETARIO GENERAL DE ",
    "SECRETARIO GENERAL DE LA ",
    "SECRETARIO GENERAL DEL ",
    "DELEGACION DE ",
    "DELEGACION DE LA ",
    "DELEGACION DEL ",
    "DELEGACION ESPECIAL DEL ",
    "APODERADO MANCOMUNADO DE ",
    "MESA DE ",
    "MESA DEL ",
    "JUNTA DIRECTIVA DE ",
    "JUNTA DIRECTIVA DE LA ",
    "JUNTA DIRECTIVA DEL ",
    "JUNTA RECTORA DE ",
    "JUNTA RECTORA DE LA ",
    "JUNTA RECTORA DEL ",
    "JUNTA GENERAL DE ",
    "JUNTA GENERAL DE LA ",
    "JUNTA GENERAL DEL ",
    "SUBDELEGACION DEL GOBIERNO EN ",
    "DELEGACION DEL GOBIERNO EN ",
    "DELEGACION DEL GOBIERNO EN LA ",
]


def strip_governance_prefix(body_normalized: str | None) -> str | None:
    """Remove governance/role prefixes to reveal the actual awarding entity name."""
    if not body_normalized:
        return None
    # Try longest prefixes first to avoid partial matches
    # (e.g. "JEFATURA DE LA" before "JEFATURA DE")
    for prefix in sorted(_GOVERNANCE_PREFIXES, key=len, reverse=True):
        if body_normalized.startswith(prefix):
            return body_normalized[len(prefix):]
    return body_normalized


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

    # Search both the raw body and the governance-stripped version
    stripped = strip_governance_prefix(body) or ""

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
        "PLENO DE LA EATIM",
        "DISTRITO DE ",
        "EMPRESA MUNICIPAL",
        "PROMOCIONES E INICIATIVAS MUNICIPALES",
        "DIVERTIA GIJON",
        "MADRID DESTINO",
        "PATRONATO MUNICIPAL",
        "INSTITUTO MUNICIPAL",
        "ENTIDAD PUBLICA EMPRESARIAL LOCAL",
        "MUNICIPALIZADA",
        "MUNICIPALIZADO",
        "MANCOMUNIDAD",
        "MANCOMUNITAT",
        "MUNICIPIO DE ",
        "FUNDACION DEPORTIVA MUNICIPAL",
        "FUNDACION MUNICIPAL",
        "SOCIEDAD MUNICIPAL",
        "SOCIEDAD ANONIMA MUNICIPAL",
        "ORGANISMO AUTONOMO AGENCIA PARA EL EMPLEO DE MADRID",
        "VIVIENDAS MUNICIPALES DE ",
    )
    if any(body.startswith(m) or m in body for m in municipal_markers):
        return "municipal"
    if any(stripped.startswith(m) or m in stripped for m in municipal_markers):
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
        "COMARCA DEL ",
        "COMARCA COMUNIDAD",
        "INSTITUTO ARAGONES",
        "INSTITUTO CANTABRO",
        "INSTITUTO ASTURIANO",
        "INSTITUTO GALLEGO",
        "INSTITUTO MURCIANO",
        "INSTITUTO BALEAR",
        "FUNDACION JOVENES Y DEPORTE",
        # Health service gerencias (autonomic-level)
        "GERENCIA DE ATENCION INTEGRADA",
        "GERENCIA DE ATENCION ESPECIALIZADA",
        "GERENCIA DE ATENCION PRIMARIA",
        "GERENCIA DE ASISTENCIA SANITARIA",
        "GERENCIA DEL AREA DE SALUD DE ",
        "GERENCIA DEL AREA DE ATENCION",
        "GERENCIA DE LOS SERVICIOS SANITARIOS DEL AREA DE SALUD",
        "GERENCIA DE SERVICIOS SANITARIOS DEL AREA DE SALUD",
        "GERENCIA DE SERVICIO SANITARIOS",
        "GERENCIA DE URGENCIAS, EMERGENCIAS Y TRANSPORTE SANITARIO",
        "GERENCIA DE SALUD DE AREAS",
        "SERVICIO DE EMERGENCIAS SANITARIAS",
        # Known autonomic entities
        "INSTITUTO TECNOLOGICO DE ARAGON",
        "INSTITUTO TECNOLOGICO DE CANARIAS",
        "ENTIDAD PUBLICA ARAGONESA",
        "SUELO Y VIVIENDA DE ARAGON",
        "SOCIEDAD PUBLICA DE INFRAESTRUCTURAS Y MEDIO AMBIENTE DE CASTILLA Y LEON",
        "RADIO PUBLICA DE CANARIAS",
        "TELEVISION PUBLICA DE CANARIAS",
        "RADIO AUTONOMICA DE ARAGON",
        "TELEVISION AUTONOMICA DE ARAGON",
        "AGENCIA DE DESARROLLO REGIONAL DE LAS ILLES BALEARS",
        "AGENCIA BALEAR DEL AGUA",
        "AGENCIA CANARIA DE INVESTIGACION",
        "PUERTOS DE LAS ILLES BALEARS",
        "ENTIDAD REGIONAL DE SANEAMIENTO",
        "ESCUELA BALEAR DE ADMINISTRACION PUBLICA",
        "FONS DE GARANTIA AGRARIA I PESQUERA DE LES ILLES BALEARS",
        "INSTITUTO DE LAS INDUSTRIAS CULTURALES Y DE LAS ARTES DE LA REGION DE MURCIA",
        "INSTITUTO CANARIO DE LA VIVIENDA",
        "INSTITUTO CANARIO DE CALIDAD AGROALIMENTARIA",
        "INSTITUTO CANARIO DE ADMINISTRACION PUBLICA",
        "ORGANISMO AUTONOMO ESTABLECIMIENTOS RESIDENCIALES PARA ANCIANOS DE ASTURIAS",
        "CONSORCIO DE TRANSPORTES DE MALLORCA",
        "CONSORCIO ESCUELA DE HOSTELERIA DE LAS ILLES BALEARS",
        "CONSORCIO DE RECURSOS SOCIOSANITARIOS Y ASISTENCIALES DE LAS ILLES BALEARS",
        "VALENCIANA D'ESTRATEGIES I RECURSOS PER A LA SOSTENIBILITAT AMBIENTAL",
        "AGENCIA DE CIENCIA, COMPETITIVIDAD EMPRESARIAL E INNOVACION ASTURIANA",
        "PARQUE TECNOLOGICO DEL MOTOR DE ARAGON",
        "AGENCIA VALENCIANA DE SEGURIDAD",
        "DIRECTOR DE LA AGENCIA DE PREVENCION Y LUCHA CONTRA EL FRAUDE Y LA CORRUPCION DE LA COMUNIDAD VALENCIANA",
        "FUNDACION DEL PATRIMONIO NATURAL DE CASTILLA Y LEON",
        "FUNDACION DEL CENTRO SUPERCOMPUTACION DE CASTILLA Y LEON",
        "FUNDACION DE HEMOTERAPIA Y HEMODONACION DE CASTILLA Y LEON",
        "FUNDACION DE ATENCION Y APOYO A LA DEPENDENCIA Y DE PROMOCION DE LA AUTONOMIA PERSONAL DE LAS ILLES BALEARS",
        "FUNDACION BALEAR DE INNOVACION Y TECNOLOGIA",
        "FUNDACION CANARIA",
        "INSTITUT MALLORQUI D' AFERS SOCIALS",
        "INSTITUTO INSULAR DE ATENCION SOCIAL",
        "AGENCIA PROVINCIAL DE EXTINCION DE INCENDIOS",
        "CONSORCIO HOSPITAL GENERAL UNIVERSITARIO DE VALENCIA",
        "FUNDACION DE LA COMUNITAT VALENCIANA",
        "FUNDACION PARA LA INVESTIGACION DEL HOSPITAL CLINICO DE LA COMUNIDAD VALENCIANA",
        "CENTRAL DE CONTRATACION DE LA ADMINISTRACION DE LA COMUNIDAD AUTONOMA DE LAS ILLES BALEARS",
        "CONSELL RECTOR DEL INSTITUT MALLORQUI",
        "PRESIDENCIA DE LA ENTIDAD PUBLICA EMPRESARIAL GESTION SANITARIA Y ASISTENCIAL DE LAS ILLES BALEARS",
        "INSTITUTO DE ASTROFISICA DE CANARIAS",
        "SERVICIO TERRITORIAL DE MEDIO AMBIENTE",
        "SERVICIO TERRITORIAL DE MOVILIDAD Y TRANSFORMACION DIGITAL",
        "MESA DEL PARLAMENTO DE CANARIAS",
        "MESA DE LES CORTS VALENCIANES",
        "CONSEJO DE ADMINISTRACION DE LA SOCIETAT VALENCIANA FIRA VALENCIA",
    )
    if any(m in body for m in autonomic_markers):
        return "autonomic"
    if any(m in stripped for m in autonomic_markers):
        return "autonomic"

    # Fallback: if stripped body contains CCAA keywords, infer autonomic
    if stripped and stripped != body:
        for keyword, _ in _CCAA_KEYWORDS:
            if keyword in stripped:
                return "autonomic"
        for province in _PROVINCE_TO_CCAA:
            if province in stripped:
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
        "CORREOS EXPRESS",
        "SERVICIOS Y ESTUDIOS PARA LA NAVEGACION AEREA",
        "SENASA",
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
        "MUTUA DE ACCIDENTES",
        "MAZ MUTUA",
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
        # Known state-level entities without ministry prefix
        "AGENCIA ESPANOLA DE PROTECCION DE DATOS",
        "AGENCIA ESPANOLA DE COOPERACION INTERNACIONAL",
        "INSTITUTO DE TURISMO DE ESPANA",
        "INSTITUTO CERVANTES",
        "CONSORCIO DE COMPENSACION DE SEGUROS",
        "CONSORCIO DE LA ZONA FRANCA",
        "CONSORCIO IFMIF-DONES ESPANA",
        "CONSORCIO PARA EL DISENO, CONSTRUCCION, EQUIPAMIENTO Y EXPLOTACION",
        "CENTRO DE ESTUDIOS Y EXPERIMENTACION DE OBRAS PUBLICAS",
        "ORGANISMO AUTONOMO INSTITUTO DE LA JUVENTUD",
        "FUNDACION ESPANOLA PARA LA CIENCIA Y LA TECNOLOGIA",
        "FUNDACION COLECCION THYSSEN BORNEMISZA",
        "FUNDACION BIODIVERSIDAD",
        "CASA DE S.M. EL REY",
        "CONSORCIO PARA LA CONSTRUCCION, EQUIPAMIENTO Y EXPLOTACION DEL LABORATORIO DE LUZ SINCROTRON",
        "EMPRESA ESTATAL MERCADOS CENTRALES DE ABASTECIMIENTO",
        "FUNDACION CENTRO DE INVESTIGACION ENFERMEDADES NEUROLOGICAS",
        "FUNDACION INSTITUTO DE INVESTIGACION SANITARIA ARAGON",
        "ENUSA INDUSTRIAS AVANZADAS",
        "DESALADORA DE ESCOMBRERAS",
        "CLUB DE CAMPO VILLA DE MADRID",
        "CENTRO DE GESTION INTEGRADA Y PROYECTOS CORPORATIVOS",
        "DIRECCION DEL INSTITUTO CERVANTES",
        "GERENCIA DE INFORMATICA DE LA SEGURIDAD SOCIAL",
        "DIRECCION DEL ORGANISMO ESTATAL INSPECCION DE TRABAJO Y SEGURIDAD SOCIAL",
        "DIRECCION DEL CENTRO PENITENCIARIO",
        "DIRECCION DEL CENTRO DE ESTUDIOS JURIDICOS",
        "ORGANISMO AUTONOMO PARQUES NACIONALES",
        "DIRECCION GERENCIA DEL HOSPITAL NACIONAL DE PARAPLEJICOS",
        "DIRECCION GERENTE DEL CENTRO DE RECUPERACION DE PERSONAS CON DISCAPACIDAD FISICA",
        "DIRECCION GERENTE DEL CENTRO DE ATENCION A DISCAPACITADOS FISICOS",
        "DIRECCION DEL INSTITUTO CANARIO DE ADMINISTRACION PUBLICA",
        # Military patterns
        "JEFATURA DE LA SECCION ECONOMICO",
        "SECCION DE ASUNTOS ECONOMICOS DE LA DIRECCION DE INFRAESTRUCTURA",
        "SECCION DE ASUNTOS ECONOMICOS DEL PARQUE Y CENTRO DE MANTENIMIENTO",
        "SECCION DE ASUNTOS ECONOMICOS DE LA COMANDANCIA GENERAL",
        "SECCION DE ASUNTOS ECONOMICOS DE LA JEFATURA SISTEMAS",
        "JEFATURA DE ADMINISTRACION ECONOMICA DEL CUARTO MILITAR",
        "DIRECCION DE GESTION ECONOMICA DE LA JEFATURA DE APOYO LOGISTICO",
        "DIRECCION DE ADQUISICIONES DEL MANDO DE APOYO LOGISTICO",
        "COMANDANCIA GUARDIA CIVIL",
        "ZONA DE LA GUARDIA CIVIL",
        "INTENDENCIA DE ",
        # Revolving door entities (state-level)
        "SOCIEDAD ESPANOLA DE ESTUDIOS PARA LA COMUNICACION FIJA A TRAVES DEL ESTRECHO",
    )
    if any(m in body for m in state_markers):
        return "state"
    if any(m in stripped for m in state_markers):
        return "state"

    return None


def infer_municipal_territory(body_normalized: str | None) -> str | None:
    if not body_normalized:
        return None

    # Also check governance-stripped version for clues
    stripped = strip_governance_prefix(body_normalized)

    def _extract(body: str) -> str | None:
        if body.startswith("AYUNTAMIENTO DE "):
            return body.replace("AYUNTAMIENTO DE ", "", 1).strip() or None
        # Governing body patterns
        m = re.match(
            r"^(?:ALCALDIA|JUNTA DE GOBIERNO(?: LOCAL)?|ORGANOS DIRECTIVOS|PLENO) DEL? AYUNTAMIENTO DE (.+)$",
            body,
        )
        if m:
            return m.group(1).strip() or None
        # "Pleno de la EATIM del Mareny de Barraquetes" → Mareny de Barraquetes
        m = re.match(r"^PLENO DE LA EATIM DEL? (.+)$", body)
        if m:
            return m.group(1).strip().title() or None
        # "Empresa Municipal de X de {city}"
        m = re.match(r"^EMPRESA MUNICIPAL\b.+\bDE ([A-Z][A-Z\s]+?)(?:\s*,|\s+S\.A\.|\s+S\.L\.|\s+SAU|\s+SAM|\s*$)", body)
        if m:
            return m.group(1).strip().title() or None
        # "Sociedad Municipal de X de {city}"
        m = re.match(r"^SOCIEDAD MUNICIPAL\b.+\bDE ([A-Z][A-Z\s]+?)(?:\s*,|\s+S\.A\.|\s+S\.L\.|\s+SAU|\s+SAM|\s*$)", body)
        if m:
            return m.group(1).strip().title() or None
        # "Empresa de Servicios Municipales de {city}"
        m = re.match(r"^EMPRESA DE SERVICIOS MUNICIPALES DE ([A-Z][A-Z\s]+?)(?:\s*,|\s+S\.A\.|\s+S\.L\.|\s*$)", body)
        if m:
            return m.group(1).strip().title() or None
        # "MUNICIPI DE {city}"
        m = re.match(r"^.+\bMUNICIPI DE ([A-Z][A-Z\s]+?)(?:\s*,|\s+S\.A\.|\s+S\.L\.|\s*$)", body)
        if m:
            return m.group(1).strip().title() or None
        # Known municipal companies
        if "EMAYA" in body:
            return "Palma"
        if "CALVIA 2000" in body or "CALVIA" in body:
            return "Calvià"
        if "MADRID DESTINO" in body or "MADRID CALLE 30" in body:
            return "Madrid"
        if "LIMONIUM" in body or "LIMPIEZA DE MALAGA" in body:
            return "Málaga"
        if "DIVERTIA GIJON" in body:
            return "Gijón"
        if "MERCAMADRID" in body or "MERCADOS CENTRALES DE ABASTECIMIENTO DE MADRID" in body:
            return "Madrid"
        if "MERCAVALENCIA" in body:
            return "Valencia"
        if "MERCACORDOBA" in body:
            return "Córdoba"
        if "TRANSPORTES URBANOS DE SEVILLA" in body:
            return "Sevilla"
        if "EMPRESA MALAGUENA DE TRANSPORTES" in body:
            return "Málaga"
        if "SOCIEDAD MUNICIPAL DE APARCAMIENTOS DE LAS PALMAS" in body or "SAGULPA" in body:
            return "Las Palmas de Gran Canaria"
        if "GUAGUAS MUNICIPALES" in body:
            return "Las Palmas de Gran Canaria"
        if "AGUAS DE ALCAZAR" in body:
            return "Alcázar de San Juan"
        if "AGUAS DE SAGUNT" in body:
            return "Sagunto"
        if "AGUAS DE LANGREO" in body:
            return "Langreo"
        if "AGUAS DE CULLERA" in body:
            return "Cullera"
        if "AGUAS DE HUELVA" in body:
            return "Huelva"
        if "AIGUES I SANEJAMENT D'ELX" in body:
            return "Elche"
        if "AIGUES DE SAGUNT" in body:
            return "Sagunto"
        if "EMPRESA DE LA VIVIENDA DE SEVILLA" in body or "EMVISESA" in body:
            return "Sevilla"
        if "EMPRESA MIXTA DE AGUAS DE ANTIGUA" in body:
            return "Antigua"
        if "GESTION Y SERVICIOS DE PATERNA" in body:
            return "Paterna"
        if "ZARAGOZA DEPORTE MUNICIPAL" in body:
            return "Zaragoza"
        if "ECOCIUDAD ZARAGOZA" in body:
            return "Zaragoza"
        if "GERENCIA MUNICIPAL DE CULTURA Y DEPORTES DE SANTA LUCIA" in body:
            return "Santa Lucía de Tirajana"
        if "SERVICIOS COMUNITARIOS DE MOLINA" in body or "SERCOMOSA" in body:
            return "Molina de Segura"
        if "PROMOCIONES E INICIATIVAS MUNICIPALES DE ELCHE" in body or "PIMESA" in body:
            return "Elche"
        if "SOCIEDAD DE DESARROLLO DE SANTA CRUZ DE TENERIFE" in body:
            return "Santa Cruz de Tenerife"
        if "METROPOLITANO DE TENERIFE" in body:
            return "Santa Cruz de Tenerife"
        if "SERVICIOS MUNICIPALES DE GRANADILLA DE ABONA" in body:
            return "Granadilla de Abona"
        if "SERVICIOS MUNICIPALES DE ALCORCON" in body:
            return "Alcorcón"
        if "PROMOCION DE LA CIUDAD DE LAS PALMAS DE GRAN CANARIA" in body:
            return "Las Palmas de Gran Canaria"
        if "SOCIEDAD PARA LA PROMOCION Y DESARROLLO DE LA CIUDAD DE BURGOS" in body:
            return "Burgos"
        if "SOCIEDAD PARA EL DESARROLLO DE LAS TELECOMUNICACIONES EN GRAN CANARIA" in body:
            return "Las Palmas de Gran Canaria"
        if "PROMOCION Y DESARROLLO ECONOMICO DE LA ISLA DE LA PALMA" in body or "SODEPAL" in body:
            return "Santa Cruz de La Palma"
        if "SOCIEDAD MUNICIPAL DE DEPORTES DE SANTA BRIGIDA" in body:
            return "Santa Brígida"
        if "SOCIEDAD MUNICIPAL DE VIVIENDAS Y DE SERVICIOS DE SAN CRISTOBAL DE LA LAGUNA" in body:
            return "San Cristóbal de La Laguna"
        if "SOCIEDAD MUNICIPAL DE SUELO Y VIVIENDA DE VALLADOLID" in body:
            return "Valladolid"
        if "SOCIEDAD PROVINCIAL DE DESARROLLO DE VALLADOLID" in body or "SODEVA" in body:
            return "Valladolid"
        if "EMPRESA DE SERVICIOS MUNICIPALES DE ARGANDA" in body:
            return "Arganda del Rey"
        if "S.A.M. ACTUACIONES URBANAS DE VALENCIA" in body:
            return "Valencia"
        if "LIMPIEZA Y MANTENIMIENTO DE CARMONA" in body:
            return "Carmona"
        if "LIMPIEZA PUBLICA Y PROTECCION AMBIENTAL" in body or "LIPASAM" in body:
            return "Sevilla"
        if "EMPRESA DE LIMPIEZAS MUNICIPALES Y PARQUE DEL OESTE" in body:
            return "Málaga"
        if "CHICLANA NATURAL" in body:
            return "Chiclana de la Frontera"
        if "EMPRESA PUBLICA DE SERVICIOS CATARROJA" in body:
            return "Catarroja"
        if "CONSEJO DE ADMINISTRACION DE LA E.P.E SOLLER 2010" in body:
            return "Sóller"
        if "MARRATXI XXI" in body:
            return "Marratxí"
        if "REHABILITACIONES URBANAS AVILES" in body:
            return "Avilés"
        if "GESTION INTEGRAL DE INGRESOS DE SANTA LUCIA" in body:
            return "Santa Lucía de Tirajana"
        if "SERVICIOS TURISTICOS DE CEUTA" in body:
            return "Ceuta"
        if "VIVIENDAS MUNICIPALES DE CORDOBA" in body:
            return "Córdoba"
        if "PROMOCION Y GESTION DE VIVIENDAS DE CADIZ" in body:
            return "Cádiz"
        if "FUNDACION MUNICIPAL DE SERVICIOS SOCIALES" in body:
            return "Gijón"  # Most common context
        if "FUNDACION MUNICIPAL DE CULTURA" in body:
            return "Gijón"
        if "CENTRO MUNICIPAL DE INFORMATICA DE MALAGA" in body:
            return "Málaga"
        if "ORGANISMO AUTONOMO AGENCIA PARA EL EMPLEO DE MADRID" in body:
            return "Madrid"
        if "ORGANISMO AUTONOMO TERRA DE SANXENXO" in body:
            return "Sanxenxo"
        if "ORGANISMO AUTONOMO DE RECAUDACION Y GESTION TRIBUTARIA" in body:
            return "Badajoz"  # Diputación de Badajoz OAR
        if "ORGANISMO AUTONOMO CENTRO INFORMATICO PROVINCIAL DE SALAMANCA" in body:
            return "Salamanca"
        if "TEATRO CERVANTES DE MALAGA" in body:
            return "Málaga"
        if "PALAU DE CONGRESSOS DE PALMA" in body:
            return "Palma"
        if "FUNDACION TURISMO PALMA DE MALLORCA 365" in body:
            return "Palma"
        if "PALAU DE LA MUSICA DE VALENCIA" in body:
            return "Valencia"
        # Greedy last "DE {place}" for island/local entities
        m = re.search(r".+\bDE ([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)*)(?:\s*[\(,\-]|\s*$)", body)
        if m:
            return m.group(1).strip().title() or None
        return None

    result = _extract(body_normalized)
    if result:
        return result
    if stripped and stripped != body_normalized:
        return _extract(stripped)
    return None


def infer_autonomic_territory(body_normalized: str | None) -> str | None:
    """Extract autonomous community or province from an autonomic awarding body name.
    Checks both the raw body and the governance-stripped version."""
    if not body_normalized:
        return None

    stripped = strip_governance_prefix(body_normalized)

    def _extract(body: str) -> str | None:
        # Pattern 1: "Consejería de X del Principado de Asturias" → "Asturias"
        m = re.search(
            r"(?:DEL|DE LA|DE LAS|DE LOS|DE)\s+"
            r"(PRINCIPADO DE ASTURIAS"
            r"|GOBIERNO VASCO"
            r"|GENERALITAT (?:DE |VALENCIANA|CATALUNYA)"
            r"|GOBIERNO DE (?:NAVARRA|ARAGON|CANARIAS|CANTABRIA|LA RIOJA|EXTREMADURA|LAS ISLAS BALEARES|ILLES BALEARS)"
            r"|JUNTA DE (?:ANDALUCIA|CASTILLA Y LEON|CASTILLA-LA MANCHA|EXTREMADURA|GALICIA|COMUNIDADES DE CASTILLA-LA MANCHA)"
            r"|XUNTA DE GALICIA)",
            body,
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
        m = re.search(r" EN ([\w\s]+?)$", body)
        if m:
            place = m.group(1).strip().title()
            if place.upper() in _PROVINCE_TO_CCAA:
                return _PROVINCE_TO_CCAA[place.upper()]
            return place or None

        # Pattern 3: "... de la Junta de Comunidades de Castilla-La Mancha" → "Castilla-La Mancha"
        m = re.search(r"(JUNTA DE (?:COMUNIDADES DE )?(?:CASTILLA-LA MANCHA|CASTILLA Y LEON|ANDALUCIA|EXTREMADURA|GALICIA))", body)
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
        m = re.search(r"DIPUTACION (?:PROVINCIAL |FORAL |)DE (?:LA |EL )?(.+?)(?:\s*[\(,]|\s*$)", body)
        if m:
            province = m.group(1).strip()
            if province in _PROVINCE_TO_CCAA:
                return _PROVINCE_TO_CCAA[province]

        # Pattern 5: "Provincia de {province}" in body → CCAA
        m = re.search(r"PROVINCIA DE (?:LA |EL )?(.+?)(?:\s*[\(,\-]|\s*$)", body)
        if m:
            province = m.group(1).strip()
            if province in _PROVINCE_TO_CCAA:
                return _PROVINCE_TO_CCAA[province]

        # Known entity → CCAA direct mappings
        known_entity_map: dict[str, str] = {
            "INSTITUTO TECNOLOGICO DE ARAGON": "Aragón",
            "INSTITUTO TECNOLOGICO DE CANARIAS": "Canarias",
            "SUELO Y VIVIENDA DE ARAGON": "Aragón",
            "RADIO PUBLICA DE CANARIAS": "Canarias",
            "TELEVISION PUBLICA DE CANARIAS": "Canarias",
            "RADIO AUTONOMICA DE ARAGON": "Aragón",
            "TELEVISION AUTONOMICA DE ARAGON": "Aragón",
            "AGENCIA DE DESARROLLO REGIONAL DE LAS ILLES BALEARS": "Illes Balears",
            "AGENCIA BALEAR DEL AGUA": "Illes Balears",
            "AGENCIA CANARIA DE INVESTIGACION": "Canarias",
            "PUERTOS DE LAS ILLES BALEARS": "Illes Balears",
            "INSTITUTO CANARIO DE LA VIVIENDA": "Canarias",
            "INSTITUTO CANARIO DE CALIDAD AGROALIMENTARIA": "Canarias",
            "INSTITUTO CANARIO DE ADMINISTRACION PUBLICA": "Canarias",
            "INSTITUTO DE ASTROFISICA DE CANARIAS": "Canarias",
            "CONSORCIO DE TRANSPORTES DE MALLORCA": "Illes Balears",
            "CONSORCIO ESCUELA DE HOSTELERIA DE LAS ILLES BALEARS": "Illes Balears",
            "CONSORCIO DE RECURSOS SOCIOSANITARIOS Y ASISTENCIALES DE LAS ILLES BALEARS": "Illes Balears",
            "CONSORCIO HOSPITAL GENERAL UNIVERSITARIO DE VALENCIA": "Comunitat Valenciana",
            "ESCUELA BALEAR DE ADMINISTRACION PUBLICA": "Illes Balears",
            "FONS DE GARANTIA AGRARIA I PESQUERA DE LES ILLES BALEARS": "Illes Balears",
            "INSTITUTO DE LAS INDUSTRIAS CULTURALES Y DE LAS ARTES DE LA REGION DE MURCIA": "Murcia",
            "ORGANISMO AUTONOMO ESTABLECIMIENTOS RESIDENCIALES PARA ANCIANOS DE ASTURIAS": "Asturias",
            "AGENCIA DE CIENCIA, COMPETITIVIDAD EMPRESARIAL E INNOVACION ASTURIANA": "Asturias",
            "AGENCIA VALENCIANA DE SEGURIDAD": "Comunitat Valenciana",
            "FUNDACION DEL PATRIMONIO NATURAL DE CASTILLA Y LEON": "Castilla y León",
            "FUNDACION DEL CENTRO SUPERCOMPUTACION DE CASTILLA Y LEON": "Castilla y León",
            "FUNDACION DE HEMOTERAPIA Y HEMODONACION DE CASTILLA Y LEON": "Castilla y León",
            "FUNDACION DE ATENCION Y APOYO A LA DEPENDENCIA Y DE PROMOCION DE LA AUTONOMIA PERSONAL DE LAS ILLES BALEARS": "Illes Balears",
            "FUNDACION BALEAR DE INNOVACION Y TECNOLOGIA": "Illes Balears",
            "FUNDACION DE LA COMUNITAT VALENCIANA": "Comunitat Valenciana",
            "FUNDACION PARA LA INVESTIGACION DEL HOSPITAL CLINICO DE LA COMUNIDAD VALENCIANA": "Comunitat Valenciana",
            "FUNDACION CANARIA SANTA CRUZ SOSTENIBLE": "Canarias",
            "FUNDACION CANARIA ORQUESTA FILARMONICA DE GRAN CANARIA": "Canarias",
            "FUNDACION CANARIA PARA EL FOMENTO DEL TRANSPORTE ESPECIAL ADAPTADO": "Canarias",
            "FUNDACION INSTITUTO DE INVESTIGACION SANITARIA ARAGON": "Aragón",
            "FUNDACION PARA LA INVESTIGACION DE MALAGA EN BIOMEDICINA Y SALUD": "Andalucía",
            "FUNDACION PARA LA INVESTIGACION BIOSANITARIA DE ANDALUCIA ORIENTAL": "Andalucía",
            "CENTRAL DE CONTRATACION DE LA ADMINISTRACION DE LA COMUNIDAD AUTONOMA DE LAS ILLES BALEARS": "Illes Balears",
            "INSTITUT MALLORQUI D' AFERS SOCIALS": "Illes Balears",
            "INSTITUTO INSULAR DE ATENCION SOCIAL": "Canarias",
            "SOCIEDAD PUBLICA DE INFRAESTRUCTURAS Y MEDIO AMBIENTE DE CASTILLA Y LEON": "Castilla y León",
            "SOCIEDAD DE PROMOCION Y GESTION DEL TURISMO ARAGONES": "Aragón",
            "PARQUE TECNOLOGICO DEL MOTOR DE ARAGON": "Aragón",
            "ENTIDAD PUBLICA ARAGONESA": "Aragón",
            "VALENCIANA D'ESTRATEGIES I RECURSOS PER A LA SOSTENIBILITAT AMBIENTAL": "Comunitat Valenciana",
            "MESA DE LES CORTS VALENCIANES": "Comunitat Valenciana",
            "MESA DEL PARLAMENTO DE CANARIAS": "Canarias",
            "CONSELL RECTOR DEL INSTITUT MALLORQUI": "Illes Balears",
            "HOSPITAL INTERMUTUAL DE EUSKADI": "País Vasco",
            "HOSPITAL INTERMUTUAL DE LEVANTE": "Comunitat Valenciana",
            "ENTIDAD REGIONAL DE SANEAMIENTO": "Murcia",
            "CAMARA OFICIAL DE COMERCIO, INDUSTRIA, SERVICIOS Y NAVEGACION DE HUELVA": "Andalucía",
            "CAMARA OFICIAL DE COMERCIO, INDUSTRIA, SERVICIOS Y NAVEGACION DE SANTA CRUZ DE TENERIFE": "Canarias",
            "CONSORCIO DE GESTION DE SERVICIOS MEDIOAMBIENTALES DE BADAJOZ": "Extremadura",
            "CONSORCIO PARA EL DISENO, CONSTRUCCION, EQUIPAMIENTO Y EXPLOTACION DEL SISTEMA DE OBSERVACION COSTERO DE LAS ILLES BALEARS": "Illes Balears",
            "CONSORCIO DE TURISMO RIBEIRA SACRA": "Galicia",
            "CONSORCIO PROVINCIAL DE MEDIO AMBIENTE DE VALLADOLID": "Castilla y León",
            "PATRONATO PROVINCIAL DE TURISMO DE GRANADA": "Andalucía",
            "PATRONATO PROVINCIAL DE LA ESCUELA DE TAUROMAQUIA": "Andalucía",
            "AGENCIA PROVINCIAL DE EXTINCION DE INCENDIOS DE GRANADA": "Andalucía",
            "SOCIEDAD PROVINCIAL DE INFORMATICA DE SEVILLA": "Andalucía",
            "SOCIEDAD PROVINCIAL DE DESARROLLO DE VALLADOLID": "Castilla y León",
            "EMPRESA PROVINCIAL DE RESIDUOS Y MEDIO AMBIENTE": "Andalucía",
            "INSTITUTO ARAGONES": "Aragón",
            "INSTITUTO CANTABRO": "Cantabria",
            "INSTITUTO ASTURIANO": "Asturias",
            "INSTITUTO GALLEGO": "Galicia",
            "INSTITUTO MURCIANO": "Murcia",
            "INSTITUTO BALEAR": "Illes Balears",
            "INSTITUTO VALENCIANO DE COMPETITIVIDAD EMPRESARIAL": "Comunitat Valenciana",
            "GERENCIA DE ATENCION INTEGRADA DE ALBACETE": "Castilla-La Mancha",
            "GERENCIA DE ATENCION INTEGRADA DE CUENCA": "Castilla-La Mancha",
            "GERENCIA DE ATENCION INTEGRADA DE GUADALAJARA": "Castilla-La Mancha",
            "GERENCIA DE ATENCION INTEGRADA DE PUERTOLLANO": "Castilla-La Mancha",
            "GERENCIA DE ATENCION ESPECIALIZADA DE LEON": "Castilla y León",
            "GERENCIA DE ATENCION ESPECIALIZADA DE SALAMANCA": "Castilla y León",
            "GERENCIA DE ATENCION ESPECIALIZADA DE MEDINA DEL CAMPO": "Castilla y León",
            "GERENCIA DE ASISTENCIA SANITARIA DE PALENCIA": "Castilla y León",
            "GERENCIA DE ASISTENCIA SANITARIA DE ZAMORA": "Castilla y León",
            "GERENCIA DE ASISTENCIA SANITARIA DE AVILA": "Castilla y León",
            "GERENCIA DE ASISTENCIA SANITARIA DEL BIERZO": "Castilla y León",
            "GERENCIA DEL AREA DE SALUD DE BADAJOZ": "Extremadura",
            "GERENCIA DEL AREA DE SALUD DE PLASENCIA": "Extremadura",
            "GERENCIA DEL AREA DE SALUD DE CORIA": "Extremadura",
            "GERENCIA DEL AREA DE SALUD DE DON BENITO": "Extremadura",
            "GERENCIA DEL AREA DE SALUD DE LLERENA-ZAFRA": "Extremadura",
            "GERENCIA DE ATENCION PRIMARIA VALLADOLID OESTE": "Castilla y León",
            "GERENCIA DE SALUD DE AREAS DE VALLADOLID": "Castilla y León",
            "GERENCIA DE ATENCION ESPECIALIZADA HOSPITAL UNIV. RIO HORTEGA DE VALLADOLID": "Castilla y León",
            "DIRECCION GERENCIA DE ATENCION PRIMARIA DE TOLEDO": "Castilla-La Mancha",
            "GERENCIA DE SERVICIOS SANITARIOS DEL AREA DE SALUD DE LANZAROTE": "Canarias",
            "GERENCIA DE SERVICIO SANITARIOS DE FUERTEVENTURA": "Canarias",
            "GERENCIA DE LOS SERVICIOS SANITARIOS DEL AREA DE SALUD DE LA PALMA": "Canarias",
            "GERENCIA DE ATENCION PRIMARIA DEL AREA DE SALUD DE TENERIFE": "Canarias",
            "GERENCIA DE ATENCION PRIMARIA DEL AREA DE SALUD DE GRAN CANARIA": "Canarias",
            "GERENCIA DE URGENCIAS, EMERGENCIAS Y TRANSPORTE SANITARIO": "Castilla-La Mancha",
            "SERVICIO DE EMERGENCIAS SANITARIAS DE LA COMUNITAT VALENCIANA": "Comunitat Valenciana",
            "SERVICIO TERRITORIAL DE MEDIO AMBIENTE DE SORIA": "Castilla y León",
            "SERVICIO TERRITORIAL DE MEDIO AMBIENTE DE VALLADOLID": "Castilla y León",
            "SERVICIO TERRITORIAL DE MEDIO AMBIENTE DE AVILA": "Castilla y León",
            "SERVICIO TERRITORIAL DE MEDIO AMBIENTE DE LEON": "Castilla y León",
            "SERVICIO TERRITORIAL DE MOVILIDAD Y TRANSFORMACION DIGITAL DE VALLADOLID": "Castilla y León",
            "GERENCIA TERRITORIAL DE SERVICIOS SOCIALES DE AVILA": "Castilla y León",
            "DELEGACION DE ECONOMIA Y HACIENDA EN MURCIA": "Murcia",
            "DELEGACION DE ECONOMIA Y HACIENDA EN GUADALAJARA": "Castilla-La Mancha",
            "DELEGACION DE ECONOMIA Y HACIENDA EN CUENCA": "Castilla-La Mancha",
            "DELEGACION DEL GOBIERNO EN GALICIA": "Galicia",
            "DELEGACION DEL GOBIERNO EN MURCIA": "Murcia",
            "DELEGACION DEL GOBIERNO EN LA CIUDAD AUTONOMA DE CEUTA": "Ceuta",
            "SUBDELEGACION DEL GOBIERNO EN ALMERIA": "Andalucía",
            "FUNDACION INSULAR PARA LA FORMACION, EL EMPLEO Y EL DESARROLLO EMPRESARIAL": "Canarias",
            "FUNDACION DE ATENCION Y APOYO A LA DEPENDENCIA": "Illes Balears",
            "RADIO TELEVISION MELILLA": "Melilla",
            "CONSEJO DE ADMINISTRACION DE RADIO TELEVISION MELILLA": "Melilla",
            "CONSEJO DE ADMINISTRACION DE LA SOCIETAT VALENCIANA FIRA VALENCIA": "Comunitat Valenciana",
            "PRESIDENCIA DE LA ENTIDAD PUBLICA EMPRESARIAL GESTION SANITARIA Y ASISTENCIAL DE LAS ILLES BALEARS": "Illes Balears",
            "DIRECCION DEL INSTITUTO CANARIO DE ADMINISTRACION PUBLICA": "Canarias",
        }
        for key, ccaa in known_entity_map.items():
            if key in body:
                return ccaa

        # Pattern 6: CCAA keyword scan — longest keywords first to avoid partial matches
        for keyword, ccaa in _CCAA_KEYWORDS:
            if keyword in body:
                return ccaa

        # Pattern 7: greedy scan for last "DE {place}" in names like
        # "Rectorado de la Universidad de Zaragoza" → "Zaragoza"
        m = re.search(r".+\bDE ([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)*)(?:\s*[\(,\-]|\s*$)", body)
        if m:
            place = m.group(1).strip()
            if place in _PROVINCE_TO_CCAA:
                return _PROVINCE_TO_CCAA[place]

        return None

    result = _extract(body_normalized)
    if result:
        return result
    if stripped and stripped != body_normalized:
        return _extract(stripped)
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
