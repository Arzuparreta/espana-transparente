"""Smoke tests for bdns.subvenciones parser (offline — no network)."""

import json
from pathlib import Path

from bdns.subvenciones import _is_organization, parse_record

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture() -> list[dict]:
    data = json.loads((FIXTURES / "bdns_response.json").read_text())
    return data["content"]


def test_is_organization_accepts_named_entity():
    assert _is_organization("UNIVERSIDAD COMPLUTENSE DE MADRID") is True


def test_is_organization_rejects_anonymized():
    assert _is_organization("* (datos personales protegidos)") is False


def test_is_organization_rejects_none():
    assert _is_organization(None) is False


def test_parse_record_returns_dict_for_org():
    raw = _load_fixture()[0]
    record = parse_record(raw, importe_min=0)
    assert record is not None
    assert record["bdns_id"] == 12345
    assert record["beneficiario"] == "UNIVERSIDAD COMPLUTENSE DE MADRID"
    assert record["nivel1"] == "ESTADO"
    assert record["administration_level"] == "state"
    assert record["ministry_normalized"] is not None


def test_parse_record_returns_none_for_individual():
    raw = _load_fixture()[1]
    record = parse_record(raw, importe_min=0)
    assert record is None


def test_parse_record_filters_by_importe_min():
    raw = _load_fixture()[0]
    record = parse_record(raw, importe_min=100_000)
    assert record is None


def test_parse_record_date_format():
    raw = _load_fixture()[0]
    record = parse_record(raw, importe_min=0)
    assert record["fecha_concesion"] == "15/01/2025"
