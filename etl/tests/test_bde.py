"""Smoke tests for ine.bde (offline — no network)."""

import json
from pathlib import Path

from ine.bde import EUROSTAT_URL, build_raw_data, parse_deuda_records

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture() -> dict:
    return json.loads((FIXTURES / "bde_response.json").read_text())


def test_eurostat_url_is_set():
    assert EUROSTAT_URL.startswith("https://ec.europa.eu/eurostat")
    assert "gov_10dd_edpt1" in EUROSTAT_URL
    assert "geo=ES" in EUROSTAT_URL


def test_fixture_parses_records():
    data = _load_fixture()
    records = parse_deuda_records(data)
    assert len(records) == 5


def test_fixture_records_have_correct_shape():
    data = _load_fixture()
    records = parse_deuda_records(data)
    period, value = records[0]
    assert isinstance(period, str)
    assert isinstance(value, float)
    assert value > 0


def test_fixture_records_sorted_by_period():
    data = _load_fixture()
    records = parse_deuda_records(data)
    periods = [r[0] for r in records]
    assert periods == sorted(periods)


def test_fixture_latest_value():
    data = _load_fixture()
    records = parse_deuda_records(data)
    _, latest_value = records[-1]
    assert latest_value == 1698224.6


def test_fixture_earliest_year():
    data = _load_fixture()
    records = parse_deuda_records(data)
    earliest_period, _ = records[0]
    assert earliest_period == "2021"


def test_raw_data_source_is_eurostat():
    # Attribution rule from docs/designs/2026-06-10-la-cadena.md: debt rows
    # cite Eurostat (Maastricht criterion), never "BdE".
    raw = build_raw_data("2024", 1_698_224.6)
    assert raw["source"] == "Eurostat"
    assert raw["period"] == "2024"
    assert raw["value"] == 1_698_224.6


def test_parse_ignores_null_values():
    data = {
        "value": {"0": 1500000.0, "1": None, "2": 1600000.0},
        "dimension": {
            "time": {
                "category": {
                    "index": {"2022": 0, "2023": 1, "2024": 2}
                }
            }
        },
    }
    records = parse_deuda_records(data)
    assert len(records) == 2
    assert records[0][0] == "2022"
    assert records[1][0] == "2024"
