import copy
import json
import os
from datetime import datetime, timezone, timedelta
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock

import openpyxl
import pytest
from presupuestos.financiacion import parse_workbook, save, SOURCE, VERSION
from presupuestos import financiacion

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


@pytest.fixture
def financing_payload(tmp_path, monkeypatch):
    monkeypatch.setattr(financiacion, 'fetch_workbook', lambda: FIXTURE.read_bytes())
    financiacion.export_payload(tmp_path)
    return tmp_path


def test_offline_payload_revalidates_the_original_workbook(financing_payload, monkeypatch):
    def forbidden():
        pytest.fail('Offline financing payload attempted HTTP')
    monkeypatch.setattr(financiacion, 'fetch_workbook', forbidden)
    snapshot = financiacion.load_payload(financing_payload)
    assert len(snapshot['records']) == 17
    assert snapshot['source_url'] == SOURCE
    manifest = json.loads((financing_payload / 'manifest.json').read_text())
    assert snapshot['retrieved_at'] == manifest['fetched_at']
    assert snapshot['workbook_sha256'] == manifest['sha256']
    financiacion.run(dry_run=True, from_directory=financing_payload)


@pytest.mark.parametrize('change', ['stale', 'future', 'source', 'checksum', 'version'])
def test_financing_payload_rejects_untrusted_or_old_data(financing_payload, change):
    manifest_path = financing_payload / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    if change in ('stale', 'future'):
        manifest['fetched_at'] = (datetime.now(timezone.utc) + timedelta(
            days=-3 if change == 'stale' else 1)).isoformat()
    elif change == 'source':
        manifest['source_url'] = 'https://example.org/workbook.xlsx'
    elif change == 'checksum':
        (financing_payload / 'workbook.xlsx').write_bytes(b'changed')
    else:
        manifest['version'] = 2
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        financiacion.load_payload(financing_payload)


def test_failed_financing_export_removes_the_previous_manifest(financing_payload, monkeypatch):
    monkeypatch.setattr(financiacion, 'fetch_workbook', Mock(side_effect=TimeoutError('blocked')))
    with pytest.raises(TimeoutError):
        financiacion.export_payload(financing_payload)
    assert not (financing_payload / 'manifest.json').exists()


def test_financing_export_requires_reconciled_workbook(tmp_path, monkeypatch):
    workbook = openpyxl.load_workbook(FIXTURE)
    workbook['3. Liquidación definitiva']['B5'] = 999
    data = BytesIO()
    workbook.save(data)
    monkeypatch.setattr(financiacion, 'fetch_workbook', lambda: data.getvalue())
    with pytest.raises(ValueError, match='reconciliation'):
        financiacion.export_payload(tmp_path)
    assert not (tmp_path / 'manifest.json').exists()


def test_financing_source_failure_is_recorded_without_replacing_snapshot(monkeypatch):
    from common import db, etl_runs
    conn = Mock()
    conn.cursor.return_value.__enter__ = Mock(return_value=Mock())
    conn.cursor.return_value.__exit__ = Mock(return_value=False)
    finish = Mock()
    save_snapshot = Mock()
    monkeypatch.setattr(db, 'get_pg_conn', lambda: conn)
    monkeypatch.setattr(etl_runs, 'start_run', Mock(return_value='run-1'))
    monkeypatch.setattr(etl_runs, 'finish_run', finish)
    monkeypatch.setattr(financiacion, 'save', save_snapshot)
    monkeypatch.setattr(financiacion, 'fetch_snapshot', Mock(side_effect=TimeoutError('blocked')))
    with pytest.raises(TimeoutError):
        financiacion.run()
    assert finish.call_args.kwargs == dict(run_id='run-1', status='failed', error_summary='blocked')
    save_snapshot.assert_not_called()
    conn.close.assert_called_once()


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
