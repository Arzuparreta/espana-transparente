from pathlib import Path
import pytest
from sanidad.espera import parse_report, revision_date, REPORT, NOTE

TEXT = (Path(__file__).parent/'fixtures/sanidad/surgery-page8.txt').read_text()

def test_official_territories_reconcile_and_correction():
    rows=parse_report(TEXT)
    assert len(rows)==20
    assert rows[-1]['patients']==853740
    assert rows[-1]['mean_days']==122
    assert next(r for r in rows if r['code']=='08')['patients']==36491
    assert sum(r['over_six_months'] for r in rows[:-1])==184748

@pytest.mark.parametrize('old,new',[
 ('DATOS A 31 DE DICIEMBRE DE 2025','DATOS A 30 DE JUNIO DE 2025'),
 ('853.740','853.509'), ('199.950','199.949'), ('32,2','132,2'),
 ('32,2           173','32,2           999'), ('199.950','-'), ('199.950','0'), ('64.302','264.302'),
])
def test_changed_period_unknowns_or_unreconciled_source_retains_snapshot(old,new):
    with pytest.raises(ValueError): parse_report(TEXT.replace(old,new))

def test_missing_or_duplicate_territory():
    line=next(l for l in TEXT.splitlines() if l.strip().startswith('ANDALUCÍA'))
    for value in (TEXT.replace(line,''),TEXT.replace(line,line+'\n'+line)):
        with pytest.raises(ValueError): parse_report(value)

def test_revision_requires_linked_corrected_edition():
    html=f'<p>Actualización de información a 24 de septiembre de 2026: Castilla-La Mancha</p><a href="{REPORT}">Informe</a><a href="{NOTE}">Nota</a>'
    assert revision_date(html)=='2026-09-24'
    with pytest.raises(ValueError): revision_date(html.replace(REPORT,REPORT.replace('_rectificado','')))

# Run against a disposable PostgreSQL; never the production URL.
import os
@pytest.mark.skipif(not os.getenv('TEST_COFOG_DB_URL'),reason='disposable PostgreSQL integration only')
def test_seed_idempotence_permissions_and_rejected_write_rollback():
    import psycopg2
    from sanidad.espera import persist
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    try:
        with conn.cursor() as cur:
            for role in ('anon','authenticated','service_role'):
                cur.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,))
                if not cur.fetchone():cur.execute(f'CREATE ROLE {role}')
            cur.execute('CREATE SCHEMA waiting_test; SET search_path=waiting_test,public; GRANT USAGE ON SCHEMA waiting_test TO anon')
            sql=(Path(__file__).resolve().parents[2]/'supabase/migrations/20261012120000_service_waiting.sql').read_text().replace('public.service_waiting_snapshot','waiting_test.service_waiting_snapshot')
            cur.execute(sql.split('INSERT INTO public.etl_runs')[0]);cur.execute('SELECT metadata FROM service_waiting_snapshot');original=cur.fetchone()[0]
            persist(cur,original);cur.execute('SELECT count(*),max(pg_column_size(metadata)) FROM service_waiting_snapshot')
            count,size=cur.fetchone();assert count==1 and size<100000
            cur.execute('SAVEPOINT unchanged')
            with pytest.raises(psycopg2.Error):persist(cur,{'version':'sisle-surgery-2025-v1'})
            cur.execute('ROLLBACK TO SAVEPOINT unchanged')
            cur.execute('SELECT metadata FROM service_waiting_snapshot');assert cur.fetchone()[0]==original
            cur.execute('SET ROLE anon');cur.execute('SELECT count(*) FROM service_waiting_snapshot');assert cur.fetchone()[0]==1
            cur.execute('SAVEPOINT denied')
            with pytest.raises(psycopg2.Error):cur.execute('DELETE FROM service_waiting_snapshot')
            cur.execute('ROLLBACK TO SAVEPOINT denied')
    finally:conn.rollback();conn.close()
