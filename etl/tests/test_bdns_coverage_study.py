import json

import pytest

from bdns.coverage_study import profile_pages, NOTICE, window, fetch_profile


def row(identifier, label='*** PERSONA SINTETICA', amount=12):
    return dict(id=identifier, beneficiario=label, importe=amount,
                fechaConcesion='2026-10-01', idPersona='private-person-id',
                nif='private-nif', urlBR='https://example.com/private',
                convocatoria='private-call', ayudaEquivalente=999999)


def page(rows, total=None, number=0):
    return dict(content=rows, totalElements=len(rows) if total is None else total,
                size=10, number=number, numberOfElements=len(rows), advertencia=NOTICE, last=len(rows)==(len(rows) if total is None else total))


def profile(pages):
    return profile_pages(pages, '2026-10-01', '2026-10-01')


def test_sensitive_microdata_never_in_output():
    result = profile([page([row('private-record-id')])])
    output = json.dumps(result)
    for value in ['PERSONA SINTETICA', 'private-person-id', 'private-nif', 'private-record-id', 'private-call', 'https://example.com/private', '999999']:
        assert value not in output
    assert result['counts']['label_masked'] == 1
    assert result['complete_query'] is True
    assert result['sampling'] == 'ordered-pages-not-representative'


def test_unknown_zero_invalid_amounts_and_visible_labels_not_legal_entities():
    result = profile([page([row(1, amount=None), row(2, amount=0), row(3, 'PERSONA VISIBLE'), row(4, '', 'invalid'), row(5, amount='NaN')])])
    counts = result['counts']
    assert counts['amount_missing'] == counts['amount_zero'] == counts['amount_nonzero'] == 1
    assert counts['amount_invalid'] == 2
    assert counts['label_absent'] == counts['label_visible'] == 1
    assert 'visible-is-not-legal-entity' in result['identity_interpretation']


def test_duplicate_pages_are_not_complete_coverage():
    result = profile([page([row(1)], total=2), page([row(1)], total=2, number=1)])
    assert result['counts']['duplicate_records'] == 1
    assert result['counts']['unique_records'] == 1
    assert result['complete_query'] is False


def test_partial_sample_does_not_extrapolate_api_total():
    result = profile([page([row(1)], total=75709)])
    assert result['reported_records_per_page'] == [75709]
    assert result['counts']['label_masked'] == 1
    assert result['complete_query'] is False
    assert 'percent' not in json.dumps(result)


def test_dynamic_total_is_explicit():
    result = profile([page([row(1)], total=2), page([row(2)], total=3, number=1)])
    assert not result['pagination_stable']
    assert not result['complete_query']


def test_concession_date_not_registration_date():
    good, outside, missing = row(1), row(2), row(3)
    good['fechaAlta'] = '2026-12-12'
    outside['fechaConcesion'] = '2026-10-02'
    missing['fechaConcesion'] = None
    result = profile([page([good, outside, missing])])
    assert result['counts']['outside_window'] == 1
    assert result['counts']['missing_or_invalid_dates'] == 1
    assert not result['complete_query']


def test_changed_warning_is_recorded_not_invented():
    source = page([]); source.pop('advertencia')
    assert not profile([source])['source_warning_present']


@pytest.mark.parametrize('change', [lambda p: p.update(size=201), lambda p: p.update(number=1), lambda p: p.update(numberOfElements=0), lambda p: p.update(totalElements=-1), lambda p: p['content'][0].pop('id')])
def test_malformed_pagination_and_identifiers_fail(change):
    source = page([row(1)]); change(source)
    with pytest.raises(ValueError):
        profile([source])


@pytest.mark.parametrize('start,end', [('2026-10-02', '2026-10-01'), ('2026-01-01', '2026-12-31'), ('bad', '2026-10-01')])
def test_bounded_window(start, end):
    with pytest.raises(ValueError):
        window(start, end)


def test_fetch_bound_rejected_before_network():
    with pytest.raises(ValueError, match='bounded'):
        fetch_profile('2026-10-01', '2026-10-01', max_pages=6)


def test_empty_valid_query_is_not_absent_source():
    result = profile([page([])])
    assert result['complete_query']
    assert result['counts']['rows_received'] == 0


def test_unfinished_page_cannot_claim_complete_query():
    source = page([row(1)]); source['last'] = False
    assert not profile([source])['complete_query']


def test_invalid_source_diagnostics_do_not_expose_beneficiary(monkeypatch, capsys):
    from bdns.coverage_study import main
    monkeypatch.setattr('sys.argv', ['coverage_study', '--from-date', '2026-10-01', '--to-date', '2026-10-01'])
    def failed(*args):
        raise ValueError('PERSONA SINTETICA NIF private payload')
    monkeypatch.setattr('bdns.coverage_study.fetch_profile', failed)
    with pytest.raises(SystemExit) as result:
        main()
    assert result.value.code == 1
    output = capsys.readouterr()
    assert 'PERSONA' not in output.err
    assert 'private' not in output.err
    assert not output.out
