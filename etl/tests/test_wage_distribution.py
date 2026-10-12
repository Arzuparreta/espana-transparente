import copy,json,os
from pathlib import Path
import pytest
from ine.salarios_distribucion import decode,save

def fixture():return json.loads((Path(__file__).parent/'fixtures/wage_tables.json').read_text())

def test_official_distribution_reconciles_real_counts_not_equal_decile_means():
    s=decode(fixture());assert len(s['years'])==4
    y=s['years'][-1];assert y['year']==2024 and y['mean']==2385.6
    assert y['bands'][0]['lower'] is None and y['bands'][5]['lower']==2001.4
    assert abs(sum(b['mean'] for b in y['bands'])/10-y['mean'])>.4
    assert s['years'][0]['mean']==2076.5 # current population base 2021, not historical press edition

@pytest.mark.parametrize('mutation',['unit','duplicate','missingyear','suppressed','null','boundary','count','revision'])
def test_incomplete_or_inconsistent_sources_are_rejected(mutation):
    p=fixture()
    if mutation=='unit':p['66237'][0]['FK_Unidad']=3
    if mutation=='duplicate':p['66237'].append(copy.deepcopy(p['66237'][0]))
    if mutation=='missingyear':p['66237'][0]['Data'].pop()
    if mutation=='suppressed':p['66237'][0]['Data'][0]['Secreto']=True
    if mutation=='null':p['66252'][1]['Data'][0]['Valor']=None
    if mutation=='boundary':p['66252'][2]['Data'][0]['Valor']=600
    if mutation=='count':p['66199'][2]['Data'][0]['Valor']=1
    if mutation=='revision':p['66237'][1]['Data'][0]['Valor']+=1
    with pytest.raises((ValueError,KeyError)):decode(p)

@pytest.mark.skipif(not os.getenv('TEST_COFOG_DB_URL'),reason='isolated PostgreSQL only')
def test_migration_idempotence_rollback_and_public_permissions():
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    try:
        with conn.cursor() as c:
            c.execute('DROP TABLE IF EXISTS wage_distribution_snapshot')
            c.execute((Path(__file__).resolve().parents[2]/'supabase/migrations/20261012060000_wage_distribution.sql').read_text())
            c.execute('SELECT metadata FROM wage_distribution_snapshot');s=c.fetchone()[0]
            for _ in range(2):save(c,s)
        conn.commit()
        bad=copy.deepcopy(s);bad['version']='wrong'
        with pytest.raises(ValueError):
            with conn.cursor() as c:save(c,bad)
        conn.rollback()
        with conn.cursor() as c:
            c.execute('SET LOCAL ROLE anon');c.execute('SELECT metadata FROM wage_distribution_snapshot');assert c.fetchone()[0]['years'][-1]['mean']==2385.6
            c.execute("SELECT pg_total_relation_size('wage_distribution_snapshot')");assert c.fetchone()[0]<150000
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as c:c.execute('DELETE FROM wage_distribution_snapshot')
        conn.rollback()
    finally:conn.close()
