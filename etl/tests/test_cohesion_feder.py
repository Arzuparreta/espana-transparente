import copy
import gzip
import json
from pathlib import Path
import pytest
from cohesion.feder import aggregate, build_snapshot, cents, DATASETS, persist

@pytest.fixture
def source():
    return json.loads(gzip.decompress((Path(__file__).parent/'fixtures/cohesion-feder.json.gz').read_bytes()))

def test_complete_official_source_reconciles_and_keeps_historical_codes(source):
    s=build_snapshot(*(source['rows'][code] for code in DATASETS),source['metadata'])
    assert s['source_rows']=={'99js-gm52':1849,'gayr-92qh':443}
    assert len(s['programmes'])==22
    assert sum(r['source_rows'] for p in s['programmes'] for r in p['implementation'])==1849
    canarias=next(p for p in s['programmes'] if p['cci']=='2014ES16RFOP007')
    assert len({r['year'] for r in canarias['payments']})==len(canarias['payments'])
    assert all(r['known']['eu_cents']+r['known']['national_cents']==r['known']['planned_cents'] for r in canarias['implementation'] if not any(r['missing'].values()))

def test_duplicate_rows_and_versions_are_not_summed(source):
    rows=source['rows'][DATASETS[0]][:1]
    for duplicate in (copy.deepcopy(rows[0]),{**rows[0],'ver':'other'}):
        with pytest.raises(ValueError,match='Duplicate'):aggregate(rows+[duplicate],DATASETS[0])

def test_unknown_is_not_zero_and_signed_recoveries_are_kept(source):
    row=copy.deepcopy(source['rows'][DATASETS[1]][0])
    row.update(net_pre_financing='-10.00',net_interim_payments='15.00',total_net_payments='5.00',net_planned_eu_amount=None)
    r=next(iter(aggregate([row],DATASETS[1]).values()))[0]
    assert r['known']['pre_financing_cents']==-1000
    assert r['missing']['eu_planned_cents']==1
    row['net_planned_eu_amount']='0'
    assert next(iter(aggregate([row],DATASETS[1]).values()))[0]['missing']['eu_planned_cents']==0

def test_incomplete_reconciliation_is_not_fabricated(source):
    row=copy.deepcopy(source['rows'][DATASETS[0]][0]);row['national_amount']=None
    r=next(iter(aggregate([row],DATASETS[0]).values()))[0]
    assert r['missing']['national_cents']==1
    row['national_amount']='0';row['total_amount']='99999999999'
    with pytest.raises(ValueError,match='reconciliation'):aggregate([row],DATASETS[0])

@pytest.mark.parametrize('value',['NaN','1e9','1.001',1,'90071992547410','-1.00'])
def test_invalid_precision_range_or_sign_rejected(value):
    with pytest.raises(ValueError):cents(value)

def test_total_wrong_instrument_missing_key_or_future_reference_rejected(source):
    row=source['rows'][DATASETS[0]][0]
    for patch in ({'fund':'EAFRD'},{'category_of_region':'TOTAL'},{'priority':'TOTAL'},{'year':'2024'},{'cci':'unknown'},{'to':None}):
        with pytest.raises(ValueError):aggregate([{**row,**patch}],DATASETS[0])

def test_mixed_report_versions_and_dates_rejected(source):
    rows=source['rows'][DATASETS[0]]
    first=rows[0]
    second=next(r for r in rows if r['cci']==first['cci'] and r['year']==first['year'] and r!=first)
    for field in ('title','ver','reference_date','ir_last_version'):
        with pytest.raises(ValueError,match='Mixed'):aggregate([first,{**second,field:'changed'}],DATASETS[0])

def test_invalid_metadata_or_empty_source_retains_previous_edition(source):
    with pytest.raises(ValueError):build_snapshot([],source['rows'][DATASETS[1]],source['metadata'])
    source['metadata'][DATASETS[0]]['id']='wrong'
    with pytest.raises(ValueError):build_snapshot(*(source['rows'][code] for code in DATASETS),source['metadata'])

def test_atomic_snapshot_write_does_not_commit_itself():
    operations=[]
    class Cursor:
        def execute(self,*args):operations.append(args)
    persist(Cursor(),{'version':'test'})
    assert len(operations)==1
    assert 'ON CONFLICT' in operations[0][0]
