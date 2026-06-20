"""Helpers for normalized organizations shared across ETL pipelines."""

import hashlib
import re
import unicodedata


def normalize_organization_name(name: str | None) -> str:
    cleaned = unicodedata.normalize("NFKD", name or "")
    cleaned = "".join(c for c in cleaned if not unicodedata.combining(c))
    cleaned = cleaned.lower()
    cleaned = re.sub(r"\b(s\.?a\.?|s\.?l\.?|sa|sl|plc|ltd|inc)\b", "", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def organization_collision_key(name: str, normalized: str | None = None) -> str:
    """Return a stable unique key for distinct labels with the same normalized form."""
    base = normalized if normalized is not None else normalize_organization_name(name)
    digest = hashlib.md5(name.strip().casefold().encode("utf-8")).hexdigest()[:16]
    return f"{base} {digest}"


def normalize_nif(nif: str | None) -> str | None:
    """Uppercase, strip spaces/punctuation from a NIF/CIF. None if empty."""
    if not nif:
        return None
    cleaned = re.sub(r"[^A-Za-z0-9]", "", nif).upper()
    return cleaned or None


def upsert_organization(
    cur,
    *,
    name: str,
    organization_type: str,
    sector: str | None = None,
    source_url: str | None = None,
    nif: str | None = None,
) -> str:
    normalized = normalize_organization_name(name)
    display_name = name.strip()
    nif = normalize_nif(nif)
    if not normalized or not display_name:
        raise ValueError("organization name must normalize to a non-empty value")

    organization_type_conflict_update = """
      organization_type = CASE
        WHEN organizations.organization_type = 'other' THEN EXCLUDED.organization_type
        ELSE organizations.organization_type
      END,
      sector = coalesce(EXCLUDED.sector, organizations.sector),
      source_url = coalesce(EXCLUDED.source_url, organizations.source_url),
      nif = coalesce(EXCLUDED.nif, organizations.nif),
      updated_at = now()
    """

    # First try the canonical normalized key. If another source label already
    # owns that key, do not overwrite its name: preserve both identities.
    cur.execute(
        """
        INSERT INTO organizations (name, normalized_name, organization_type, sector, source_url, nif)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (normalized_name) DO NOTHING
        RETURNING id
        """,
        (display_name, normalized, organization_type, sector, source_url, nif),
    )
    row = cur.fetchone()
    if row:
        return row[0]

    cur.execute(
        f"""
        UPDATE organizations
        SET
          organization_type = CASE
            WHEN organizations.organization_type = 'other' THEN %s
            ELSE organizations.organization_type
          END,
          sector = coalesce(%s, organizations.sector),
          source_url = coalesce(%s, organizations.source_url),
          nif = coalesce(%s, organizations.nif),
          updated_at = now()
        WHERE normalized_name = %s
          AND lower(trim(name)) = lower(trim(%s))
        RETURNING id
        """,
        (organization_type, sector, source_url, nif, normalized, display_name),
    )
    row = cur.fetchone()
    if row:
        return row[0]

    collision_key = organization_collision_key(display_name, normalized)
    cur.execute(
        f"""
        INSERT INTO organizations (name, normalized_name, organization_type, sector, source_url, nif)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (normalized_name) DO UPDATE SET
          {organization_type_conflict_update}
        RETURNING id
        """,
        (display_name, collision_key, organization_type, sector, source_url, nif),
    )
    return cur.fetchone()[0]
