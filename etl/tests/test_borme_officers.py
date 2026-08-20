from dataclasses import dataclass

import pytest

from src.borme import officers


@dataclass
class _Response:
    status_code: int

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"items": []}


class _Client:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        self.calls = 0

    def get(self, *_args, **_kwargs) -> _Response:
        self.calls += 1
        return _Response(self.status_code)


def test_search_company_stops_batch_after_bounded_rate_limit(monkeypatch) -> None:
    client = _Client(429)
    monkeypatch.setattr(officers.time, "sleep", lambda _seconds: None)

    with pytest.raises(officers.OpenMercantilRateLimited):
        officers.search_company(client, "Empresa de prueba")

    assert client.calls == officers.MAX_RETRIES


def test_health_check_exposes_rate_limit() -> None:
    client = _Client(429)

    with pytest.raises(officers.OpenMercantilRateLimited):
        officers._api_health_check(client)


def test_run_fails_when_the_api_is_unreachable(monkeypatch):
    """An unreachable upstream must not be recorded as a successful run.

    openmercantil.es was returning Cloudflare 530 (origin down) while the
    pipeline reported 'succeeded' with zero officers — the same shape as
    "checked 100 orgs, none had BORME data".
    """
    from borme import officers as mod

    monkeypatch.setattr(mod, "_api_health_check", lambda client: False)
    monkeypatch.setattr(
        mod, "get_orgs_to_process", lambda cur, limit=None, resume=False: [
            {"id": "1", "name": "ACME SL", "cif": None}
        ]
    )
    monkeypatch.setattr(mod, "get_pg_conn", lambda: _FakeConn())

    with pytest.raises(RuntimeError, match="not reachable"):
        mod.run(dry_run=False, limit=1)


class _FakeCursor:
    rowcount = 0

    def execute(self, *args, **kwargs):
        return None

    def fetchone(self):
        return None

    def fetchall(self):
        return []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeConn:
    def cursor(self, *args, **kwargs):
        return _FakeCursor()

    def commit(self):
        return None

    def rollback(self):
        return None

    def close(self):
        return None
