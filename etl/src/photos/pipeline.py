"""Pipeline orchestrator: pick politicians needing photos, try each source in
priority order, persist first successful match."""

from dataclasses import dataclass
from typing import Iterable, Optional

import psycopg2.extras

from common.db import get_pg_conn

from .sources import ALL_SOURCES
from .sources.base import PhotoSource, PoliticianRow, SourceMatch
from .storage import politician_key, upload_photo, from_storage_url


@dataclass
class RunOptions:
    dry_run: bool = False
    refresh_missing: bool = True
    max_age_days: Optional[int] = None  # if set, also refresh photos older than this
    only_congress_id: Optional[str] = None
    only_source: Optional[str] = None   # restrict to a single source by name


@dataclass
class RunStats:
    candidates: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
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
               COALESCE(
                 (SELECT array_agg(DISTINCT rp.position_type::text)
                  FROM responsibility_positions rp
                  WHERE rp.politician_id = p.id),
                 ARRAY[]::text[]
               ) AS position_types
        FROM politicians p
        WHERE {where_sql}
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
        )
        for r in rows
    ]


def _persist(politician: PoliticianRow, match: SourceMatch, *, dry_run: bool) -> str:
    """Upload bytes to Storage and update DB. Returns the final public URL.

    If Supabase Storage is unavailable (missing key or auth failure) the pipeline
    falls back to storing the source CDN URL directly. This is valid for Wikimedia
    (upload.wikimedia.org allows hotlinking); sources that block hotlinking
    (Congreso) do not set source_url and are skipped in that case.
    """
    from .storage import StorageError, politician_key, public_url, upload_photo

    key = politician_key(politician.congress_id)
    if dry_run:
        final_url = match.source_url or public_url(key)
        return final_url

    final_url: str
    try:
        final_url = upload_photo(match.photo_bytes, key)
    except StorageError as exc:
        if match.source_url:
            print(f"  ! Storage unavailable ({exc}); using hotlink URL as fallback")
            final_url = match.source_url
        else:
            raise

    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE politicians
                SET photo_url = %s,
                    photo_source = %s,
                    photo_updated_at = now(),
                    photo_attempts = 0,
                    wikidata_qid = COALESCE(%s, wikidata_qid),
                    updated_at = now()
                WHERE id = %s
                """,
                (final_url, match.source, match.wikidata_qid, politician.id),
            )
        conn.commit()
    return final_url


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
                print(f"  ! [{source.name}] {pol.full_name}: source raised {exc!r}")
                continue
            if match is not None:
                break

        if match is None:
            stats.failed += 1
            print(f"  - no source matched {pol.full_name} ({pol.congress_id})")
            _bump_attempts(pol.id, dry_run=opts.dry_run)
            continue

        url = _persist(pol, match, dry_run=opts.dry_run)
        stats.updated += 1
        stats.by_source[match.source] = stats.by_source.get(match.source, 0) + 1
        print(f"  ✓ {pol.full_name}: source={match.source} url={url}")

    print(
        f"\nDone. candidates={stats.candidates} "
        f"updated={stats.updated} failed={stats.failed} "
        f"by_source={stats.by_source}"
    )
    return stats
