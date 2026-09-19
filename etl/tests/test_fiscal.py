import pytest
from ine.fiscal import observations, build_records, SERIES


def payload(items, years=("2023", "2024"), values=None):
    ids = ["time", "geo", "na_item", "unit", "freq", "sector"]
    categories = [list(years), ["ES"], items, ["MIO_EUR"], ["A"], ["S13"]]
    return {
        "id": ids,
        "size": [len(c) for c in categories],
        "dimension": {
            d: {"category": {"index": dict(zip(c, range(len(c))))}}
            for d, c in zip(ids, categories)
        },
        "value": values
        if values is not None
        else {str(i): 0 for i in range(len(items) * len(years))},
    }


def test_dimension_order_sparse_zero_and_flags():
    raw = payload(["TR", "TE"], values={"0": 0, "3": 12.5})
    raw["status"] = {"3": "p"}
    facts = observations(raw)
    assert facts[("TR", "2023")][0] == 0
    assert facts[("TE", "2024")][1] == "p"
    assert ("TR", "2024") not in facts


def test_scope_and_nonfinite_rejected():
    raw = payload(["TR"])
    raw["dimension"]["unit"]["category"]["index"] = {"PC_GDP": 0}
    with pytest.raises(ValueError, match="scope or units"):
        observations(raw)
    with pytest.raises(ValueError, match="Non-finite"):
        observations(payload(["TR"], values={"0": float("nan")}))


def test_reconciliation_and_metadata():
    items = list(dict.fromkeys(item for spec in SERIES for item in spec["items"]))
    raw = payload(items)
    debt = payload(["GD"])
    records = build_records(raw, debt, "2026-09-19T00:00:00Z")
    assert len(records) == 14
    assert '"sector": "S13"' in records[0][-1]
    raw["value"][str(items.index("TR"))] = 10
    with pytest.raises(ValueError, match="identity failed"):
        build_records(raw, debt)


def test_missing_series_fails_before_writing():
    with pytest.raises(ValueError, match="Missing required"):
        build_records(payload(["TR", "TE", "B9"]), payload(["GD"]))
