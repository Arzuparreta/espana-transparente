from territorio.atlas import fetch_population


def test_fetch_population_parses_eurostat_shape(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "value": {"0": 100, "2": 125},
                "dimension": {
                    "time": {
                        "category": {
                            "index": {"2023": 0, "2024": 1, "2025": 2}
                        }
                    }
                },
            }

    monkeypatch.setattr("territorio.atlas.httpx.get", lambda *args, **kwargs: Response())
    assert fetch_population("ES11") == [(2023, 100), (2025, 125)]


def test_population_retries_transient_http_failure(monkeypatch):
    import httpx
    from territorio import atlas
    from tenacity import wait_none
    calls = []
    request = httpx.Request('GET', atlas.EUROSTAT_URL)

    def get(*args, **kwargs):
        calls.append(1)
        if len(calls) == 1:
            return httpx.Response(404, request=request)
        return httpx.Response(200, request=request, json={
            'dimension': {'time': {'category': {'index': {'2025': 0}}}},
            'value': {'0': 100},
        })
    monkeypatch.setattr(atlas.httpx, 'get', get)
    monkeypatch.setattr(atlas.fetch_population.retry, 'wait', wait_none())
    assert atlas.fetch_population('ES61') == [(2025, 100)]
    assert len(calls) == 2


def test_spend_refresh_survives_population_outage(monkeypatch):
    import pytest
    from territorio import atlas
    statements = []

    class Cursor:
        def execute(self, sql): statements.append(sql)
        def fetchall(self): return [('ANDALUCIA', 'ES61')]
        def close(self): pass

    class Conn:
        def cursor(self): return Cursor()
        def commit(self): statements.append('COMMIT')
        def close(self): pass

    def failed(_): raise RuntimeError('source outage')
    monkeypatch.setattr(atlas, 'get_pg_conn', Conn)
    monkeypatch.setattr(atlas, 'fetch_population', failed)
    with pytest.raises(RuntimeError, match='population update incomplete'):
        atlas.refresh()
    assert 'SELECT refresh_territory_atlas()' in statements
    assert 'COMMIT' in statements
