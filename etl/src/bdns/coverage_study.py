"""Bounded, ephemeral SNPSAP coverage study. Never persist beneficiary microdata.

This ordered sample describes the query only; it is not an estimate of all aid.
Run explicitly, never as an ingestion pipeline or public small-cell dataset.
"""
import argparse
import json
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

import httpx

API = 'https://www.infosubvenciones.es/bdnstrans/api/concesiones/busqueda'
NOTICE = 'https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal'
VERSION = 'bdns-coverage-study-v1'


def window(start, end):
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    if first.isoformat() != start or last.isoformat() != end or first > last or (last-first).days > 30:
        raise ValueError('Study window must contain between 1 and 31 days')
    return first, last


def profile_pages(pages, start, end, retrieved_at=None):
    first, last = window(start, end)
    if not 1 <= len(pages) <= 5:
        raise ValueError('Study requires one to five bounded pages')
    seen = set()
    counts = dict(rows_received=0, unique_records=0, duplicate_records=0,
                  outside_window=0, missing_or_invalid_dates=0,
                  label_masked=0, label_visible=0, label_absent=0,
                  amount_missing=0, amount_zero=0, amount_nonzero=0, amount_invalid=0)
    reported, sizes = [], []
    warnings_present = True
    for index, page in enumerate(pages):
        if not isinstance(page, dict):
            raise ValueError('Invalid coverage response')
        rows, total, size, number = (page.get(key) for key in ['content', 'totalElements', 'size', 'number'])
        if (not isinstance(rows, list) or type(total) is not int or total < 0 or
                type(size) is not int or not 1 <= size <= 200 or type(number) is not int or number != index or
                type(page.get("last")) is not bool or
                len(rows) > size or page.get('numberOfElements') != len(rows)):
            raise ValueError('Invalid bounded pagination metadata')
        reported.append(total)
        sizes.append(size)
        warnings_present = warnings_present and isinstance(page.get('advertencia'), str) and NOTICE in page['advertencia']
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError('Invalid concession record')
            identifier = row.get('id')
            if isinstance(identifier, bool) or not isinstance(identifier, (str, int)) or not str(identifier).strip():
                raise ValueError('Missing stable record identifier')
            counts['rows_received'] += 1
            # IDs only detect repeats in memory; neither IDs nor labels leave this function.
            key = str(identifier)
            if key in seen:
                counts['duplicate_records'] += 1
                continue
            seen.add(key)
            counts['unique_records'] += 1
            try:
                granted = date.fromisoformat(row.get('fechaConcesion'))
            except (ValueError, TypeError):
                counts['missing_or_invalid_dates'] += 1
            else:
                if not first <= granted <= last:
                    counts['outside_window'] += 1
            label = row.get('beneficiario')
            if not isinstance(label, str) or not label.strip():
                counts['label_absent'] += 1
            elif label.lstrip().startswith('*'):
                counts['label_masked'] += 1
            else:
                counts['label_visible'] += 1
            amount = row.get('importe')
            if amount is None:
                counts['amount_missing'] += 1
                continue
            try:
                if isinstance(amount, bool):
                    raise InvalidOperation
                value = Decimal(str(amount))
                if not value.is_finite() or value.quantize(Decimal('0.01')) != value:
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                counts['amount_invalid'] += 1
            else:
                counts['amount_zero' if value == 0 else 'amount_nonzero'] += 1
    stable = len(set(reported)) == 1 and len(set(sizes)) == 1
    complete = (stable and pages[-1]["last"] is True and counts['unique_records'] == reported[0] and
                counts['duplicate_records'] == counts['outside_window'] == counts['missing_or_invalid_dates'] == 0)
    return dict(version=VERSION, source_url=API, notice_url=NOTICE,
        retrieved_at=retrieved_at or datetime.now(timezone.utc).isoformat(),
        concession_window=dict(start=start, end=end), pages_read=len(pages),
        reported_records_per_page=reported, pagination_stable=stable,
        complete_query=complete, source_warning_present=warnings_present,
        counts=counts, sampling='ordered-pages-not-representative',
        identity_interpretation='masking-is-not-anonymisation-visible-is-not-legal-entity',
        persistence='no-beneficiary-microdata',
        financial_stage='published-concessions-not-payments')


def fetch_profile(start, end, max_pages=1, page_size=200):
    first, last = window(start, end)
    if type(max_pages) is not int or not 1 <= max_pages <= 5 or type(page_size) is not int or not 1 <= page_size <= 200:
        raise ValueError('Study exceeds bounded access contract')
    pages = []
    with httpx.Client(timeout=45, follow_redirects=True,
                      headers={'User-Agent': 'EspanaTransparente/1.0 (+https://spaintransparencia.info)'}) as client:
        for index in range(max_pages):
            with client.stream('GET', API, params=dict(pageSize=page_size, page=index,
                    fechaDesde=first.strftime('%d/%m/%Y'), fechaHasta=last.strftime('%d/%m/%Y'))) as response:
                response.raise_for_status()
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > 2_000_000:
                        raise ValueError('Oversized study response')
                    chunks.append(chunk)
            try:
                page = json.loads(b''.join(chunks))
            except (ValueError, UnicodeDecodeError):
                raise ValueError('Source did not return valid study JSON') from None
            pages.append(page)
            # Validate before interpreting pagination or fetching another page.
            profile_pages(pages, start, end)
            if page.get('last') is True:
                break
    return profile_pages(pages, start, end)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-date', required=True)
    parser.add_argument('--to-date', required=True)
    parser.add_argument('--max-pages', type=int, default=1)
    parser.add_argument('--page-size', type=int, default=200)
    args = parser.parse_args()
    try:
        profile = fetch_profile(args.from_date, args.to_date, args.max_pages, args.page_size)
    except (ValueError, httpx.HTTPError):
        # Source bodies and individual fields must never enter diagnostics.
        parser.exit(1, 'Coverage study failed validation or source access; no microdata retained.\n')
    print(json.dumps(profile, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
