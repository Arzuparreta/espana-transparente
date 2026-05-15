"""Smoke tests for contratacion.contratos parser (offline — no network)."""

import xml.etree.ElementTree as ET
from pathlib import Path

from contratacion.contratos import NS, CONTRACT_TYPES, parse_entry, _text, _decimal

FIXTURES = Path(__file__).parent / "fixtures"


def _load_entry() -> ET.Element:
    tree = ET.parse(FIXTURES / "contratacion_entry.xml")
    root = tree.getroot()
    return root.find("atom:entry", NS)


def test_parse_entry_extracts_title():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record is not None
    assert record["title"] == "Contrato de servicios de consultoría tecnológica"


def test_parse_entry_extracts_contracting_authority():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record["awarding_body"] == "Ministerio de Hacienda"


def test_parse_entry_extracts_amount():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record["amount"] == 125000.00


def test_parse_entry_extracts_contract_folder_id():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record["contract_folder_id"] == "EXP-2025-001"


def test_parse_entry_maps_contract_type():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record["contract_type"] == "Servicios"


def test_parse_entry_extracts_cpv():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record["cpv_code"] == "72000000"


def test_parse_entry_extracts_region():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record["region"] == "ES30"


def test_parse_entry_normalizes_awarding_body():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record["awarding_body_normalized"] is not None
    assert "HACIENDA" in record["awarding_body_normalized"]


def test_contract_types_map_coverage():
    assert "1" in CONTRACT_TYPES
    assert "2" in CONTRACT_TYPES
    assert CONTRACT_TYPES["1"] == "Obras"
