"""Purchase summary semantics against a disposable PostgreSQL DB."""
import json
import os
from pathlib import Path

import psycopg2
import pytest

from contratacion.resumen import refresh

URL = os.getenv('TEST_CONTRACT_DB_URL')
pytestmark = pytest.mark.skipif(not URL, reason='disposable contract PostgreSQL connection required')
ROOT = Path(__file__).resolve().parents[2]
SOURCE = 'https://contrataciondelestado.es/sindicacion/licitacionesPerfilContratante/'


@pytest.fixture
def cur():
    connection = psycopg2.connect(URL)
    with connection.cursor() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS public.contracts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_folder_id text UNIQUE,
          title text, awarding_body text, awarding_body_normalized text, amount numeric(15,2),
          status text, contract_type text, cpv_code text, region text, date date,
          ministry_normalized text, administration_level text, awarding_body_organization_id uuid,
          contractor_organization_id uuid, source_url text, contractor text, contractor_nif text,
          contractor_is_sme boolean, contractor_is_ute boolean, award_amount numeric(15,2),
          award_amount_with_taxes numeric(15,2), award_date date, contract_number text,
          received_tender_quantity integer, currency text DEFAULT 'EUR', updated_at timestamptz
        )''')
        c.execute("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contracts' AND column_name='source_id'")
        if c.fetchone() is None:
            c.execute((ROOT/'supabase/migrations/20261012200000_contract_source_identity.sql').read_text())
        for role in ('anon', 'authenticated', 'service_role'):
            c.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', (role,))
            if c.fetchone() is None:
                c.execute(f'CREATE ROLE {role}')
        c.execute("SELECT to_regclass('public.contract_purchase_summary')")
        if c.fetchone()[0] is None:
            c.execute((ROOT/'supabase/migrations/20261013000000_contract_purchase_summary.sql').read_text())
        c.execute('TRUNCATE public.contracts')
        yield c
    connection.rollback()
    connection.close()


def legacy(cur, folder, *, award_date='2025-03-01', offers=1, amount=1000, cpv='45000000', level='state',
           status='ADJ', contractor='Empresa', body='Órgano', currency='EUR'):
    cur.execute('''INSERT INTO contracts (contract_folder_id, awarding_body, amount, currency, status, cpv_code,
        administration_level, contractor, award_date, received_tender_quantity)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
        (folder, body, amount, currency, status, cpv, level, contractor, award_date, offers))


def verified(cur, source, folder, results, *, amount=5000, cpv='72000000', level='municipal', body='Órgano'):
    edition = dict(version='pcsp-published-edition-v1', source_id=SOURCE+str(source), lots=[], results=results)
    cur.execute('''INSERT INTO contracts (contract_folder_id, awarding_body, amount, currency, status, cpv_code,
        administration_level, source_id, published_edition) VALUES (%s,%s,%s,'EUR','RES',%s,%s,%s,%s)''',
        (folder, body, amount, cpv, level, SOURCE+str(source), json.dumps(edition)))


def result(date, offers, contractor='Adjudicataria', amount='10'):
    return dict(award_date=date, received_tenders=offers, contractor=contractor,
                award_excluding_tax=dict(value=amount, currency='EUR'))


def rows(cur):
    cur.execute('''SELECT award_year, administration_level, cpv_division, expedientes, expedientes_verified, budget_eur,
        budget_missing, results, results_legacy, results_one_offer, results_two_to_four, results_five_plus,
        results_offers_unknown FROM contract_purchase_summary ORDER BY 1,2,3''')
    return cur.fetchall()


def test_verified_lots_count_each_result_but_one_expediente(cur):
    verified(cur, 1, 'A', [result('2025-02-01', 1), result('2025-05-01+02:00', 7), result('2025-06-01', None)])
    refresh(cur)
    assert rows(cur) == [(2025, 'municipal', '72', 1, 1, 5000, 0, 3, 0, 1, 0, 1, 1)]


def test_expediente_year_is_first_award_while_results_keep_their_own_year(cur):
    verified(cur, 1, 'A', [result('2024-12-20', 3), result('2025-01-10', 2)])
    refresh(cur)
    assert [(r[0], r[3], r[7]) for r in rows(cur)] == [(2024, 1, 1), (2025, 0, 1)]


def test_legacy_superseded_by_verified_edition_is_not_double_counted(cur):
    legacy(cur, 'A', level='municipal', cpv='72000000')
    verified(cur, 1, 'A', [result('2025-02-01', 2)])
    refresh(cur)
    assert [(r[3], r[7], r[8]) for r in rows(cur)] == [(1, 1, 0)]
    cur.execute('SELECT superseded_legacy_excluded FROM contract_purchase_coverage')
    assert cur.fetchone() == (1,)


def test_same_folder_in_other_body_is_a_different_expediente(cur):
    legacy(cur, 'A', body='Otro órgano', level='municipal', cpv='72000000')
    verified(cur, 1, 'A', [result('2025-02-01', 2)])
    refresh(cur)
    assert [(r[3], r[8]) for r in rows(cur)] == [(2, 1)]


def test_exclusions_are_counted_not_summarised(cur):
    legacy(cur, 'annulled', status='ANUL')
    legacy(cur, 'no-award', contractor=None)
    legacy(cur, 'bad-date', award_date='0001-01-03')
    legacy(cur, 'future', award_date='2099-01-01')
    legacy(cur, 'ok')
    refresh(cur)
    assert [(r[0], r[3]) for r in rows(cur)] == [(2025, 1)]
    cur.execute('SELECT source_rows, annulled_excluded, without_award_evidence, invalid_award_date FROM contract_purchase_coverage')
    assert cur.fetchone() == (5, 1, 1, 2)


def test_unknown_currency_and_missing_budget_are_not_added_as_euros(cur):
    legacy(cur, 'usd', currency='USD', amount=99)
    legacy(cur, 'none', amount=None)
    legacy(cur, 'eur', amount=10)
    refresh(cur)
    assert [(r[3], r[5], r[6]) for r in rows(cur)] == [(3, 10, 2)]


def test_offer_buckets_and_unknown_dimensions(cur):
    for folder, offers in (('a', 1), ('b', 4), ('c', 5), ('d', None), ('e', 0)):
        legacy(cur, folder, offers=offers, cpv=None, level=None)
    refresh(cur)
    assert rows(cur) == [(2025, 'unknown', 'none', 5, 0, 5000, 0, 5, 5, 1, 1, 1, 2)]


def test_refresh_replaces_previous_summary(cur):
    legacy(cur, 'a')
    refresh(cur)
    cur.execute('TRUNCATE contracts')
    legacy(cur, 'b', award_date='2024-01-01')
    refresh(cur)
    assert [r[0] for r in rows(cur)] == [2024]
