"""Smoke tests for contratacion.contratos parser (offline — no network)."""

import xml.etree.ElementTree as ET
from pathlib import Path
from types import SimpleNamespace

from contratacion.contratos import (
    CONTRACT_TYPES,
    NS,
    _decimal,
    _text,
    download_feed_page,
    parse_entry,
)

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


def test_parse_entry_extracts_contractor():
    entry = _load_entry()
    record = parse_entry(entry)
    assert record["contractor"] == "Empresa Adjudicataria S.L."


def test_parse_entry_contractor_none_when_no_tender_result():
    # Entry without TenderResult should have contractor=None
    import xml.etree.ElementTree as ET
    xml_no_award = """<feed xmlns="http://www.w3.org/2005/Atom"
          xmlns:cbc="urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2"
          xmlns:cac="urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2"
          xmlns:cac_ext="urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonAggregateComponents-2"
          xmlns:cbc_ext="urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonBasicComponents-2">
      <entry>
        <title>Contrato sin adjudicar</title>
        <link href="https://example.com/123"/>
        <updated>2025-03-15T10:00:00Z</updated>
        <cac_ext:ContractFolderStatus>
          <cbc:ContractFolderID>EXP-2025-002</cbc:ContractFolderID>
          <cbc_ext:ContractFolderStatusCode>PUB</cbc_ext:ContractFolderStatusCode>
          <cac:ProcurementProject>
            <cbc:TypeCode>1</cbc:TypeCode>
            <cac:BudgetAmount><cbc:TaxExclusiveAmount>50000.00</cbc:TaxExclusiveAmount></cac:BudgetAmount>
          </cac:ProcurementProject>
        </cac_ext:ContractFolderStatus>
      </entry>
    </feed>"""
    from contratacion.contratos import NS as _NS
    root = ET.fromstring(xml_no_award)
    entry = root.find("atom:entry", _NS)
    record = parse_entry(entry)
    assert record is not None
    assert record["contractor"] is None


def test_contract_types_map_coverage():
    assert "1" in CONTRACT_TYPES
    assert "2" in CONTRACT_TYPES
    assert CONTRACT_TYPES["1"] == "Obras"


def test_download_feed_page_retries_transient_failures(monkeypatch):
    output = b"<feed />"

    def fake_run(command, **kwargs):
        output_path = Path(command[command.index("-o") + 1])
        output_path.write_bytes(output)
        assert command[command.index("--retry") + 1] == "4"
        assert "--retry-all-errors" in command
        assert "--fail-with-body" in command
        return SimpleNamespace(returncode=0, stderr=b"")

    monkeypatch.setattr("contratacion.contratos.subprocess.run", fake_run)

    assert download_feed_page("https://example.test/feed.atom") == output
