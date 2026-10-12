from pathlib import Path
import gzip
import pytest
from pac.pagos import build_snapshot, cents, parse_table, TABLES

@pytest.fixture
def source():return gzip.decompress((Path(__file__).parent/'fixtures/pac-financial-2025.txt.gz').read_bytes()).decode()

def test_complete_consolidated_edition_reconciles_both_breakdowns(source):
    s=build_snapshot(source,'a'*64)
    assert (s['period_start'],s['period_end'])==('2024-10-16','2025-10-15')
    assert sum(len(t['rows']) for p in s['programmes'].values() for t in p.values())==101
    assert s['programmes']['feaga']['categories']['total_cents']==[571903207575]
    assert s['programmes']['feader-2014-2022']['categories']['total_cents']==[118293844989,158544101527]
    assert s['programmes']['feader-2023-2027']['categories']['total_cents']==[49751992398,74836359506]
    assert s['programmes']['feaga']['territories']['rows'][-1]['code']=='FEGA'
    measure=next(r for r in s['programmes']['feader-2014-2022']['categories']['rows'] if r['code']=='05')
    assert 'implantación de medidas preventivas adecuadas (artículo 18)' in measure['label']

def test_negative_recoveries_and_published_zero_are_not_erased(source):
    s=build_snapshot(source,'a'*64)
    r=next(r for r in s['programmes']['feader-2014-2022']['categories']['rows'] if r['code']=='22')
    assert r['amounts_cents']==[-430639,-1211738]
    r=next(r for r in s['programmes']['feader-2023-2027']['categories']['rows'] if r['code']=='09')
    assert r['amounts_cents']==[1046986299,0]

def test_wrong_financial_year_monthly_report_and_absent_table_fail_closed(source):
    for old,new in [('Ejercicio 2025 (16/10/24 a 15/10/25)','Ejercicio 2025 (01/01/25 a 31/12/25)'),('DISTRIBUCIÓN DE PAGOS POR MEDIDAS. TOTAL NACIONAL','missing'),('FEADER. PEPAC (PERIODO 2023-2027)','missing')]:
        with pytest.raises(ValueError):build_snapshot(source.replace(old,new),'a'*64)

def test_changed_totals_or_missing_recovery_fail_reconciliation(source):
    for old,new in [('5.719.032.075,75','5.719.032.075,76'),('-4.306,39','4.306,39')]:
        with pytest.raises(ValueError,match='reconcile'):build_snapshot(source.replace(old,new),'a'*64)

def test_duplicate_table_and_unknown_paying_body_fail(source):
    with pytest.raises(ValueError):build_snapshot(source+'\f'+source.split('\f')[13],'a'*64)
    with pytest.raises(ValueError,match='paying body'):build_snapshot(source.replace('F.E.G.A.','UNKNOWN'),'a'*64)

@pytest.mark.parametrize('value',['1.001','1,001','N/D','NaN','900.719.925.474.099,99'])
def test_invalid_precision_and_range_rejected(value):
    with pytest.raises(ValueError):cents(value)
