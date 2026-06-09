"""Pipeline orchestrator: pick politicians needing photos, try each source in
priority order, persist first successful match."""

import json
from dataclasses import dataclass
from typing import Optional

import psycopg2.extras

from common.db import get_pg_conn

from .sources import ALL_SOURCES
from .sources.base import PhotoSource, PoliticianRow, SourceMatch
from .storage import upload_variants
from .validate import average_hash_hex, build_responsive_variants, sha256_hex


@dataclass
class RunOptions:
    dry_run: bool = False
    refresh_missing: bool = True
    max_age_days: Optional[int] = None
    only_congress_id: Optional[str] = None
    only_source: Optional[str] = None   # restrict to a single source by name


@dataclass
class RunStats:
    candidates: int = 0
    updated: int = 0
    skipped: int = 0
    unmatched: int = 0
    failed: int = 0
    source_errors: int = 0
    by_source: dict[str, int] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.by_source is None:
            self.by_source = {}


def _select_candidates(opts: RunOptions) -> list[PoliticianRow]:
    """Load politicians needing a photo.

    Refresh policy:
      - photo_url is NULL (never had one, or was reset by migration)
      - photo_url is older than max_age_days
      - --only forces a single row regardless of state
    """
    where = []
    params: list = []
    if opts.only_congress_id:
        where.append("p.congress_id = %s")
        params.append(opts.only_congress_id)
    else:
        clauses = []
        if opts.refresh_missing:
            clauses.append("p.photo_url IS NULL")
        if opts.max_age_days is not None:
            clauses.append(
                "(p.photo_updated_at IS NULL OR p.photo_updated_at < now() - interval %s)"
            )
            params.append(f"{opts.max_age_days} days")
        if not clauses:
            clauses = ["p.photo_url IS NULL"]
        where.append("(" + " OR ".join(clauses) + ")")

    where_sql = " AND ".join(where) if where else "TRUE"
    if opts.only_congress_id:
        candidate_where_sql = where_sql
    else:
        candidate_where_sql = (
            f"({where_sql}) OR "
            "(p.photo_url IS NOT NULL AND (p.photo_version_id IS NULL OR p.photo_variants IS NULL))"
        )

    sql = f"""
        SELECT p.id::text AS id, p.congress_id, p.full_name, p.first_name, p.last_name,
               p.cod_parlamentario, p.wikidata_qid,
               (
                 SELECT party.acronym
                 FROM politician_memberships pm
                 JOIN parties party ON party.id = pm.party_id
                 JOIN legislatures l ON l.id = pm.legislature_id
                 WHERE pm.politician_id = p.id AND l.is_active = true
                 ORDER BY pm.start_date DESC NULLS LAST
                 LIMIT 1
               ) AS party_acronym,
               (
                 SELECT l.number
                 FROM politician_memberships pm
                 JOIN legislatures l ON l.id = pm.legislature_id
                 WHERE pm.politician_id = p.id AND l.is_active = true
                 ORDER BY pm.start_date DESC NULLS LAST
                 LIMIT 1
               ) AS active_legislature_number,
               COALESCE(
                 (SELECT array_agg(DISTINCT rp.position_type::text)
                  FROM responsibility_positions rp
                  WHERE rp.politician_id = p.id),
                 ARRAY[]::text[]
               ) AS position_types
        FROM politicians p
        WHERE {candidate_where_sql}
        ORDER BY p.full_name
    """
    with get_pg_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    return [
        PoliticianRow(
            id=r["id"],
            congress_id=r["congress_id"],
            full_name=r["full_name"],
            first_name=r["first_name"] or "",
            last_name=r["last_name"] or "",
            cod_parlamentario=r["cod_parlamentario"],
            wikidata_qid=r["wikidata_qid"],
            party_acronym=r["party_acronym"],
            position_types=tuple(r["position_types"] or ()),
            active_legislature_number=r["active_legislature_number"],
        )
        for r in rows
    ]


def _source_priority(source_name: str) -> int:
    for source in ALL_SOURCES:
        if source.name == source_name:
            return source.priority
    raise ValueError(f"Unknown photo source priority for {source_name!r}")


def _should_promote(*, current: Optional[dict], candidate_source: str, candidate_hash: str) -> bool:
    if current is None:
        return True
    if current["source"] == candidate_source:
        return current["content_sha256"] != candidate_hash
    return _source_priority(candidate_source) < _source_priority(current["source"])


