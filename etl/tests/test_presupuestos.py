"""Tests for the presupuestos ETL pipeline."""

import pytest

from presupuestos.presupuestos import (
    _parse_amount,
    detect_delimiter,
    parse_sepg_records,
    parse_records,
)
from presupuestos.sources import BudgetSource
from presupuestos.scraper_sepg import SepgRecord


# ─── Fixtures ────────────────────────────────────────────────────────────────

def _make_source(year: int = 2025, fmt: str = "csv_semicolon", enc: str = "utf-8") -> BudgetSource:
    return BudgetSource(year=year, fmt=fmt, gastos_url="https://example.com/pge.csv")


CSV_SEMICOLON = b"""\
SECCION;DENOMINACION_SECCION;ORGANISMO;DENOMINACION_ORGANISMO;PROGRAMA;DENOMINACION_PROGRAMA;CAPITULO;ARTICULO;CONCEPTO;CREDITOS_INICIALES;CREDITOS_DEFINITIVOS
06;Ministerio de Hacienda;001;Ministerio de Hacienda;134A;Administracion general;1;11;110;1234567.89;1250000.00
06;Ministerio de Hacienda;001;Ministerio de Hacienda;134A;Administracion general;2;22;220;987654.32;
13;Ministerio de Defensa;001;Estado Mayor de la Defensa;121A;Administracion y servicios generales de la Defensa;1;11;110;5000000.00;5100000.00
"""

CSV_COMMA = b"""\
SECCION,DENOMINACION_SECCION,PROGRAMA,DENOMINACION_PROGRAMA,CAPITULO,CREDITOS_INICIALES
06,Ministerio de Hacienda,134A,Administracion general,1,1234567.89
"""

CSV_EUROS_COL = b"""\
SECCION;DENOMINACION_SECCION;PROGRAMA;DENOMINACION_PROGRAMA;CAPITULO;EUROS
06;Ministerio de Hacienda;134A;Administracion general;1;1234567,89
"""

CSV_MISSING_REQUIRED = b"""\
SECCION;DENOMINACION_SECCION
06;Ministerio de Hacienda
"""

CSV_EMPTY_ROWS = b"""\
SECCION;DENOMINACION_SECCION;PROGRAMA;DENOMINACION_PROGRAMA;CAPITULO;CREDITOS_INICIALES
06;Ministerio de Hacienda;134A;Administracion general;1;1000000.00
;;134A;Administracion general;1;500.00
06;Ministerio de Hacienda;;Administracion general;1;500.00
06;Ministerio de Hacienda;134A;Administracion general;;500.00
"""


# ─── Amount parsing ───────────────────────────────────────────────────────────

def test_parse_amount_dot_separator():
    assert _parse_amount("1234567.89") == pytest.approx(1234567.89)


def test_parse_amount_comma_separator():
    assert _parse_amount("1234567,89") == pytest.approx(1234567.89)


def test_parse_amount_dot_thousands_comma_decimal():
    # "1.234.567,89" → strip dots → "1234567,89" → swap comma → 1234567.89
    assert _parse_amount("1.234.567,89") == pytest.approx(1234567.89)


def test_parse_amount_empty():
    assert _parse_amount("") is None
    assert _parse_amount(None) is None
    assert _parse_amount("   ") is None


def test_parse_amount_non_numeric():
    assert _parse_amount("N/D") is None


# ─── Delimiter detection ──────────────────────────────────────────────────────

def test_detect_delimiter_semicolon():
    assert detect_delimiter("SECCION;PROGRAMA;CAPITULO;EUROS") == ";"


def test_detect_delimiter_comma():
    assert detect_delimiter("SECCION,PROGRAMA,CAPITULO,EUROS") == ","


def test_detect_delimiter_tab():
    assert detect_delimiter("SECCION\tPROGRAMA\tCAPITULO") == "\t"


# ─── parse_records ────────────────────────────────────────────────────────────

