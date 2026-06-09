"""Review lobbying group ↔ organization link candidates.

Usage:
    PYTHONPATH=src python -m src.lobbying.review list-links
    PYTHONPATH=src python -m src.lobbying.review list-links --reviewed false --limit 50
    PYTHONPATH=src python -m src.lobbying.review approve-link <link_id> --reviewed-by ruben
    PYTHONPATH=src python -m src.lobbying.review reject-link <link_id>
    PYTHONPATH=src python -m src.lobbying.review approve-high-confidence --min-confidence 0.85
"""

from __future__ import annotations

import argparse

import psycopg2.extras

from common.db import get_pg_conn


def list_links(reviewed: bool | None, limit: int) -> None:
    where = ""
    params: list[object] = []
    if reviewed is not None:
        where = "WHERE lol.reviewed = %s"
        params.append(reviewed)

    with get_pg_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                f"""
                SELECT
                  lol.id,
                  lg.name AS group_name,
                  o.name AS org_name,
                  lol.confidence,
                  lol.match_method,
                  lol.reviewed,
                  lol.review_status,
                  lg.source_url
                FROM lobbying_organization_links lol
                JOIN lobbying_groups lg ON lg.id = lol.lobbying_group_id
                JOIN organizations o ON o.id = lol.organization_id
                {where}
                ORDER BY lol.confidence DESC NULLS LAST, lg.name
                LIMIT %s
                """,
                (*params, limit),
            )
            rows = cur.fetchall()

    if not rows:
        print("No links found.")
        return

    for row in rows:
        status = row["review_status"]
        print(
            f"{row['id']} | {status} | conf={row['confidence']} | "
            f"{row['group_name'][:50]} → {row['org_name'][:50]}"
        )


def approve_link(link_id: str, reviewed_by: str | None) -> None:
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE lobbying_organization_links
                SET reviewed = true,
                    review_status = 'reviewed',
                    reviewed_at = now(),
                    reviewed_by = %s
                WHERE id = %s
                """,
                (reviewed_by, link_id),
            )
            if cur.rowcount == 0:
                raise SystemExit(f"Link not found: {link_id}")
            conn.commit()
    who = f" by {reviewed_by}" if reviewed_by else ""
    print(f"approved{who}: link {link_id}")


def reject_link(link_id: str, reviewed_by: str | None) -> None:
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE lobbying_organization_links
                SET reviewed = false,
                    review_status = 'rejected',
                    reviewed_at = now(),
                    reviewed_by = %s
                WHERE id = %s
                """,
                (reviewed_by, link_id),
            )
            if cur.rowcount == 0:
                raise SystemExit(f"Link not found: {link_id}")
            conn.commit()
    who = f" by {reviewed_by}" if reviewed_by else ""
    print(f"rejected{who}: link {link_id}")


def approve_high_confidence(min_confidence: float, reviewed_by: str | None) -> None:
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE lobbying_organization_links
                SET reviewed = true,
                    review_status = 'reviewed',
                    reviewed_at = now(),
                    reviewed_by = %s
                WHERE reviewed = false
                  AND review_status <> 'rejected'
                  AND confidence >= %s
                RETURNING id
                """,
                (reviewed_by, min_confidence),
            )
            ids = [row[0] for row in cur.fetchall()]
            conn.commit()

    who = f" by {reviewed_by}" if reviewed_by else ""
    print(f"approved {len(ids)} links{who} with confidence >= {min_confidence}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    list_cmd = sub.add_parser("list-links")
    list_cmd.add_argument(
        "--reviewed",
        choices=("true", "false"),
        default=None,
        help="Filter by review status (default: all)",
    )
    list_cmd.add_argument("--limit", type=int, default=50)

    approve_cmd = sub.add_parser("approve-link")
    approve_cmd.add_argument("link_id")
    approve_cmd.add_argument("--reviewed-by")

    reject_cmd = sub.add_parser("reject-link")
    reject_cmd.add_argument("link_id")
    reject_cmd.add_argument("--reviewed-by")

    bulk_cmd = sub.add_parser("approve-high-confidence")
    bulk_cmd.add_argument("--min-confidence", type=float, default=0.85)
    bulk_cmd.add_argument("--reviewed-by")

    args = parser.parse_args()

    if args.command == "list-links":
        reviewed = {"true": True, "false": False}.get(args.reviewed) if args.reviewed else None
        list_links(reviewed, args.limit)
    elif args.command == "approve-link":
        approve_link(args.link_id, args.reviewed_by)
    elif args.command == "reject-link":
        reject_link(args.link_id, args.reviewed_by)
    elif args.command == "approve-high-confidence":
        approve_high_confidence(args.min_confidence, args.reviewed_by)


if __name__ == "__main__":
    main()
