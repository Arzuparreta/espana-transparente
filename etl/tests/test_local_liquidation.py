import copy,gzip,json,os
from pathlib import Path
from unittest.mock import Mock
import pytest
from presupuestos.local import parse_snapshot,save
FIXTURE=Path(__file__).parent/'fixtures/local-canarias-2024.json.gz'

def source():return gzip.decompress(FIXTURE.read_bytes())

def test_official_scope_stages_units_and_unavailable_totals():
    s=parse_snapshot(source())
    assert len(s['records'])==88 and s['missing_cells']==43 and s['complete_comparisons']==85 and s['reconciled_checks']==991
    arrecife=next(r for r in s['records'] if r['territory']=='35004')
    assert arrecife['rows']['NF']==[65579528.62,160482415.25,78828678.06,67490118.39]
    assert next(r for r in s['records'] if r['territory']=='35023')['rows']['NF'][1:] == [None,None,None]
    assert next(r for r in s['records'] if r['territory']=='38013_2007')['name']=='Frontera'
    assert all(not r['territory'].startswith('ES') for r in s['records'])

@pytest.mark.parametrize('wrong',['unit','year','version','labels','status','order','reconciliation'])
def test_rejects_changed_semantics_or_inconsistent_values(wrong):
    s=json.loads(source())
    if wrong=='unit':
        d=next(d for d in s['metadata']['dimensions']['dimension'] if d['id']=='MEDIDAS')
        d['dimensionValues']['value'][0]['measureQuantity']['unitCode']['id']='MILES_EUR'
    if wrong=='year':s['id']='E31025B_000017'
    if wrong=='version':s['metadata']['version']='2.0'
    if wrong=='labels':s['metadata']['dimensions']['dimension'][1]['dimensionValues']['value'][1]['id']='28079'
    if wrong=='order':s['data']['dimensions']['dimension'].reverse()
    if wrong=='status':s['data']['attributes']['attribute'][0]['value']='X'+s['data']['attributes']['attribute'][0]['value'][1:]
    if wrong=='reconciliation':
        dims={d['dimensionId']:{r['code']:r['index'] for r in d['representations']['representation']} for d in s['data']['dimensions']['dimension']}
        i=dims['TERRITORIO']['35004']*2304+dims['PRESUPUESTO_ESTADO']['PRESUPUESTO_DEFINITIVO']*384+dims['PRESUPUESTO_PARTIDA']['G_1']
        values=s['data']['observations'].split('|');values[i]='1';s['data']['observations']='|'.join(values)
    with pytest.raises(ValueError):parse_snapshot(json.dumps(s).encode())

def test_incomplete_snapshot_does_not_replace_previous_data():
    s=parse_snapshot(source());s['records'].pop();cur=Mock()
    with pytest.raises(ValueError):save(cur,s)
    cur.execute.assert_not_called()

def test_official_seed_atomic_recovery_and_permissions():
    if not os.getenv('TEST_COFOG_DB_URL'):pytest.skip('isolated PostgreSQL only')
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    try:
        with conn.cursor() as c:
            c.execute('DROP TABLE IF EXISTS local_liquidation_snapshot');c.execute((Path(__file__).resolve().parents[2]/'supabase/migrations/20261012100000_local_liquidation.sql').read_text())
            c.execute('SELECT metadata FROM local_liquidation_snapshot');s=c.fetchone()[0];assert s['missing_cells']==43
            save(c,s);save(c,s)
        conn.commit();bad=copy.deepcopy(s);bad['records'].pop()
        with pytest.raises(ValueError):
            with conn.cursor() as c:save(c,bad)
        conn.rollback()
        with conn.cursor() as c:
            c.execute('SET LOCAL ROLE anon');c.execute('SELECT metadata FROM local_liquidation_snapshot');assert c.fetchone()[0]['complete_comparisons']==85
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as c:c.execute('DELETE FROM local_liquidation_snapshot')
        conn.rollback()
    finally:conn.close()
