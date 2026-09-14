from unittest.mock import MagicMock
import pytest
from ine.client import require_observations


@pytest.mark.parametrize('payload', [{}, {'Data': []}, {'Data': [{'Valor': None}]}, []])
def test_empty_source_is_not_success(payload):
    with pytest.raises(ValueError, match='no observations'):
        require_observations(payload, 'TEST')


@pytest.mark.parametrize('module', ['indicadores_ampliados', 'ipc_subgrupos'])
def test_partial_ine_failures_are_recorded(monkeypatch, module):
    import importlib
    target = importlib.import_module('ine.' + module)
    conn = MagicMock()
    monkeypatch.setattr(target, 'get_pg_conn', lambda: conn)
    monkeypatch.setattr(target, 'start_run', lambda *a, **kw: 'run')
    finish = MagicMock()
    monkeypatch.setattr(target, 'finish_run', finish)
    monkeypatch.setattr(target, 'fetch_json', lambda _: {'Data': []})
    with pytest.raises(RuntimeError, match='INE series failed'):
        target.run()
    assert finish.call_args.kwargs['status'] == 'failed'
    conn.rollback.assert_called_once()
