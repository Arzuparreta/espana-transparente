"""Smoke tests for senado.senadores (offline — no network)."""

import pytest
from senado.senadores import (
    senate_id_from_name,
    parse_name,
    acronym_from_party,
    _get_meta,
    scrape_ficha,
)

# ── senate_id_from_name ──────────────────────────────────────────────────────

def test_senate_id_prefix():
    cid = senate_id_from_name("ARENAS BOCANEGRA, FRANCISCO JAVIER")
    assert cid.startswith("sen-")


def test_senate_id_stable():
    a = senate_id_from_name("PÉREZ GARCÍA, JOSÉ")
    b = senate_id_from_name("PÉREZ GARCÍA, JOSÉ")
    assert a == b


def test_senate_id_unique():
    a = senate_id_from_name("GARCÍA LÓPEZ, ANA")
    b = senate_id_from_name("FERNÁNDEZ RUIZ, ANTONIO")
    assert a != b


def test_senate_id_no_special_chars():
    cid = senate_id_from_name("ÍÑIGUEZ MOLINA, ÓSCAR")
    assert all(c not in cid for c in "áéíóúñü")


# ── parse_name ───────────────────────────────────────────────────────────────

def test_parse_name_comma_format():
    first, last = parse_name("ARENAS BOCANEGRA, FRANCISCO JAVIER")
    assert first == "Francisco Javier"
    assert last == "Arenas Bocanegra"


def test_parse_name_single_surname():
    first, last = parse_name("RUIZ, ANA")
    assert first == "Ana"
    assert last == "Ruiz"


def test_parse_name_no_comma():
    first, last = parse_name("JUAN CARLOS PÉREZ")
    assert len(first) > 0
    assert len(last) > 0


def test_parse_name_strips_whitespace():
    first, last = parse_name("  ROMERO PÉREZ, MARTA  ")
    assert first == "Marta"
    assert last == "Romero Pérez"


# ── acronym_from_party ───────────────────────────────────────────────────────

def test_acronym_pp():
    assert acronym_from_party("PARTIDO POPULAR", "GRUPO PARLAMENTARIO POPULAR EN EL SENADO") == "PP"


def test_acronym_psoe():
    assert acronym_from_party("PARTIDO SOCIALISTA OBRERO ESPAÑOL", "GRUPO PARLAMENTARIO SOCIALISTA") == "PSOE"


def test_acronym_eajpnv():
    assert acronym_from_party("EAJ-PNV", "GRUPO PARLAMENTARIO VASCO") == "EAJ-PNV"


def test_acronym_unknown_fallback():
    acr = acronym_from_party("PARTIDO DESCONOCIDO", "GRUPO MIXTO")
    assert len(acr) > 0


# ── _get_meta ────────────────────────────────────────────────────────────────

SAMPLE_HTML = """
<html>
<head>
<meta name="Nombre" content="FRANCISCO JAVIER ARENAS BOCANEGRA"/>
<meta name="Partido politico" content="PARTIDO POPULAR"/>
<meta name="Grupo Parlamentario" content="GRUPO PARLAMENTARIO POPULAR EN EL SENADO"/>
<meta name="Tipo Procedencia" content="DESIGNADO"/>
<meta name="Procedencia" content="ANDALUCÍA"/>
<meta name="Legislatura" content="15"/>
<meta name="Sexo" content="V"/>
</head>
<body></body>
</html>
"""


def test_get_meta_nombre():
    assert _get_meta(SAMPLE_HTML, "Nombre") == "FRANCISCO JAVIER ARENAS BOCANEGRA"


def test_get_meta_partido():
    assert _get_meta(SAMPLE_HTML, "Partido politico") == "PARTIDO POPULAR"


def test_get_meta_missing():
    assert _get_meta(SAMPLE_HTML, "NoExiste") == ""


def test_get_meta_procedencia():
    assert _get_meta(SAMPLE_HTML, "Procedencia") == "ANDALUCÍA"


def test_get_meta_legislatura():
    assert _get_meta(SAMPLE_HTML, "Legislatura") == "15"


# ── scrape_ficha (offline, mocked HTML) ─────────────────────────────────────

def test_scrape_ficha_offline(monkeypatch):
    """scrape_ficha parses meta tags correctly when given a pre-built HTML."""
    import senado.senadores as mod

    def fake_fetch(url):
        return SAMPLE_HTML + '<img src="https://www.senado.es/legis15/senadores/fotos/S15001.jpg"/>'

    monkeypatch.setattr(mod, "_fetch", fake_fetch)
    monkeypatch.setattr(mod, "time", type("T", (), {"sleep": staticmethod(lambda x: None)})())

    result = mod.scrape_ficha("/web/fichasenador/index.html?id1=99999&legis=15")
    assert result["nombre"] == "FRANCISCO JAVIER ARENAS BOCANEGRA"
    assert result["partido"] == "PARTIDO POPULAR"
    assert result["tipo_procedencia"] == "DESIGNADO"
    assert result["procedencia"] == "ANDALUCÍA"
    assert result["photo_url"] == "https://www.senado.es/legis15/senadores/fotos/S15001.jpg"
