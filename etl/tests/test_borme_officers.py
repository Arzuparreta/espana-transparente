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
