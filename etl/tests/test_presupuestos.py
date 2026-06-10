"""Tests for the presupuestos ETL pipeline."""

import pytest

from presupuestos.presupuestos import (
    _parse_amount,
    build_carried_forward_records,
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
    assert all(r["source_kind"] == "published" for r in records)
    assert all(r["source_year"] == 2019 for r in records)


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
    assert records[0]["source_kind"] == "published_prorroga"
    assert records[0]["source_year"] == 2024
    assert records[0]["in_force_year"] == 2023
    assert records[0]["credit_initial"] == pytest.approx(123456.0)
    assert records[0]["credit_final"] is None


def test_build_carried_forward_records_clones_missing_prorroga_section():
    source = BudgetSource(
        year=2026,
        fmt="sepg_prorroga",
        gastos_url="https://example.com/pge2026prorroga",
        budget_type="prorroga",
        in_force_year=2023,
    )
    base_records = [
        {
            "year": 2023,
            "budget_type": "ley",
            "source_kind": "published",
            "source_year": 2023,
            "in_force_year": 2023,
            "section_code": "60",
            "section_name": "Seguridad Social",
            "service_code": None,
            "service_name": None,
            "program_code": "211A",
            "program_name": "Pensiones contributivas de la Seguridad Social",
            "economic_chapter": 4,
            "economic_article": None,
            "economic_concept": None,
            "credit_initial": 159688815850.0,
            "credit_final": None,
            "ministry_normalized": "SEGURIDAD SOCIAL",
            "administration_level": "state",
            "source_url": "https://example.com/pge2023",
            "raw_data": {"source": "PGE 2023"},
        }
    ]

    carried = build_carried_forward_records(base_records, source, section_codes={"60"})

    assert len(carried) == 1
    assert carried[0]["year"] == 2026
    assert carried[0]["budget_type"] == "prorroga"
    assert carried[0]["source_kind"] == "carried_forward"
    assert carried[0]["source_year"] == 2023
    assert carried[0]["in_force_year"] == 2023
    assert carried[0]["section_code"] == "60"
    assert carried[0]["credit_initial"] == pytest.approx(159688815850.0)


# ─── --resume skip path (records the skip so freshness view updates) ─────────

def test_run_year_resume_skip_records_succeeded_run(monkeypatch):
    """When --resume detects the chunk is already succeeded, run_year must
    still INSERT a row in etl_runs with status='succeeded' and finished_at=now()
    so that v_etl_pipeline_status picks it up. Otherwise the freshness view
    keeps pointing at the previous run's finished_at and the portal marks
    the pipeline as 'delayed' forever."""

    from common import etl_runs as er
    from presupuestos import presupuestos as p

    # Track what was written so we can assert on it
    started: list[dict] = []
    finished: list[dict] = []
    committed = {"n": 0}

    class FakeCursor:
        def execute(self, *_args, **_kwargs):
            pass

        def close(self):
            pass

    class FakeConn:
        def cursor(self):
            return FakeCursor()

        def commit(self):
            committed["n"] += 1

        def close(self):
            pass

    fake_conn = FakeConn()

    monkeypatch.setattr(p, "get_pg_conn", lambda: fake_conn)

    def fake_start(cur, *, pipeline, chunk_key, window_start, window_end):
        run_id = f"rid-{len(started)}"
        started.append(
            {
                "id": run_id,
                "pipeline": pipeline,
                "chunk_key": chunk_key,
                "window_start": window_start,
                "window_end": window_end,
            }
        )
        return run_id

    def fake_finish(cur, *, run_id, status, rows_read=0, rows_inserted=0,
                    rows_updated=0, error_summary=None):
        finished.append(
            {
                "run_id": run_id,
                "status": status,
                "rows_read": rows_read,
                "rows_inserted": rows_inserted,
            }
        )

    def fake_is_succeeded(cur, *, pipeline, chunk_key, window_start, window_end):
        return True  # the chunk is already done

    monkeypatch.setattr(p, "start_run", fake_start)
    monkeypatch.setattr(p, "finish_run", fake_finish)
    monkeypatch.setattr(p, "is_chunk_succeeded", fake_is_succeeded)

    read, upserted = p.run_year(year=2026, resume=True, dry_run=False)

    assert (read, upserted) == (0, 0)
    # start_run + finish_run were called even though the chunk was skipped
    assert len(started) == 1
    assert started[0]["pipeline"] == "presupuestos"
    assert started[0]["chunk_key"] == "2026"
    assert len(finished) == 1
    assert finished[0]["status"] == "succeeded"
    assert finished[0]["rows_inserted"] == 0
    # The skip path must commit the start + finish (2 commits) before close
    assert committed["n"] == 2


def test_run_year_resume_no_skip_still_works(monkeypatch):
    """Sanity check: when is_chunk_succeeded returns False, the skip path
    is NOT taken and start_run is NOT called with a fake is_succeeded.
    This guards against accidentally taking the skip path when the chunk
    has never been processed."""

    from presupuestos import presupuestos as p

    class FakeCursor:
        def execute(self, *_args, **_kwargs):
            pass

        def close(self):
            pass

    class FakeConn:
        def cursor(self):
            return FakeCursor()

        def commit(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(p, "get_pg_conn", lambda: FakeConn())

    started: list[str] = []

    def fake_start(cur, **_kw):
        rid = f"rid-{len(started)}"
        started.append(rid)
        return rid

    def fake_finish(*_args, **_kwargs):
        pass

    def fake_is_succeeded(cur, **_kw):
        return False  # chunk not done → must NOT skip

    # Make download_gastos raise so we exit early without touching the DB
    def fake_download(year):
        raise RuntimeError("network down (test)")

    monkeypatch.setattr(p, "start_run", fake_start)
    monkeypatch.setattr(p, "finish_run", fake_finish)
    monkeypatch.setattr(p, "is_chunk_succeeded", fake_is_succeeded)
    monkeypatch.setattr(p, "download_gastos", fake_download)

    with pytest.raises(RuntimeError, match="network down"):
        p.run_year(year=2026, resume=True, dry_run=False)

    # start_run WAS called (because skip was not taken), but the run failed
    # before finish_run — so no finished row exists for this id.
    assert len(started) == 1
