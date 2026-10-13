"""Meaningful identity and edition checks against a disposable PostgreSQL DB."""
import os
from pathlib import Path
import xml.etree.ElementTree as ET
import runpy

import psycopg2
import pytest

from contratacion.contratos import NS, parse_entry, upsert

URL = os.getenv('TEST_CONTRACT_DB_URL')
pytestmark = pytest.mark.skipif(not URL, reason='disposable contract PostgreSQL connection required')
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def conn(monkeypatch):
    connection = psycopg2.connect(URL)
    connection.set_client_encoding('UTF8')
    with connection.cursor() as cur:
        cur.execute('''CREATE TABLE IF NOT EXISTS public.contracts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_folder_id text UNIQUE,
          title text, awarding_body text, awarding_body_normalized text, amount numeric(15,2),
          status text, contract_type text, cpv_code text, region text, date date,
          ministry_normalized text, administration_level text, awarding_body_organization_id uuid,
          contractor_organization_id uuid, source_url text, contractor text, contractor_nif text,
          contractor_is_sme boolean, contractor_is_ute boolean, award_amount numeric(15,2),
          award_amount_with_taxes numeric(15,2), award_date date, contract_number text,
          received_tender_quantity integer, currency text DEFAULT 'EUR', updated_at timestamptz
        )''')
        cur.execute("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contracts' AND column_name='source_id'")
        if cur.fetchone() is None:
            cur.execute((ROOT/'supabase/migrations/20261012200000_contract_source_identity.sql').read_text())
        cur.execute('TRUNCATE public.contracts')
    connection.commit()
    monkeypatch.setattr('contratacion.contratos.upsert_organization', lambda *args, **kwargs: None)
    yield connection
    connection.rollback()
    connection.close()


def record(source=1234567, updated='2026-10-12T12:00:00Z', title='Latest edition'):
    source_entry = ET.parse(Path(__file__).parent/'fixtures/contratacion_entry.xml').getroot().find('atom:entry', NS)
    source_entry.find('atom:id', NS).text = f'https://contrataciondelestado.es/sindicacion/licitacionesPerfilContratante/{source}'
    source_entry.find('atom:updated', NS).text = updated
    source_entry.find('atom:title', NS).text = title
    return parse_entry(source_entry)


def test_same_folder_different_source_id_does_not_overwrite(conn):
    a, b = record(), record(999999)
    b['awarding_body'] = 'Otra administración'
    b['source_url'] = 'https://contrataciondelestado.es/wps/poc?uri=detalle&idEvl=other'
    assert upsert(conn, [a, b]) == 2
    with conn.cursor() as cur:
        cur.execute('SELECT count(*),count(DISTINCT source_id),count(DISTINCT contract_folder_id) FROM contracts')
        assert cur.fetchone() == (2, 2, 1)


def test_refresh_adopts_single_exact_source_without_changing_uuid(conn):
    row = record()
    with conn.cursor() as cur:
        cur.execute('INSERT INTO contracts(contract_folder_id,source_url,title) VALUES (%s,%s,%s) RETURNING id', (row['contract_folder_id'], row['source_url'], 'Legacy'))
        legacy_id = cur.fetchone()[0]
    conn.commit()
    upsert(conn, [row]); upsert(conn, [row])
    with conn.cursor() as cur:
        cur.execute('SELECT id,published_edition->>\'source_id\' FROM contracts')
        assert cur.fetchall() == [(legacy_id, row['source_id'])]


def test_ambiguous_legacy_identity_is_not_assigned_and_does_not_stop_ingestion(conn):
    from contratacion import contratos
    contratos.AMBIGUOUS_LEGACY_MATCHES.clear()
    row = record()
    with conn.cursor() as cur:
        cur.execute('INSERT INTO contracts(contract_folder_id,source_url) VALUES (%s,%s),(%s,%s)', ('one', row['source_url'], 'two', row['source_url']))
    conn.commit()
    assert upsert(conn, [row]) == 1
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM contracts WHERE source_id IS NULL AND contract_folder_id IN ('one','two')")
        assert cur.fetchone()[0] == 2
        cur.execute('SELECT count(*) FROM contracts WHERE source_id=%s', (row['source_id'],))
        assert cur.fetchone()[0] == 1
    assert contratos.AMBIGUOUS_LEGACY_MATCHES == [row['source_id']]


def test_older_feed_entry_cannot_replace_latest_revision(conn):
    newest, older = record(), record(updated='2026-10-11T12:00:00Z', title='Old version')
    assert upsert(conn, [newest]) == 1
    assert upsert(conn, [older]) == 0
    with conn.cursor() as cur:
        cur.execute('SELECT title FROM contracts')
        assert cur.fetchone()[0] == 'Latest edition'


def test_unknown_currency_and_source_precision_are_preserved(conn):
    row = record(); row['currency'] = None
    assert upsert(conn, [row]) == 1
    with conn.cursor() as cur:
        cur.execute('SELECT currency,published_edition->\'project\'->\'budget_excluding_tax\' FROM contracts')
        currency, amount = cur.fetchone()
        assert currency is None
        assert amount['value'] == '125000.00'


def test_invalid_edition_cannot_be_committed(conn):
    row = record(); row['published_edition'] = {}
    with pytest.raises(psycopg2.errors.CheckViolation):
        upsert(conn, [row])
    conn.rollback()
    with conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM contracts')
        assert cur.fetchone()[0] == 0


def test_review_backup_uses_source_identity_and_rejects_ambiguous_folder(conn):
    a, b = record(), record(999999)
    b['source_url'] = 'https://contrataciondelestado.es/wps/poc?uri=detalle&idEvl=other'
    upsert(conn, [a, b])
    backup = runpy.run_path(str(ROOT/'etl/scripts/critical_backup_state.py'))
    with conn.cursor() as cur:
        errors = []
        assert backup['optional_id'](cur, 'contracts', 'contract_folder_id', a['contract_folder_id'], 'old folder', errors) is None
        assert 'found 2' in errors[0]
        errors = []
        source_id = backup['optional_id'](cur, 'contracts', 'source_id', a['source_id'], 'source', errors)
        assert source_id is not None
        assert not errors
        assert backup['optional_id'](cur, 'contracts', 'source_url', a['source_url'], 'url', errors) == source_id
