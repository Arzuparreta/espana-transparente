"""Generate review-gated corruption-case to contract link candidates.

The matcher is intentionally conservative: it links a corruption-case actor to
contracts only when both records already share the same normalized organization
id. Generated rows remain hidden from public views until reviewed.

Usage:
    PYTHONPATH=src python -m src.judicial.contract_links --dry-run
    PYTHONPATH=src python -m src.judicial.contract_links
"""

from __future__ import annotations

import argparse

import psycopg2.extras

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run


MATCH_QUERY = """
WITH candidate_matches AS (
  SELECT
    cca.id AS case_actor_id,
    cca.case_id,
    cca.actor_label,
    cca.organization_id,
    cca.evidence_url AS actor_evidence_url,
    cc.source_url AS case_source_url,
    c.id AS contract_id,
    c.source_url AS contract_source_url,
    CASE
      WHEN c.contractor_organization_id = cca.organization_id THEN 'adjudicatario'
      WHEN c.awarding_body_organization_id = cca.organization_id THEN 'organo_contratante'
      ELSE 'organizacion'
    END AS matched_side,
    COALESCE(c.award_amount, c.amount) AS amount,
    c.date
  FROM corruption_case_actors cca
  JOIN corruption_cases cc ON cc.id = cca.case_id
  JOIN contracts c
    ON c.contractor_organization_id = cca.organization_id
    OR c.awarding_body_organization_id = cca.organization_id
  WHERE cca.organization_id IS NOT NULL
    AND cca.review_status IN ('candidate', 'needs_review', 'reviewed')
    AND COALESCE(c.source_url, cc.source_url, cca.evidence_url) IS NOT NULL
)
SELECT *
FROM candidate_matches
ORDER BY amount DESC NULLS LAST, date DESC NULLS LAST
"""


def fetch_matches(cur, limit: int | None = None) -> list[dict]:
    query = MATCH_QUERY
    params: tuple[int, ...] = ()
    if limit is not None:
        query += "\nLIMIT %s"
        params = (limit,)
    cur.execute(query, params)
    columns = [desc.name for desc in cur.description]
    return [dict(zip(columns, row, strict=True)) for row in cur.fetchall()]


def insert_matches(cur, matches: list[dict]) -> int:
    inserted = 0
    for match in matches:
        link_reason = (
            "Coincidencia de organización revisable: "
            f"{match['actor_label']} figura como {match['matched_side']} en el contrato."
        )
        evidence_url = (
            match["contract_source_url"]
            or match["actor_evidence_url"]
            or match["case_source_url"]
        )
        cur.execute(
            """
            INSERT INTO corruption_contract_links (
              case_id, case_actor_id, organization_id, contract_id,
              link_reason, evidence_url, review_status, raw_data
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'needs_review', %s)
            ON CONFLICT DO NOTHING
            """,
            (
                match["case_id"],
                match["case_actor_id"],
                match["organization_id"],
                match["contract_id"],
                link_reason,
                evidence_url,
                psycopg2.extras.Json({
                    "match_method": "organization_id_exact",
                    "matched_side": match["matched_side"],
                    "amount": str(match["amount"]) if match["amount"] is not None else None,
                    "date": match["date"].isoformat() if match["date"] else None,
                }),
            ),
        )
        if cur.rowcount:
            inserted += 1
    return inserted


def run(*, dry_run: bool = False, limit: int | None = None) -> tuple[int, int]:
    conn = get_pg_conn()
    run_id = None
    try:
        with conn.cursor() as cur:
            if not dry_run:
                run_id = start_run(cur, pipeline="judicial.contract_links", chunk_key="full")
            matches = fetch_matches(cur, limit=limit)
            if dry_run:
                for match in matches[:25]:
                    print(
                        f"{match['case_id']} | {match['contract_id']} | "
                        f"{match['actor_label']} | {match['matched_side']}"
                    )
                return len(matches), 0

            inserted = insert_matches(cur, matches)
            if run_id:
                finish_run(
                    cur,
                    run_id=run_id,
                    status="succeeded",
                    rows_read=len(matches),
                    rows_inserted=inserted,
                )
            conn.commit()
            print(f"Judicial contract link candidates: {inserted} inserted from {len(matches)} matches")
            return len(matches), inserted
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:
                finish_run(
                    cur,
                    run_id=run_id,
                    status="failed",
                    error_summary=str(exc)[:500],
                )
                conn.commit()
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    run(dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    main()
