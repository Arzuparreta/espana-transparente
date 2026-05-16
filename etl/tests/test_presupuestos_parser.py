"""Offline parser tests for presupuestos pipeline (no network, no DB)."""

from presupuestos.presupuestos import (
    _load_funcional,
    _load_organica,
    _parse_amount,
    detect_delimiter,
)


# ─── _parse_amount: handles Spanish thousand/decimal formats ───────────────

def test_parse_amount_spanish_with_thousands_and_decimals():
    assert _parse_amount("1.234.567,89") == 1234567.89


def test_parse_amount_comma_decimal_only():
    assert _parse_amount("1234567,89") == 1234567.89


def test_parse_amount_dot_decimal_only():
    assert _parse_amount("1234567.89") == 1234567.89


def test_parse_amount_plain_integer():
    assert _parse_amount("1234567") == 1234567.0


def test_parse_amount_empty_returns_none():
    assert _parse_amount("") is None
    assert _parse_amount(None) is None
    assert _parse_amount("   ") is None


def test_parse_amount_invalid_returns_none():
    assert _parse_amount("not-a-number") is None


def test_parse_amount_strips_spaces():
    assert _parse_amount("  1.000,50 ") == 1000.50


# ─── detect_delimiter ──────────────────────────────────────────────────────

def test_detect_delimiter_prefers_semicolon():
    assert detect_delimiter("a;b;c,d") == ";"


def test_detect_delimiter_falls_back_to_comma():
    assert detect_delimiter("a,b,c,d") == ","


def test_detect_delimiter_detects_tab():
    assert detect_delimiter("a\tb\tc") == "\t"


# ─── _load_organica / _load_funcional ──────────────────────────────────────

def test_load_organica_indexes_by_centro_gestor():
    raw = (
        b"CENTRO GESTOR;DESCRIPCION LARGA\n"
        b"15;Ministerio de Hacienda\n"
        b"27;Ministerio para la Transformacion Digital\n"
    )
    out = _load_organica(raw)
    assert out["15"] == "Ministerio de Hacienda"
    assert out["27"] == "Ministerio para la Transformacion Digital"


def test_load_organica_skips_blank_rows():
    raw = (
        b"CENTRO GESTOR;DESCRIPCION LARGA\n"
        b";\n"
        b"15;Ministerio de Hacienda\n"
        b"27;\n"
    )
    out = _load_organica(raw)
    assert out == {"15": "Ministerio de Hacienda"}


def test_load_funcional_returns_empty_when_no_bytes():
    assert _load_funcional(b"") == {}


def test_load_funcional_prefers_long_description():
    raw = (
        b"PROGRAMA;DESCRIPCION LARGA;DESCRIPCION CORTA\n"
        b"912O;Presidencia del Gobierno;Presidencia\n"
    )
    out = _load_funcional(raw)
    assert out["912O"] == "Presidencia del Gobierno"


def test_load_funcional_falls_back_to_short():
    raw = (
        b"PROGRAMA;DESCRIPCION LARGA;DESCRIPCION CORTA\n"
        b"912O;;Presidencia\n"
    )
    out = _load_funcional(raw)
    assert out["912O"] == "Presidencia"
