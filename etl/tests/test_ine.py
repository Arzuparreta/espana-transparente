"""Smoke tests for ine.indicadores (offline — no network)."""

import json
from pathlib import Path

from ine.indicadores import INDICATORS, parse_period

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture() -> list[dict]:
    return json.loads((FIXTURES / "ine_ipc_response.json").read_text())


def test_indicators_dict_has_expected_codes():
    assert "IPC290751" in INDICATORS
    assert "IPC290752" in INDICATORS
    assert "IPC290750" in INDICATORS


def test_indicators_have_required_fields():
    for key, meta in INDICATORS.items():
        assert "code" in meta, f"{key} missing 'code'"
        assert "name" in meta, f"{key} missing 'name'"
        assert "url" in meta, f"{key} missing 'url'"
        assert "metadata_url" in meta, f"{key} missing 'metadata_url'"
        assert meta["url"].startswith("https://"), f"{key} url should be https"


def test_fixture_series_lookup_by_cod():
    data = _load_fixture()
    series = next((s for s in data if s.get("COD") == "IPC290751"), None)
    assert series is not None
    assert len(series["Data"]) > 0


def test_fixture_data_points_have_expected_shape():
    data = _load_fixture()
    series = next(s for s in data if s["COD"] == "IPC290752")
    point = series["Data"][0]
    assert "Anyo" in point
    assert "T3_Periodo" in point
    assert "Valor" in point
    assert isinstance(point["Valor"], (int, float))


def test_parse_period_supports_current_ine_period_shape():
    assert parse_period({"Anyo": 2026, "T3_Periodo": "M04"}) == "2026-04"


def test_parse_period_supports_legacy_ine_period_shape():
    assert parse_period({"Anyo": 2025, "FK_Periodo": 1}) == "2025-01"
