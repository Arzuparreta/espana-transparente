import copy
from decimal import Decimal
from pathlib import Path
import xml.etree.ElementTree as ET

import pytest

from contratacion.contratos import NS, parse_entry


def entry():
    return ET.parse(Path(__file__).parent/'fixtures'/'contratacion_entry.xml').getroot().find('atom:entry', NS)


def test_official_identity_not_internal_folder_number():
    first, second = entry(), entry()
    second.find('atom:id', NS).text = 'https://contrataciondelestado.es/sindicacion/licitacionesPerfilContratante/999999'
    a, b = parse_entry(first), parse_entry(second)
    assert a['contract_folder_id'] == b['contract_folder_id']
    assert a['source_id'] != b['source_id']


def test_every_result_preserved_without_first_result_as_total():
    source = entry(); status = source.find('cac_ext:ContractFolderStatus', NS)
    first = status.find('cac:TenderResult', NS)
    second = copy.deepcopy(first)
    awarded = ET.SubElement(second, '{'+NS['cac']+'}AwardedTenderedProject')
    monetary = ET.SubElement(awarded, '{'+NS['cac']+'}LegalMonetaryTotal')
    amount = ET.SubElement(monetary, '{'+NS['cbc']+'}TaxExclusiveAmount')
    amount.text = '0.0000'; amount.set('currencyID', 'USD')
    lot = ET.SubElement(awarded, '{'+NS['cbc']+'}ProcurementProjectLotID'); lot.text = 'LOT-2'
    status.append(second)
    record = parse_entry(source)
    assert record['award_amount'] is None
    assert record['contractor'] is None
    assert record['received_tender_quantity'] is None
    results = record['published_edition']['results']
    assert len(results) == 2
    assert results[1]['lot_id'] == 'LOT-2'
    assert results[1]['award_excluding_tax'] == {'value': '0.0000', 'currency': 'USD'}


def test_lot_budget_is_separate_from_parent_and_retains_all_cpv_codes():
    source = entry(); status = source.find('cac_ext:ContractFolderStatus', NS)
    lot = ET.SubElement(status, '{'+NS['cac']+'}ProcurementProjectLot')
    ET.SubElement(lot, '{'+NS['cbc']+'}ID').text = '1'
    project = copy.deepcopy(status.find('cac:ProcurementProject', NS))
    project.find('cac:BudgetAmount/cbc:TaxExclusiveAmount', NS).text = '123.4567'
    classification = ET.SubElement(project, '{'+NS['cac']+'}RequiredCommodityClassification')
    ET.SubElement(classification, '{'+NS['cbc']+'}ItemClassificationCode').text = '45000000'
    lot.append(project)
    record = parse_entry(source)
    assert record['amount'] == Decimal('125000.00')
    snapshot = record['published_edition']
    assert snapshot['lots'][0]['project']['budget_excluding_tax']['value'] == '123.4567'
    assert snapshot['lots'][0]['project']['cpv_codes'] == ['72000000', '45000000']


def test_xml_missing_currency_never_defaults_to_euro():
    source = entry()
    node = source.find('.//cac:BudgetAmount/cbc:TaxExclusiveAmount', NS)
    node.attrib.pop('currencyID', None)
    assert parse_entry(source)['currency'] is None
    node.set('currencyID', 'USD')
    assert parse_entry(source)['currency'] == 'USD'


@pytest.mark.parametrize('identity', ['', 'https://example.com/1', 'EXP-2025-001'])
def test_missing_or_untrusted_identity_fails_instead_of_overwriting(identity):
    source = entry(); source.find('atom:id', NS).text = identity
    with pytest.raises(ValueError, match='Atom identity'):
        parse_entry(source)


def test_timezone_and_original_decimal_precision():
    source = entry(); source.find('atom:updated', NS).text = '2026-10-12T15:49:36.249+02:00'
    amount = source.find('.//cac:BudgetAmount/cbc:TaxExclusiveAmount', NS); amount.text = '123.4567'
    record = parse_entry(source)
    assert record['source_updated_at'] == '2026-10-12T13:49:36.249000+00:00'
    assert record['amount'] == Decimal('123.4567')
    source.find('atom:updated', NS).text = '2026-10-12T13:49:36'
    with pytest.raises(ValueError, match='timezone'):
        parse_entry(source)


@pytest.mark.parametrize('amount', ['NaN', 'Infinity', '10000000000000'])
def test_unsafe_amounts_fail(amount):
    source = entry(); source.find('.//cac:BudgetAmount/cbc:TaxExclusiveAmount', NS).text = amount
    with pytest.raises(ValueError, match='monetary'):
        parse_entry(source)