def test_parse_records_semicolon_csv():
    source = _make_source()
    records = parse_records(CSV_SEMICOLON, source)
    assert len(records) == 3

    first = records[0]
    assert first["year"] == 2025
    assert first["section_code"] == "06"
    assert first["section_name"] == "Ministerio de Hacienda"
    assert first["program_code"] == "134A"
    assert first["program_name"] == "Administracion general"
    assert first["economic_chapter"] == 1
    assert first["economic_article"] == "11"
    assert first["credit_initial"] == pytest.approx(1234567.89)
    assert first["credit_final"] == pytest.approx(1250000.00)
    assert first["administration_level"] == "state"
    assert first["ministry_normalized"] == "MINISTERIO DE HACIENDA"


def test_parse_records_comma_csv():
    source = _make_source(fmt="csv_comma")
    records = parse_records(CSV_COMMA, source)
    assert len(records) == 1
    assert records[0]["section_code"] == "06"
    assert records[0]["economic_chapter"] == 1


def test_parse_records_euros_col_with_comma_decimal():
    source = _make_source()
    records = parse_records(CSV_EUROS_COL, source)
    assert len(records) == 1
    assert records[0]["credit_initial"] == pytest.approx(1234567.89)
    assert records[0]["credit_final"] is None


def test_parse_records_skips_rows_missing_required_fields():
    source = _make_source()
    # Rows with empty section_code, program_code, or chapter are skipped
    records = parse_records(CSV_EMPTY_ROWS, source)
    assert len(records) == 1
    assert records[0]["section_code"] == "06"
    assert records[0]["program_code"] == "134A"


def test_parse_records_raises_on_missing_required_columns():
    source = _make_source()
    with pytest.raises(RuntimeError, match="Could not find required columns"):
        parse_records(CSV_MISSING_REQUIRED, source)


def test_parse_records_multiple_sections():
    source = _make_source()
    records = parse_records(CSV_SEMICOLON, source)
    sections = {r["section_code"] for r in records}
    assert "06" in sections
    assert "13" in sections


def test_parse_records_ministry_normalization():
    source = _make_source()
    records = parse_records(CSV_SEMICOLON, source)
    hacienda = [r for r in records if r["section_code"] == "06"]
    assert all(r["ministry_normalized"] == "MINISTERIO DE HACIENDA" for r in hacienda)

    defensa = [r for r in records if r["section_code"] == "13"]
    assert all(r["ministry_normalized"] == "MINISTERIO DE DEFENSA" for r in defensa)


def test_parse_records_null_credit_final_when_column_missing():
    source = _make_source()
    # CSV_EUROS_COL has no CREDITOS_DEFINITIVOS column
    records = parse_records(CSV_EUROS_COL, source)
    assert records[0]["credit_final"] is None


def test_parse_records_raw_data_preserves_original_row():
    source = _make_source()
    records = parse_records(CSV_SEMICOLON, source)
    # raw_data should wrap the original dict (psycopg2.extras.Json)
    raw = records[0]["raw_data"]
    assert raw is not None


def test_parse_records_source_url_propagated():
    source = _make_source()
    records = parse_records(CSV_SEMICOLON, source)
    assert all(r["source_url"] == "https://example.com/pge.csv" for r in records)


def test_parse_records_budget_type_propagated():
    source = BudgetSource(
        year=2019,
        fmt="civio",
        gastos_url="https://example.com/pge.csv",
        budget_type="proyecto",
    )
    records = parse_records(CSV_SEMICOLON, source)
    assert all(r["budget_type"] == "proyecto" for r in records)


def test_parse_sepg_records_builds_budget_lines():
    source = BudgetSource(
        year=2024,
        fmt="sepg_prorroga",
        gastos_url="https://example.com/pge2024prorroga",
        budget_type="prorroga",
        in_force_year=2023,
    )
    rows = [
        SepgRecord(
            section_code="06",
            section_name="DEUDA PÚBLICA",
            program_code="951N",
            program_name="Amortización y gastos financieros de la deuda pública en euros",
            economic_chapter=3,
            credit_initial=123456.0,
        )
    ]

    records = parse_sepg_records(rows, source)

    assert len(records) == 1
    assert records[0]["year"] == 2024
    assert records[0]["budget_type"] == "prorroga"
    assert records[0]["credit_initial"] == pytest.approx(123456.0)
    assert records[0]["credit_final"] is None
