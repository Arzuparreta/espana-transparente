from datetime import date
from decimal import Decimal

from judicial.contract_links import insert_matches


class FakeCursor:
    def __init__(self):
        self.calls = []
        self.rowcount = 0

    def execute(self, query, params):
        self.calls.append((query, params))
        self.rowcount = 1


def test_insert_matches_creates_review_gated_contract_link_candidate():
    cur = FakeCursor()

    inserted = insert_matches(cur, [{
        "case_id": "case-1",
        "case_actor_id": "actor-1",
        "actor_label": "Empresa Ejemplo",
        "organization_id": "org-1",
        "actor_evidence_url": "https://example.test/actor",
        "case_source_url": "https://example.test/case",
        "contract_id": "contract-1",
        "contract_source_url": "https://example.test/contract",
        "matched_side": "adjudicatario",
        "amount": Decimal("125000.00"),
        "date": date(2026, 1, 2),
    }])

    assert inserted == 1
    query, params = cur.calls[0]
    assert "review_status, raw_data" in query
    assert "'needs_review'" in query
    assert params[0] == "case-1"
    assert params[3] == "contract-1"
    assert params[5] == "https://example.test/contract"
    assert params[6].adapted["match_method"] == "organization_id_exact"
    assert params[6].adapted["matched_side"] == "adjudicatario"
