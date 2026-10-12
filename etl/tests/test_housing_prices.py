import copy,json,os
from pathlib import Path
import pytest
from ine.vivienda import decode,save

def fixture():return json.loads((Path(__file__).parent/'fixtures/ipv_tables.json').read_text())

def test_official_rates_and_territory_scope():
    s=decode(fixture());assert len(s['rows'])==1456 and len(s['missing'])==4
    r=next(r for r in s['rows'] if r['period']=='2026-Q2' and r['territory']=='00' and r['kind']=='general')
    assert r['annual']==12.2 and r['quarterly']==3.4 and r['index']==111.095
    assert all(r['kind']=='general' for r in s['rows'] if r['territory'] in ('18','19'))

@pytest.mark.parametrize('mutation',['base','units','empty','hole','rate','duplicate','dimensions','city'])
def test_source_changes_fail_closed(mutation):
    p=fixture()
    if mutation=='base':next(x for x in p[0]['Data'] if x['Anyo']==2025)['Valor']+=1
    if mutation=='units':p[0]['FK_Unidad']=1
    if mutation=='empty':p[0]['Data']=[]
    if mutation=='hole':p[0]['Data'].pop(0)
    if mutation=='rate':p[1]['Data'][0]['Valor']+=1
    if mutation=='duplicate':p[0]['Data'].append(copy.deepcopy(p[0]['Data'][0]))
    if mutation=='dimensions':p[0]['COD']='IPVOTHER'
    if mutation=='city':next(x for x in p if x['Nombre'].strip()=='Ceuta. Vivienda nueva. Índice.')['Data']=[copy.deepcopy(p[0]['Data'][0])]
    with pytest.raises(ValueError):decode(p)

@pytest.mark.skipif(not os.getenv('TEST_COFOG_DB_URL'),reason='isolated PostgreSQL only')
def test_snapshot_migration_upserts_rollback_and_permissions():
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    try:
        with conn.cursor() as c:
            c.execute('DROP TABLE IF EXISTS housing_price_snapshot')
            c.execute((Path(__file__).resolve().parents[2]/'supabase/migrations/20261012070000_housing_prices.sql').read_text())
            c.execute('SELECT metadata FROM housing_price_snapshot');s=c.fetchone()[0]
            save(c,s);save(c,s)
        conn.commit()
        bad=copy.deepcopy(s);bad['version']='wrong'
        with pytest.raises(ValueError):
            with conn.cursor() as c:save(c,bad)
        conn.rollback()
        with conn.cursor() as c:
            c.execute('SET LOCAL ROLE anon');c.execute('SELECT metadata FROM housing_price_snapshot');assert len(c.fetchone()[0]['rows'])==1456
            c.execute("SELECT pg_total_relation_size('housing_price_snapshot')");assert c.fetchone()[0]<1000000
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as c:c.execute('DELETE FROM housing_price_snapshot')
        conn.rollback()
    finally:conn.close()
