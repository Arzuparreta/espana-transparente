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
