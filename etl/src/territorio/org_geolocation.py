"""ETL: resolve the location of organizations (the receptors of public money).

"¿A dónde llega el dinero?" needs the receptor's location. We resolve it from two
deterministic signals, in priority order:

  1. **Public-body name match** — "AYUNTAMIENTO DE X" / municipal companies, via
     ``common.responsibility.infer_municipal_territory`` matched against the INE
     municipality catalog (``src.territorio.municipios``). Gives municipio +
     province. High confidence; ambiguity-safe (unique match only).
  2. **CIF province heuristic** — the two digits after the CIF letter encode the
     province of first registration for most company CIFs. Gives province only.
     Medium confidence.

Resolved locations are written to ``organizations`` and then denormalized onto
contracts (``contractor_*_key``) and subsidies (``beneficiary_*_key``) so the
hub can answer "dinero que llega aquí" and "empresas de aquí" with an index.

Coverage is partial (orgs without a NIF or a matchable name stay NULL); every
attempted org is stamped ``geolocated_at`` so ``--resume`` skips it next run
instead of retrying. Re-run without ``--resume`` to re-resolve everything after
improving the heuristics. Batches with ``--limit`` like ``borme.officers``.

Usage:
    PYTHONPATH=src python -m src.territorio.org_geolocation --limit 500 --resume
    PYTHONPATH=src python -m src.territorio.org_geolocation --dry-run
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass

import psycopg2.extras

from common.db import get_pg_conn
from common.organizations import normalize_nif
from common.responsibility import infer_municipal_territory, normalize_public_body
from territorio.municipios import PROVINCE_INE_TO_KEY, name_variants, normalize_name

# Org CIF: type letter (excluding personal K/L/M and unused I/O/T) + 7 digits +
# control char. The two digits after the letter are the province of registration.
_CIF_RE = re.compile(r"^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$")


def cif_province_key(nif: str | None) -> str | None:
    cleaned = normalize_nif(nif)
    if not cleaned or not _CIF_RE.match(cleaned):
        return None
    return PROVINCE_INE_TO_KEY.get(cleaned[1:3])


@dataclass(frozen=True)
class OrgLocation:
    municipality_key: str | None
    province_key: str | None
    source: str  # 'name_match' | 'cif'
    confidence: float


def resolve_org_location(
    name: str | None,
    nif: str | None,
    name_index: dict[str, list[str]],
    province_of: dict[str, str | None],
) -> OrgLocation | None:
    """Resolve a single organization to a location, or None if unresolvable."""
    town = infer_municipal_territory(normalize_public_body(name))
    if town:
        keys = name_index.get(normalize_name(town))
        if keys and len(keys) == 1:
            muni = keys[0]
            return OrgLocation(muni, province_of.get(muni), "name_match", 0.9)

    province = cif_province_key(nif)
    if province:
        return OrgLocation(None, province, "cif", 0.5)

    return None


def build_municipio_maps(cur) -> tuple[dict[str, list[str]], dict[str, str | None]]:
    cur.execute(
        "SELECT territory_key, territory_name, parent_key FROM territory_catalog WHERE territory_type = 'municipality'"
    )
    name_index: dict[str, list[str]] = {}
    province_of: dict[str, str | None] = {}
    for key, name, parent in cur.fetchall():
        province_of[key] = parent
        for variant in name_variants(name):
            name_index.setdefault(variant, []).append(key)
    return name_index, province_of


def backfill_org_nif_from_contracts(cur) -> int:
    """Sync organizations.nif from contracts.contractor_nif (which the PCSP feed
    has carried all along). Orgs created before the nif column have it NULL, so
    the CIF heuristic can't fire until this runs. Idempotent: only fills NULLs,
    and clears geolocated_at for newly-NIF'd unlocated orgs so --resume retries
    them with the CIF signal now available."""
    cur.execute(
        """
        UPDATE organizations o SET
          nif = src.nif,
          geolocated_at = CASE WHEN o.province_key IS NULL THEN NULL ELSE o.geolocated_at END
        FROM (
          SELECT DISTINCT ON (contractor_organization_id)
                 contractor_organization_id AS org_id,
                 upper(regexp_replace(contractor_nif, '[^A-Za-z0-9]', '', 'g')) AS nif
          FROM contracts
          WHERE contractor_organization_id IS NOT NULL AND contractor_nif IS NOT NULL
          ORDER BY contractor_organization_id, date DESC NULLS LAST
        ) src
        WHERE o.id = src.org_id AND o.nif IS NULL AND src.nif <> ''
        """
    )
    return cur.rowcount


def geolocate_orgs(cur, *, limit: int | None, resume: bool) -> tuple[int, int]:
    """Resolve a batch of organizations. Returns (attempted, located)."""
    name_index, province_of = build_municipio_maps(cur)
    if not name_index and not PROVINCE_INE_TO_KEY:
        return 0, 0

    where = "WHERE geolocated_at IS NULL" if resume else ""
    limit_clause = "LIMIT %s" if limit else ""
    params = (limit,) if limit else ()
    cur.execute(
        f"SELECT id, name, nif FROM organizations {where} ORDER BY created_at {limit_clause}",
        params,
    )
    rows = cur.fetchall()
    if not rows:
        return 0, 0

    attempted = [(org_id,) for org_id, _, _ in rows]
    located: list[tuple] = []
    for org_id, name, nif in rows:
        loc = resolve_org_location(name, nif, name_index, province_of)
        if loc:
            located.append((org_id, loc.municipality_key, loc.province_key, loc.source, loc.confidence))

    # Stamp every attempted org so --resume does not retry it; fill location for
    # the resolved ones (coalesce keeps any prior/manual value on re-runs).
    cur.execute(
        "CREATE TEMP TABLE _geo (id uuid PRIMARY KEY, muni text, prov text, src text, conf numeric) ON COMMIT DROP"
    )
    if located:
        psycopg2.extras.execute_values(
            cur, "INSERT INTO _geo (id, muni, prov, src, conf) VALUES %s", located
        )
    psycopg2.extras.execute_values(
        cur, "INSERT INTO _geo (id) VALUES %s ON CONFLICT (id) DO NOTHING", attempted
    )
    cur.execute(
        """
        UPDATE organizations o SET
          municipality_key = coalesce(g.muni, o.municipality_key),
          province_key = coalesce(g.prov, o.province_key),
          location_source = coalesce(g.src, o.location_source),
          location_confidence = coalesce(g.conf, o.location_confidence),
          geolocated_at = now()
        FROM _geo g
        WHERE o.id = g.id
        """
    )
    cur.execute("DROP TABLE IF EXISTS _geo")
    return len(attempted), len(located)


def backfill_receptor_keys(cur) -> tuple[int, int]:
    """Denormalize the receptor org location onto contracts/subsidies."""
    cur.execute(
        """
        UPDATE contracts c SET
          contractor_province_key = o.province_key,
          contractor_municipality_key = o.municipality_key
        FROM organizations o
        WHERE c.contractor_organization_id = o.id
          AND o.province_key IS NOT NULL
          AND (c.contractor_province_key IS DISTINCT FROM o.province_key
               OR c.contractor_municipality_key IS DISTINCT FROM o.municipality_key)
        """
    )
    contracts_updated = cur.rowcount

    cur.execute(
        """
        UPDATE subsidies s SET
          beneficiary_province_key = o.province_key,
          beneficiary_municipality_key = o.municipality_key
        FROM organizations o
        WHERE s.beneficiary_organization_id = o.id
          AND o.province_key IS NOT NULL
          AND (s.beneficiary_province_key IS DISTINCT FROM o.province_key
               OR s.beneficiary_municipality_key IS DISTINCT FROM o.municipality_key)
        """
    )
    subsidies_updated = cur.rowcount

    return contracts_updated, subsidies_updated


def run(*, dry_run: bool = False, limit: int | None = None, resume: bool = False) -> tuple[int, int, int, int]:
    conn = get_pg_conn()
    cur = conn.cursor()

    if dry_run:
        name_index, province_of = build_municipio_maps(cur)
        cur.execute(
            "SELECT id, name, nif FROM organizations ORDER BY created_at LIMIT 200"
        )
        sample = cur.fetchall()
        located = sum(
            1 for _, name, nif in sample if resolve_org_location(name, nif, name_index, province_of)
        )
        conn.close()
        print(f"Dry run: {located}/{len(sample)} of a 200-org sample resolved; no writes")
        return len(sample), located, 0, 0

    nif_synced = backfill_org_nif_from_contracts(cur)
    conn.commit()
    print(f"Synced NIF onto {nif_synced} organizations from contracts")

    attempted, located = geolocate_orgs(cur, limit=limit, resume=resume)
    conn.commit()
    print(f"Geolocated: {located}/{attempted} organizations in this batch")

    contracts_updated, subsidies_updated = backfill_receptor_keys(cur)
    conn.commit()
    print(f"Backfilled receptor keys: {contracts_updated} contracts, {subsidies_updated} subsidies")

    cur.close()
    conn.close()
    return attempted, located, contracts_updated, subsidies_updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Resolve organization locations")
    parser.add_argument("--limit", type=int, default=None, help="Max orgs to process this batch")
    parser.add_argument("--resume", action="store_true", help="Skip orgs already attempted (geolocated_at set)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(dry_run=args.dry_run, limit=args.limit, resume=args.resume)


if __name__ == "__main__":
    main()
