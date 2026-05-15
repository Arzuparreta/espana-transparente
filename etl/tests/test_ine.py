"""Smoke tests for ine.indicadores (offline — no network)."""

import json
from pathlib import Path

from ine.indicadores import INDICATORS

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture() -> list[dict]:
    return json.loads((FIXTURES / "ine_ipc_response.json").read_text())


def test_indicators_dict_has_expected_codes():
    assert "IPC251852" in INDICATORS
    assert "IPC251855" in INDICATORS


def test_indicators_have_required_fields():
    for key, meta in INDICATORS.items():
        assert "code" in meta, f"{key} missing 'code'"
        assert "name" in meta, f"{key} missing 'name'"
        assert "url" in meta, f"{key} missing 'url'"
        assert "filter_cod" in meta, f"{key} missing 'filter_cod'"
        assert meta["url"].startswith("https://"), f"{key} url should be https"


def test_fixture_series_lookup_by_cod():
    data = _load_fixture()
    series = next((s for s in data if s.get("COD") == "IPC251852"), None)
    assert series is not None
    assert len(series["Data"]) > 0


def test_fixture_data_points_have_expected_shape():
    data = _load_fixture()
    series = next(s for s in data if s["COD"] == "IPC251852")
    point = series["Data"][0]
    assert "Anyo" in point
    assert "FK_Periodo" in point
    assert "Valor" in point
    assert isinstance(point["Valor"], (int, float))


def test_period_str_format():
    # Verify that the period_str format (year-period) would be correct
    year = 2025
    period = 1
    period_str = f"{year}-{period:02d}"
    assert period_str == "2025-01"
