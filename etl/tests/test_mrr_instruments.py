import gzip
from pathlib import Path
import xml.etree.ElementTree as ET

import pytest

from prtr.instruments import build_snapshot, cents, START, END, persist, text

FIXTURES = Path(__file__).parent / 'fixtures'
ORIGINAL = gzip.decompress((FIXTURES / 'mrr-2024-13820.xml.gz').read_bytes())
AMENDMENT = gzip.decompress((FIXTURES / 'mrr-2026-977.xml.gz').read_bytes())


def altered(change):
    root = ET.fromstring(AMENDMENT)
    change(root)
    return ET.tostring(root, encoding='utf-8')


def revised_table(root):
    children = list(root.find('texto'))
    start = next(i for i, e in enumerate(children) if text(e) == START)
    return next(table for e in children[start+1:] for table in e.iter('table'))


def test_revised_stipulation_ignores_old_table_and_management_fees():
    snapshot = build_snapshot(ORIGINAL, AMENDMENT)
    green, firms = snapshot['facilities']
    assert green['total_cents'] == 30_000_000_000
    assert firms['total_cents'] == 60_000_000_000
    assert [r['cents'] for r in firms['annualities']] == [40_800_000_000, 0, 19_200_000_000]
    assert [r['cents'] for r in green['annualities']] == [30_000_000_000, 0, 0]
    assert snapshot['stage'] == 'commitments-to-ico'
    assert snapshot['effectiveness'] == 'registration-not-verified'
    assert len(snapshot['instruments']) == 4
    assert snapshot['signed'] == '2025-12-31'
    assert snapshot['sources']['amendment']['published'] == '2026-01-16'
    assert len(snapshot['sources']['original']['sha256']) == 64


def test_original_table_can_change_without_replacing_revised_values():
    data = altered(lambda root: setattr(root.find('texto/table/tbody/tr/td[2]'), 'text', '1,00'))
    assert build_snapshot(ORIGINAL, data)['facilities'][0]['total_cents'] == 30_000_000_000


def test_unreconciled_amount_rejected():
    data = altered(lambda root: setattr(revised_table(root).find('tbody/tr/td[2]'), 'text', '1,00'))
    with pytest.raises(ValueError, match='reconcile'):
        build_snapshot(ORIGINAL, data)


def test_changed_accounts_rejected():
    data = altered(lambda root: setattr(revised_table(root).find('thead/tr/th[2]'), 'text', '27.03.931M.359'))
    with pytest.raises(ValueError, match='accounts'):
        build_snapshot(ORIGINAL, data)


def test_missing_revised_section_never_falls_back_to_old_table():
    with pytest.raises(ValueError, match='stipulation'):
        build_snapshot(ORIGINAL, AMENDMENT.replace('Segunda.\u2003Modificación estipulación decimosexta del convenio.'.encode(), b'Segunda. Otra estipulacion.'))


def test_duplicate_annuality_rejected():
    data = altered(lambda root: setattr(revised_table(root).findall('tbody/tr')[1][0], 'text', '2024'))
    with pytest.raises(ValueError, match='annualities'):
        build_snapshot(ORIGINAL, data)


@pytest.mark.parametrize('before,after', [(b'20260116', b'20260117'), (b'BOE-A-2026-977', b'BOE-A-2026-978')])
def test_wrong_source_edition_rejected(before, after):
    with pytest.raises(ValueError):
        build_snapshot(ORIGINAL, AMENDMENT.replace(before, after))


@pytest.mark.parametrize('value', ['1,001', '-1,00', '1.00', '90071992547410,00'])
def test_money_precision_and_range(value):
    with pytest.raises(ValueError):
        cents(value)


def test_missing_instrument_evidence_rejected():
    with pytest.raises(ValueError, match='instrument'):
        build_snapshot(ORIGINAL.replace(b'4.\xe2\x80\x83Inversiones', b'5.\xe2\x80\x83Inversiones'), AMENDMENT)


def test_unsafe_xml_rejected():
    with pytest.raises(ValueError, match='unsafe'):
        build_snapshot(b'<!DOCTYPE document>'+ORIGINAL, AMENDMENT)


def test_atomic_upsert_keeps_single_edition():
    class Cursor:
        def execute(self, sql, args):
            self.sql, self.args = sql, args
    cursor = Cursor()
    persist(cursor, build_snapshot(ORIGINAL, AMENDMENT))
    assert 'ON CONFLICT(scope) DO UPDATE' in cursor.sql
    assert len(cursor.args) == 1
