"""National EPA monthly gross wage distribution; annual 2021 population base."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from ine.client import fetch_json

TABLES = (66237, 66252, 66199)
SOURCES = {str(t): f'https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{t}?nult=100' for t in TABLES}
VERSION = 'epa-monthly-national-2021-v1'


def points(series, unit, scale, name):
    if series.get('Nombre', '').strip() != name or series.get('FK_Unidad') != unit or series.get('FK_Escala') != scale:
        raise ValueError('INE wage series dimension changed')
    result = {}
    for p in series.get('Data', []):
        year = p.get('Anyo')
        if not isinstance(year, int) or isinstance(year, bool): raise ValueError('Invalid wage year')
        if year < 2021: continue
        if year > datetime.now(timezone.utc).year or year in result or p.get('FK_Periodo') != 28 or p.get('FK_TipoDato') != 1 or p.get('Secreto') is not False:
            raise ValueError('Invalid or duplicate annual wage observation')
        value = p.get('Valor')
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
            raise ValueError('Invalid wage value')
        result[year] = value
    if not result: raise ValueError('Empty wage series')
    return result


def decode(payloads):
    indexed = {}
    for t in TABLES:
        data = payloads[str(t)]
        if not isinstance(data, list) or len(data) > 100: raise ValueError('Invalid wage table')
        indexed[t] = {s['COD']: s for s in data}
        if len(indexed[t]) != len(data): raise ValueError('Duplicate wage series')
    def get(t, code, unit, scale, name):
        return points(indexed[t][code], unit, scale, name)
    means = get(66237, 'EPA706443', 7, 1, 'Total. Total. Dato base. Total Nacional. Salario medio.')
    counts = get(66199, 'EPA690372', 3, 4, 'Total. Total. Total Nacional. Dato base. Asalariados.')
    all_points = [means, counts]
    deciles = []
    for d in range(1, 11):
        lower = get(66252, f'EPA{710403 + 2*(d-1)}', 7, 1, f'{d}. Límite inferior. Salario bruto mensual del empleo principal.')
        mean = get(66252, f'EPA{710404 + 2*(d-1)}', 7, 1, f'{d}. Media. Salario bruto mensual del empleo principal.')
        count = get(66199, f'EPA{690374 + 2*(d-1)}', 3, 4, f'Total. {d}. Total Nacional. Dato base. Asalariados.')
        share = get(66199, f'EPA{690375 + 2*(d-1)}', 101, 1, f'Total. {d}. Total Nacional. Porcentaje respecto al total de cada jornada. Asalariados.')
        check_mean = get(66237, f'EPA{706443 + d}', 7, 1, f'Total. {d}. Dato base. Total Nacional. Salario medio.')
        if mean != check_mean: raise ValueError('Wage table editions disagree')
        all_points.extend([lower, mean, count, share]); deciles.append((lower, mean, count, share))
    if any(set(s) != set(means) for s in all_points) or len(means) > 30:
        raise ValueError('Incomplete wage years')
    rows = []
    for year in sorted(means):
        bands = [dict(decile=d+1, lower=s[0][year], mean=s[1][year], count_thousands=s[2][year], share=s[3][year]) for d,s in enumerate(deciles)]
        limits = [b['lower'] for b in bands]
        if limits[0] is not None or any(x is None or x <= 0 for x in limits[1:]) or any(a >= b for a,b in zip(limits[1:], limits[2:])):
            raise ValueError('Invalid decile boundaries')
        total, mean = counts[year], means[year]
        if total is None or mean is None or total <= 0 or mean <= 0: raise ValueError('Missing wage total')
        for d,b in enumerate(bands):
            if any(b[k] is None for k in ('mean','count_thousands','share')) or b['count_thousands'] <= 0 or not 0 < b['share'] <= 100:
                raise ValueError('Missing decile values')
            if (d and b['mean'] < b['lower']) or (d < 9 and b['mean'] >= limits[d+1]): raise ValueError('Decile mean outside boundaries')
            if abs(b['share'] - b['count_thousands']/total*100) > .11: raise ValueError('Inconsistent wage share')
        band_count = sum(b['count_thousands'] for b in bands)
        if abs(band_count-total) > .6 or abs(sum(b['share'] for b in bands)-100) > .6:
            raise ValueError('Wage distribution does not reconcile')
        weighted = sum(b['mean']*b['count_thousands'] for b in bands)/band_count
        if abs(weighted-mean) > .2: raise ValueError('Weighted wage mean does not reconcile')
        rows.append(dict(year=year,mean=mean,count_thousands=total,bands=bands))
    return dict(version=VERSION, sources=SOURCES, retrieved_at=datetime.now(timezone.utc).isoformat(),
                sha256={t:hashlib.sha256(json.dumps(payloads[t],ensure_ascii=False,sort_keys=True).encode()).hexdigest() for t in SOURCES},years=rows)


def save(cur, snapshot):
    # Validate in-memory again before replacing a complete snapshot.
    if snapshot.get('version') != VERSION or not snapshot.get('years'): raise ValueError('Invalid wage snapshot')
    cur.execute("INSERT INTO wage_distribution_snapshot(scope,metadata) VALUES ('epa-national',%s) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata", (json.dumps(snapshot,ensure_ascii=False),))


def run(dry_run=False):
    if dry_run:
        snapshot=decode({t:fetch_json(url) for t,url in SOURCES.items()});print(f"Validated {len(snapshot['years'])} wage years; no writes");return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur: run_id=start_run(cur,pipeline='ine.salarios_distribucion')
        conn.commit()
        snapshot=decode({t:fetch_json(url) for t,url in SOURCES.items()})
        with conn.cursor() as cur:
            save(cur,snapshot)
            finish_run(cur,run_id=run_id,status='succeeded',rows_read=len(snapshot['years'])*10,rows_inserted=1)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur: finish_run(cur,run_id=run_id,status='failed',error_summary=str(exc)[:500])
            conn.commit()
        raise
    finally: conn.close()

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--dry-run',action='store_true');run(p.parse_args().dry_run)