def _persist(politician: PoliticianRow, match: SourceMatch, *, dry_run: bool) -> tuple[str, bool]:
    """Upload immutable variants and promote the candidate if it wins.

    Returns `(public_url, promoted)`.
    """
    variants = build_responsive_variants(match.photo_bytes)
    content_hash = sha256_hex(variants[max(variants)])
    perceptual_hash = average_hash_hex(variants[max(variants)])

    if dry_run:
        final_url = f"dry-run://politicians/{politician.congress_id}/{content_hash}/256.webp"
        return final_url, True

    variant_urls = upload_variants(
        variants,
        congress_id=politician.congress_id,
        content_hash=content_hash,
    )
    primary_url = variant_urls.get("256") or variant_urls[str(max(variants))]

    with get_pg_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, source, source_priority, content_sha256
                FROM politician_photo_versions
                WHERE politician_id = %s AND is_active = true
                ORDER BY promoted_at DESC NULLS LAST, created_at DESC
                LIMIT 1
                """,
                (politician.id,),
            )
            current = cur.fetchone()
            if current is None:
                cur.execute(
                    """
                    SELECT photo_url, photo_source
                    FROM politicians
                    WHERE id = %s
                    """,
                    (politician.id,),
                )
                legacy = cur.fetchone()
                if legacy and legacy["photo_url"] and legacy["photo_source"]:
                    current = {
                        "id": None,
                        "source": legacy["photo_source"],
                        "source_priority": _source_priority(legacy["photo_source"]),
                        "content_sha256": None,
                    }

            cur.execute(
                """
                INSERT INTO politician_photo_versions (
                    politician_id, source, source_priority, source_url,
                    source_etag, source_last_modified, content_sha256,
                    perceptual_hash, variants, is_active, status, promoted_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, false, 'superseded', NULL)
                ON CONFLICT (politician_id, source, content_sha256)
                DO UPDATE SET
                    source_url = EXCLUDED.source_url,
                    source_etag = EXCLUDED.source_etag,
                    source_last_modified = EXCLUDED.source_last_modified,
                    variants = EXCLUDED.variants
                RETURNING id
                """,
                (
                    politician.id,
                    match.source,
                    _source_priority(match.source),
                    match.source_url,
                    match.source_etag,
                    match.source_last_modified,
                    content_hash,
                    perceptual_hash,
                    json.dumps(variant_urls),
                ),
            )
            candidate_id = cur.fetchone()["id"]

            should_promote = bool(
                current and str(current["id"]) == str(candidate_id)
            ) or _should_promote(
                current=current,
                candidate_source=match.source,
                candidate_hash=content_hash,
            )
            if should_promote:
                cur.execute(
                    """
                    UPDATE politician_photo_versions
                    SET is_active = false,
                        status = 'superseded'
                    WHERE politician_id = %s AND is_active = true AND id <> %s
                    """,
                    (politician.id, candidate_id),
                )
                cur.execute(
                    """
                    UPDATE politician_photo_versions
                    SET is_active = true,
                        status = 'active',
                        promoted_at = now(),
                        rejection_reason = NULL
                    WHERE id = %s
                    """,
                    (candidate_id,),
                )
                safe_wikidata_qid = match.wikidata_qid
                if safe_wikidata_qid:
                    cur.execute(
                        "SELECT 1 FROM politicians WHERE wikidata_qid = %s AND id <> %s LIMIT 1",
                        (safe_wikidata_qid, politician.id),
                    )
                    if cur.fetchone():
                        safe_wikidata_qid = None
                cur.execute(
                    """
                    UPDATE politicians
                    SET photo_url = %s,
                        photo_variants = %s::jsonb,
                        photo_version_id = %s,
                        photo_source = %s,
                        photo_updated_at = now(),
                        photo_attempts = 0,
                        wikidata_qid = COALESCE(%s, wikidata_qid),
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (
                        primary_url,
                        json.dumps(variant_urls),
                        candidate_id,
                        match.source,
                        safe_wikidata_qid,
                        politician.id,
                    ),
                )
            else:
                cur.execute(
                    """
                    UPDATE politician_photo_versions
                    SET is_active = false,
                        status = 'rejected',
                        rejection_reason = %s
                    WHERE id = %s
                    """,
                    ("lower-priority-than-current", candidate_id),
                )
                cur.execute(
                    """
                    UPDATE politicians
                    SET photo_attempts = 0,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (politician.id,),
                )
        conn.commit()
    return primary_url, should_promote


def _bump_attempts(politician_id: str, *, dry_run: bool) -> None:
    if dry_run:
        return
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE politicians SET photo_attempts = photo_attempts + 1 WHERE id = %s",
                (politician_id,),
            )
        conn.commit()


def _active_sources(opts: RunOptions) -> list[PhotoSource]:
    sources = sorted(ALL_SOURCES, key=lambda s: s.priority)
    if opts.only_source:
        sources = [s for s in sources if s.name == opts.only_source]
        if not sources:
            raise ValueError(f"Unknown source: {opts.only_source!r}. "
                             f"Available: {[s.name for s in ALL_SOURCES]}")
    return sources


def run(opts: RunOptions) -> RunStats:
    stats = RunStats()
    candidates = _select_candidates(opts)
    stats.candidates = len(candidates)
    sources = _active_sources(opts)

    print(f"Photos pipeline: {len(candidates)} candidate(s), "
          f"{len(sources)} source(s) [{', '.join(s.name for s in sources)}], "
          f"dry_run={opts.dry_run}")

    for pol in candidates:
        match: Optional[SourceMatch] = None
        for source in sources:
            try:
                match = source.find(pol)
            except Exception as exc:  # noqa: BLE001 — never let one bad row kill the run
                stats.source_errors += 1
                print(f"  ! [{source.name}] {pol.full_name}: source raised {exc!r}")
                continue
            if match is not None:
                break

        if match is None:
            stats.unmatched += 1
            print(f"  - no source matched {pol.full_name} ({pol.congress_id})")
            _bump_attempts(pol.id, dry_run=opts.dry_run)
            continue

        url, promoted = _persist(pol, match, dry_run=opts.dry_run)
        if promoted:
            stats.updated += 1
        else:
            stats.skipped += 1
        stats.by_source[match.source] = stats.by_source.get(match.source, 0) + 1
        status = "promoted" if promoted else "stored-not-promoted"
        print(f"  ✓ {pol.full_name}: source={match.source} status={status} url={url}")

    print(
        f"\nDone. candidates={stats.candidates} "
        f"updated={stats.updated} skipped={stats.skipped} unmatched={stats.unmatched} "
        f"failed={stats.failed} source_errors={stats.source_errors} "
        f"by_source={stats.by_source}"
    )
    return stats
