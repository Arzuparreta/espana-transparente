#!/usr/bin/env python3
"""Export, validate, and restore irrecoverable review decisions by natural key."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg2
import psycopg2.extras


def json_default(value: object) -> str:
    if isinstance(value, (datetime, Decimal, UUID)):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def fetch_all(cur: psycopg2.extensions.cursor, query: str) -> list[dict[str, Any]]:
    cur.execute(query)
    return [dict(row) for row in cur.fetchall()]


def export_state(conn: psycopg2.extensions.connection, output: Path) -> None:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        state = {
            "version": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "judicial_actors": fetch_all(
                cur,
                """
                SELECT
                  cc.source_type AS case_source_type,
                  cc.external_id AS case_external_id,
                  cc.source_url AS case_source_url,
                  cca.actor_label,
                  cca.review_status,
                  cca.reviewed_at,
                  cca.reviewed_by,
                  cca.review_notes,
                  p.congress_id AS politician_congress_id,
                  o.normalized_name AS organization_normalized_name,
                  pa.name AS party_name
                FROM corruption_case_actors cca
                JOIN corruption_cases cc ON cc.id = cca.case_id
                LEFT JOIN politicians p ON p.id = cca.politician_id
                LEFT JOIN organizations o ON o.id = cca.organization_id
                LEFT JOIN parties pa ON pa.id = cca.party_id
                WHERE cca.review_status IN ('reviewed', 'rejected')
                ORDER BY cc.source_type, cc.external_id, cc.source_url, cca.actor_label
                """,
            ),
            "judicial_links": fetch_all(
                cur,
                """
                SELECT
                  cc.source_type AS case_source_type,
                  cc.external_id AS case_external_id,
                  cc.source_url AS case_source_url,
                  cca.actor_label,
                  o.normalized_name AS organization_normalized_name,
                  c.contract_folder_id,
                  s.bdns_id AS subsidy_bdns_id,
                  ccl.link_reason,
                  ccl.evidence_url,
                  ccl.review_status,
                  ccl.reviewed_at,
                  ccl.reviewed_by,
                  ccl.raw_data
                FROM corruption_contract_links ccl
                JOIN corruption_cases cc ON cc.id = ccl.case_id
                LEFT JOIN corruption_case_actors cca ON cca.id = ccl.case_actor_id
                LEFT JOIN organizations o ON o.id = ccl.organization_id
                LEFT JOIN contracts c ON c.id = ccl.contract_id
                LEFT JOIN subsidies s ON s.id = ccl.subsidy_id
                WHERE ccl.review_status IN ('reviewed', 'rejected')
                ORDER BY cc.source_type, cc.external_id, cc.source_url, ccl.evidence_url
                """,
            ),
            "lobbying_links": fetch_all(
                cur,
                """
                SELECT
                  lg.slug AS lobbying_group_slug,
                  o.normalized_name AS organization_normalized_name,
                  lol.confidence,
                  lol.match_method,
                  lol.review_status,
                  lol.reviewed_at,
                  lol.reviewed_by
                FROM lobbying_organization_links lol
                JOIN lobbying_groups lg ON lg.id = lol.lobbying_group_id
                JOIN organizations o ON o.id = lol.organization_id
                WHERE lol.review_status IN ('reviewed', 'rejected')
                ORDER BY lg.slug, o.normalized_name
                """,
            ),
            "borme_matches": fetch_all(
                cur,
                """
                SELECT
                  o.normalized_name AS organization_normalized_name,
                  bo.person_name AS officer_name,
                  bo.role AS officer_role,
                  bo.company_slug,
                  p.congress_id AS politician_congress_id,
                  bpm.confidence,
                  bpm.match_method,
                  bpm.review_status,
                  bpm.reviewed_at,
                  bpm.reviewed_by
                FROM borme_politician_matches bpm
                JOIN borme_officers bo ON bo.id = bpm.borme_officer_id
                JOIN organizations o ON o.id = bo.organization_id
                JOIN politicians p ON p.id = bpm.politician_id
                WHERE bpm.review_status IN ('reviewed', 'rejected')
                ORDER BY o.normalized_name, bo.person_name, bo.role, bo.company_slug
                """,
            ),
            "revolving_door_candidates": fetch_all(
                cur,
                """
                SELECT candidate_key, status, review_notes, reviewed_at, reviewed_by
                FROM revolving_door_candidates
                WHERE status IN ('approved', 'rejected', 'published')
                ORDER BY candidate_key
                """,
            ),
            "photo_decisions": fetch_all(
                cur,
                """
                SELECT
                  p.congress_id AS politician_congress_id,
                  ppv.source,
                  ppv.content_sha256,
                  ppv.status,
                  ppv.rejection_reason,
                  ppv.is_active,
                  ppv.promoted_at
                FROM politician_photo_versions ppv
                JOIN politicians p ON p.id = ppv.politician_id
                WHERE ppv.status = 'rejected'
                ORDER BY p.congress_id, ppv.source, ppv.content_sha256
                """,
            ),
        }

    output.write_text(json.dumps(state, ensure_ascii=True, indent=2, default=json_default) + "\n")


def resolve_one(cur, query: str, params: tuple[Any, ...], description: str, errors: list[str]):
    cur.execute(query, params)
    rows = cur.fetchall()
    if len(rows) != 1:
        errors.append(f"{description}: expected 1 match, found {len(rows)}")
        return None
    return rows[0][0]


def case_id(cur, row: dict[str, Any], errors: list[str]):
    if row.get("case_external_id"):
        return resolve_one(
            cur,
            "SELECT id FROM corruption_cases WHERE source_type = %s AND external_id = %s",
            (row["case_source_type"], row["case_external_id"]),
            f"case {row['case_source_type']}:{row['case_external_id']}",
            errors,
        )
    return resolve_one(
        cur,
        "SELECT id FROM corruption_cases WHERE source_type = %s AND source_url = %s",
        (row["case_source_type"], row["case_source_url"]),
        f"case {row['case_source_type']}:{row['case_source_url']}",
        errors,
    )


def optional_id(cur, table: str, column: str, value: Any, description: str, errors: list[str]):
    if value is None:
        return None
    allowed = {
        ("politicians", "congress_id"),
        ("organizations", "normalized_name"),
        ("parties", "name"),
        ("contracts", "contract_folder_id"),
        ("subsidies", "bdns_id"),
        ("lobbying_groups", "slug"),
    }
    if (table, column) not in allowed:
        raise ValueError(f"Unsupported lookup: {table}.{column}")
    return resolve_one(
        cur,
        f"SELECT id FROM {table} WHERE {column} = %s",
        (value,),
        description,
        errors,
    )


def restore_state(conn: psycopg2.extensions.connection, state: dict[str, Any], apply: bool) -> None:
    errors: list[str] = []
    operations: list[tuple[str, tuple[Any, ...]]] = []

    with conn.cursor() as cur:
        for row in state.get("judicial_actors", []):
            current_case_id = case_id(cur, row, errors)
            if current_case_id is None:
                continue
            actor_id = resolve_one(
                cur,
                "SELECT id FROM corruption_case_actors WHERE case_id = %s AND actor_label = %s",
                (current_case_id, row["actor_label"]),
                f"judicial actor {row['actor_label']}",
                errors,
            )
            politician_id = optional_id(
                cur, "politicians", "congress_id", row.get("politician_congress_id"),
                f"politician {row.get('politician_congress_id')}", errors
            )
            organization_id = optional_id(
                cur, "organizations", "normalized_name", row.get("organization_normalized_name"),
                f"organization {row.get('organization_normalized_name')}", errors
            )
            party_id = optional_id(
                cur, "parties", "name", row.get("party_name"),
                f"party {row.get('party_name')}", errors
            )
            if actor_id:
                operations.append(
                    (
                        """
                        UPDATE corruption_case_actors
                        SET review_status = %s, reviewed_at = %s, reviewed_by = %s,
                            review_notes = %s, politician_id = %s, organization_id = %s,
                            party_id = %s, updated_at = now()
                        WHERE id = %s
                        """,
                        (
                            row["review_status"], row.get("reviewed_at"), row.get("reviewed_by"),
                            row.get("review_notes"), politician_id, organization_id, party_id, actor_id,
                        ),
                    )
                )

        for row in state.get("judicial_links", []):
            current_case_id = case_id(cur, row, errors)
            if current_case_id is None:
                continue
            actor_id = None
            if row.get("actor_label"):
                actor_id = resolve_one(
                    cur,
                    "SELECT id FROM corruption_case_actors WHERE case_id = %s AND actor_label = %s",
                    (current_case_id, row["actor_label"]),
                    f"judicial link actor {row['actor_label']}",
                    errors,
                )
            organization_id = optional_id(
                cur, "organizations", "normalized_name", row.get("organization_normalized_name"),
                f"organization {row.get('organization_normalized_name')}", errors
            )
            contract_id = optional_id(
                cur, "contracts", "contract_folder_id", row.get("contract_folder_id"),
                f"contract {row.get('contract_folder_id')}", errors
            )
            subsidy_id = optional_id(
                cur, "subsidies", "bdns_id", row.get("subsidy_bdns_id"),
                f"subsidy {row.get('subsidy_bdns_id')}", errors
            )
            cur.execute(
                """
                SELECT id
                FROM corruption_contract_links
                WHERE case_id = %s
                  AND organization_id IS NOT DISTINCT FROM %s
                  AND contract_id IS NOT DISTINCT FROM %s
                  AND subsidy_id IS NOT DISTINCT FROM %s
                """,
                (current_case_id, organization_id, contract_id, subsidy_id),
            )
            existing_links = cur.fetchall()
            if len(existing_links) > 1:
                errors.append(
                    f"judicial link {row['case_source_type']}:{row['evidence_url']}: "
                    f"expected at most 1 match, found {len(existing_links)}"
                )
                continue
            if existing_links:
                operations.append(
                    (
                        """
                        UPDATE corruption_contract_links
                        SET case_actor_id = %s, link_reason = %s, evidence_url = %s,
                            review_status = %s, reviewed_at = %s, reviewed_by = %s,
                            raw_data = %s, updated_at = now()
                        WHERE id = %s
                        """,
                        (
                            actor_id, row["link_reason"], row["evidence_url"],
                            row["review_status"], row.get("reviewed_at"), row.get("reviewed_by"),
                            psycopg2.extras.Json(row.get("raw_data") or {}), existing_links[0][0],
                        ),
                    )
                )
            else:
                operations.append(
                    (
                        """
                        INSERT INTO corruption_contract_links (
                          case_id, case_actor_id, organization_id, contract_id, subsidy_id,
                          link_reason, evidence_url, review_status, reviewed_at, reviewed_by, raw_data
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            current_case_id, actor_id, organization_id, contract_id, subsidy_id,
                            row["link_reason"], row["evidence_url"], row["review_status"],
                            row.get("reviewed_at"), row.get("reviewed_by"),
                            psycopg2.extras.Json(row.get("raw_data") or {}),
                        ),
                    )
                )

        for row in state.get("lobbying_links", []):
            group_id = optional_id(
                cur, "lobbying_groups", "slug", row["lobbying_group_slug"],
                f"lobbying group {row['lobbying_group_slug']}", errors
            )
            organization_id = optional_id(
                cur, "organizations", "normalized_name", row["organization_normalized_name"],
                f"organization {row['organization_normalized_name']}", errors
            )
            operations.append(
                (
                    """
                    INSERT INTO lobbying_organization_links (
                      lobbying_group_id, organization_id, confidence, match_method, reviewed,
                      review_status, reviewed_at, reviewed_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (lobbying_group_id, organization_id) DO UPDATE SET
                      confidence = EXCLUDED.confidence,
                      match_method = EXCLUDED.match_method,
                      reviewed = EXCLUDED.reviewed,
                      review_status = EXCLUDED.review_status,
                      reviewed_at = EXCLUDED.reviewed_at,
                      reviewed_by = EXCLUDED.reviewed_by
                    """,
                    (
                        group_id, organization_id, row["confidence"], row["match_method"],
                        row["review_status"] == "reviewed", row["review_status"],
                        row.get("reviewed_at"), row.get("reviewed_by"),
                    ),
                )
            )

        for row in state.get("borme_matches", []):
            cur.execute(
                """
                SELECT bo.id
                FROM borme_officers bo
                JOIN organizations o ON o.id = bo.organization_id
                WHERE o.normalized_name = %s
                  AND bo.person_name = %s
                  AND bo.role IS NOT DISTINCT FROM %s
                  AND bo.company_slug = %s
                """,
                (
                    row["organization_normalized_name"], row["officer_name"],
                    row.get("officer_role"), row["company_slug"],
                ),
            )
            officer_rows = cur.fetchall()
            if len(officer_rows) != 1:
                errors.append(
                    f"BORME officer {row['organization_normalized_name']}:{row['officer_name']}: "
                    f"expected 1 match, found {len(officer_rows)}"
                )
                continue
            politician_id = optional_id(
                cur, "politicians", "congress_id", row["politician_congress_id"],
                f"politician {row['politician_congress_id']}", errors
            )
            operations.append(
                (
                    """
                    INSERT INTO borme_politician_matches (
                      borme_officer_id, politician_id, confidence, match_method, reviewed,
                      review_status, reviewed_at, reviewed_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (borme_officer_id, politician_id) DO UPDATE SET
                      confidence = EXCLUDED.confidence,
                      match_method = EXCLUDED.match_method,
                      reviewed = EXCLUDED.reviewed,
                      review_status = EXCLUDED.review_status,
                      reviewed_at = EXCLUDED.reviewed_at,
                      reviewed_by = EXCLUDED.reviewed_by
                    """,
                    (
                        officer_rows[0][0], politician_id, row["confidence"], row["match_method"],
                        row["review_status"] == "reviewed", row["review_status"],
                        row.get("reviewed_at"), row.get("reviewed_by"),
                    ),
                )
            )

        for row in state.get("revolving_door_candidates", []):
            candidate_id = resolve_one(
                cur,
                "SELECT id FROM revolving_door_candidates WHERE candidate_key = %s",
                (row["candidate_key"],),
                f"revolving-door candidate {row['candidate_key']}",
                errors,
            )
            if candidate_id:
                operations.append(
                    (
                        """
                        UPDATE revolving_door_candidates
                        SET status = %s, review_notes = %s, reviewed_at = %s,
                            reviewed_by = %s, updated_at = now()
                        WHERE id = %s
                        """,
                        (
                            row["status"], row.get("review_notes"), row.get("reviewed_at"),
                            row.get("reviewed_by"), candidate_id,
                        ),
                    )
                )

        for row in state.get("photo_decisions", []):
            politician_id = optional_id(
                cur, "politicians", "congress_id", row["politician_congress_id"],
                f"politician {row['politician_congress_id']}", errors
            )
            photo_id = resolve_one(
                cur,
                """
                SELECT id FROM politician_photo_versions
                WHERE politician_id = %s AND source = %s AND content_sha256 = %s
                """,
                (politician_id, row["source"], row["content_sha256"]),
                f"photo {row['politician_congress_id']}:{row['content_sha256']}",
                errors,
            )
            if photo_id:
                operations.append(
                    (
                        """
                        UPDATE politician_photo_versions
                        SET status = %s, rejection_reason = %s, is_active = %s, promoted_at = %s
                        WHERE id = %s
                        """,
                        (
                            row["status"], row.get("rejection_reason"), row["is_active"],
                            row.get("promoted_at"), photo_id,
                        ),
                    )
                )

        if errors:
            conn.rollback()
            raise RuntimeError("Unresolved critical backup references:\n- " + "\n- ".join(errors))

        if apply:
            for query, params in operations:
                cur.execute(query, params)
            conn.commit()
        else:
            conn.rollback()

    mode = "applied" if apply else "validated"
    print(f"Critical review state {mode}: {len(operations)} operations, 0 unresolved references")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    sub = parser.add_subparsers(dest="command", required=True)

    export_cmd = sub.add_parser("export")
    export_cmd.add_argument("output", type=Path)

    restore_cmd = sub.add_parser("restore")
    restore_cmd.add_argument("input", type=Path)
    restore_cmd.add_argument("--apply", action="store_true")

    args = parser.parse_args()
    if not args.database_url:
        parser.error("DATABASE_URL or --database-url is required")

    conn = psycopg2.connect(args.database_url)
    try:
        if args.command == "export":
            export_state(conn, args.output)
        else:
            state = json.loads(args.input.read_text())
            if state.get("version") != 1:
                raise RuntimeError(f"Unsupported critical backup version: {state.get('version')}")
            restore_state(conn, state, args.apply)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
