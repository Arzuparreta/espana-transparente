from pathlib import Path
import json
import os
import pytest
from prtr.dus5000 import parse_program,parse_projects,amount_cents,persist
FIXTURES=Path(__file__).parent/'fixtures/prtr'
PROGRAM=(FIXTURES/'dus-program.html').read_text()
PROJECTS=(FIXTURES/'dus-projects.html').read_text()


def test_programme_reconciles_and_is_linked_to_mrr_list():
    allocations,total=parse_program(PROGRAM)
    assert len(allocations)==17 and sum(allocations.values())==total==67500000000
    for old,new in [('675.000.000,00','675.000.001,00'),('76.511.250,00','0'),('Mecanismo Europeo','Otro Mecanismo'),('codProcedimiento=D5000','codProcedimiento=OTHER')]:
        with pytest.raises(ValueError):parse_program(PROGRAM.replace(old,new))


def test_ids_dates_and_phases_from_official_row_extract_without_nif():
    rows=parse_projects(PROJECTS,'2026-10-12T00:00:00Z',minimum_rows=3)
    assert rows[0]['id']=='PR-D5000-2021-000035'
    assert rows[0]['grant_cents']==55735159
    assert rows[0]['last_resolution']=='2025-01-14'
    assert all('nif' not in r for r in rows)
    for old,new in [('PR-D5000-2021-000042','PR-D5000-2021-000035'),('Ayuda directa concedida(€)','Pagos(€)'),('14-01-2025','14-01-2027'),('COMUNIDAD DE MADRID','NOT A TERRITORY')]:
        with pytest.raises(ValueError):parse_projects(PROJECTS.replace(old,new),'2026-10-12T00:00:00Z',minimum_rows=3)
    with pytest.raises(ValueError):parse_projects(PROJECTS,'2026-10-12T00:00:00Z')


def test_zero_unknown_and_decimal_precision_are_distinct():
    assert amount_cents('0')==0
    assert amount_cents('37.144,2')==3714420
    assert amount_cents('',nullable=True) is None
    for v in ('NaN','-1','1.00','1,234'):
        with pytest.raises(ValueError):amount_cents(v)


@pytest.mark.skipif(not os.getenv('TEST_COFOG_DB_URL'),reason='disposable PostgreSQL integration only')
def test_idempotent_snapshot_public_read_no_write_and_rollback():
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    try:
        with conn.cursor() as cur:
            for role in ('anon','authenticated','service_role'):
                cur.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,))
                if not cur.fetchone():cur.execute(f'CREATE ROLE {role}')
            cur.execute('CREATE SCHEMA dus_test; SET search_path=dus_test,public; GRANT USAGE ON SCHEMA dus_test TO anon')
            sql=(Path(__file__).resolve().parents[2]/'supabase/migrations/20261012130000_prtr_dus5000.sql').read_text().split('INSERT INTO public.etl_runs')[0].replace('public.prtr_program_snapshot','dus_test.prtr_program_snapshot')
            cur.execute(sql);cur.execute('SELECT metadata FROM prtr_program_snapshot');snapshot=cur.fetchone()[0]
            assert snapshot['summary']==dict(records=1358,known_grant_cents=33690205836,unknown_amounts=0,zero_amounts=184,unknown_projects=106)
            assert all('nif' not in r for r in snapshot['rows'])
            persist(cur,snapshot);cur.execute('SELECT count(*),max(pg_column_size(metadata)) FROM prtr_program_snapshot');count,size=cur.fetchone();assert count==1 and size<5000000
            cur.execute('SAVEPOINT preserved')
            with pytest.raises(psycopg2.Error):persist(cur,{'version':'idae-dus5000-v1'})
            cur.execute('ROLLBACK TO SAVEPOINT preserved');cur.execute('SELECT metadata FROM prtr_program_snapshot');assert cur.fetchone()[0]==snapshot
            cur.execute('SET ROLE anon');cur.execute('SELECT count(*) FROM prtr_program_snapshot');assert cur.fetchone()[0]==1
            cur.execute('SAVEPOINT denied')
            with pytest.raises(psycopg2.Error):cur.execute('DELETE FROM prtr_program_snapshot')
            cur.execute('ROLLBACK TO SAVEPOINT denied')
    finally:conn.rollback();conn.close()
