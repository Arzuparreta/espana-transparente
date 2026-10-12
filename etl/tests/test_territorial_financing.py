import copy
import json
import os
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock

import openpyxl
import pytest
from presupuestos.financiacion import parse_workbook, save, SOURCE, VERSION

FIXTURE = Path(__file__).parent/'fixtures/financing-2024.xlsx'


def test_official_table_balances_details_and_territorial_totals():
    s = parse_workbook(FIXTURE.read_bytes())
    assert len(s['records']) == 17 and s['source_url'] == SOURCE
    assert s['totals']['Total General']['total'] == pytest.approx(13315692.85249)
    assert s['totals']['Total CC.AA.']['total'] == pytest.approx(13287804.43249)
    canarias = next(r for r in s['records'] if r['territory'] == '05')
    assert canarias['balances']['iva'] == 0 and canarias['details']['iva'] is None
    asturias = next(r for r in s['records'] if r['territory'] == '03')
    assert asturias['balances']['irpf'] < 0
    assert not {'14', '15'} & {r['territory'] for r in s['records']}
    ceuta = next(r for r in s['records'] if r['territory'] == '18')
    assert set(ceuta['details']) == {'sufficiency'}


@pytest.mark.parametrize('sheet,cell,wrong', [
    ('3. Liquidación definitiva','B5',999),
    ('3. Liquidación definitiva','A5','Navarra'),
    ('3. Liquidación definitiva','A6','Cataluña'),
    ('3. Liquidación definitiva','A3','Euros'),
    ('3. Liquidación definitiva','A2','Liquidación 2023'),
    ('3. Liquidación definitiva','J26',999),
    ('1.1.2. IRPF','C5',None),
    ('1.1.2. IRPF','B5',999),
    ('1.1.2. IRPF','B20',999),
    ('1.2. IVA','E17',0),
])
def test_rejects_mixed_scope_duplicate_missing_or_unreconciled_data(sheet,cell,wrong):
    w=openpyxl.load_workbook(FIXTURE); w[sheet][cell]=wrong
    b=BytesIO();w.save(b)
    with pytest.raises(ValueError):parse_workbook(b.getvalue())


def test_partial_selection_never_replaces_previous_snapshot():
    cur=Mock();s=parse_workbook(FIXTURE.read_bytes());s['records'].pop()
    with pytest.raises(ValueError):save(cur,s)
    cur.execute.assert_not_called()


def test_seed_atomic_recovery_and_public_permissions():
    if not os.getenv('TEST_COFOG_DB_URL'):pytest.skip('isolated PostgreSQL only')
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    try:
        with conn.cursor() as cur:
            cur.execute('DROP TABLE IF EXISTS territorial_financing_snapshot')
            cur.execute((Path(__file__).resolve().parents[2]/'supabase/migrations/20261012090000_territorial_financing.sql').read_text())
            cur.execute('SELECT metadata FROM territorial_financing_snapshot');s=cur.fetchone()[0]
            assert len(s['records'])==17
            save(cur,s);save(cur,s)
        conn.commit()
        bad=copy.deepcopy(s);bad['records'].pop()
        with pytest.raises(ValueError):
            with conn.cursor() as cur:save(cur,bad)
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute('SET LOCAL ROLE anon');cur.execute('SELECT metadata FROM territorial_financing_snapshot');assert len(cur.fetchone()[0]['records'])==17
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur:cur.execute('DELETE FROM territorial_financing_snapshot')
        conn.rollback()
    finally:conn.close()
