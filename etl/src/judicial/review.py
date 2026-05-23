"""Review judicial actor and contract-link candidates.

Usage:
    PYTHONPATH=src python -m judicial.review list-actors
    PYTHONPATH=src python -m judicial.review approve-actor <actor_id> --reviewed-by ruben
    PYTHONPATH=src python -m judicial.review reject-actor <actor_id> --reviewed-by ruben --notes "..."
    PYTHONPATH=src python -m judicial.review approve-link <link_id> --reviewed-by ruben
"""

from __future__ import annotations

import argparse

import psycopg2.extras

from common.db import get_pg_conn


def list_rows(table: str, status: str, limit: int) -> None:
    with get_pg_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            if table == "actors":
                cur.execute(
                    """
                    SELECT a.id, c.title, a.actor_label, a.actor_type, a.role,
                           a.match_confidence, a.created_at
                    FROM corruption_case_actors a
                    JOIN corruption_cases c ON c.id = a.case_id
                    WHERE a.review_status = %s
                    ORDER BY a.created_at DESC
                    LIMIT %s
                    """,
                    (status, limit),
                )
                for row in cur.fetchall():
                    print(
                        f"{row['id']} | {row['actor_label']} | {row['actor_type']} | "
                        f"{row['role'] or '-'} | conf={row['match_confidence'] or '-'} | {row['title'][:80]}"
                    )
            else:
                cur.execute(
                    """
                    SELECT l.id, c.title, l.link_reason, l.organization_id,
                           l.contract_id, l.subsidy_id, l.created_at
                    FROM corruption_contract_links l
                    JOIN corruption_cases c ON c.id = l.case_id
                    WHERE l.review_status = %s
                    ORDER BY l.created_at DESC
                    LIMIT %s
                    """,
                    (status, limit),
                )
                for row in cur.fetchall():
                    target = row["contract_id"] or row["subsidy_id"] or row["organization_id"]
                    print(f"{row['id']} | {target} | {row['link_reason']} | {row['title'][:80]}")


def set_actor_status(actor_id: str, status: str, reviewed_by: str | None, notes: str | None) -> None:
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE corruption_case_actors
                SET review_status = %s,
                    reviewed_at = now(),
                    reviewed_by = %s,
                    review_notes = %s,
                    updated_at = now()
                WHERE id = %s
                """,
                (status, reviewed_by, notes, actor_id),
            )
            if cur.rowcount == 0:
                raise SystemExit(f"Actor not found: {actor_id}")
            conn.commit()
    print(f"{status}: actor {actor_id}")


def set_link_status(link_id: str, status: str, reviewed_by: str | None) -> None:
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE corruption_contract_links
                SET review_status = %s,
                    reviewed_at = now(),
                    reviewed_by = %s,
                    updated_at = now()
                WHERE id = %s
                """,
                (status, reviewed_by, link_id),
            )
            if cur.rowcount == 0:
                raise SystemExit(f"Link not found: {link_id}")
            conn.commit()
    print(f"{status}: link {link_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    for name, table in (("list-actors", "actors"), ("list-links", "links")):
        p = sub.add_parser(name)
        p.set_defaults(table=table)
        p.add_argument("--status", default="needs_review")
        p.add_argument("--limit", type=int, default=25)

    approve_actor = sub.add_parser("approve-actor")
    approve_actor.add_argument("actor_id")
    approve_actor.add_argument("--reviewed-by")
    approve_actor.add_argument("--notes")

    reject_actor = sub.add_parser("reject-actor")
    reject_actor.add_argument("actor_id")
    reject_actor.add_argument("--reviewed-by")
    reject_actor.add_argument("--notes")

    approve_link = sub.add_parser("approve-link")
    approve_link.add_argument("link_id")
    approve_link.add_argument("--reviewed-by")

    reject_link = sub.add_parser("reject-link")
    reject_link.add_argument("link_id")
    reject_link.add_argument("--reviewed-by")

    args = parser.parse_args()
    if args.command in {"list-actors", "list-links"}:
        list_rows(args.table, args.status, args.limit)
    elif args.command == "approve-actor":
        set_actor_status(args.actor_id, "reviewed", args.reviewed_by, args.notes)
    elif args.command == "reject-actor":
        set_actor_status(args.actor_id, "rejected", args.reviewed_by, args.notes)
    elif args.command == "approve-link":
        set_link_status(args.link_id, "reviewed", args.reviewed_by)
    elif args.command == "reject-link":
        set_link_status(args.link_id, "rejected", args.reviewed_by)


if __name__ == "__main__":
    main()
