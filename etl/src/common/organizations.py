"""Helpers for normalized organizations shared across ETL pipelines."""

import re
import unicodedata


def normalize_organization_name(name: str | None) -> str:
    cleaned = unicodedata.normalize("NFKD", name or "")
    cleaned = "".join(c for c in cleaned if not unicodedata.combining(c))
    cleaned = cleaned.lower()
    cleaned = re.sub(r"\b(s\.?a\.?|s\.?l\.?|sa|sl|plc|ltd|inc)\b", "", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def upsert_organization(
    cur,
    *,
    name: str,
    organization_type: str,
    sector: str | None = None,
    source_url: str | None = None,
) -> str:
    normalized = normalize_organization_name(name)
    cur.execute(
        """
        INSERT INTO organizations (name, normalized_name, organization_type, sector, source_url)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (normalized_name) DO UPDATE SET
          name = EXCLUDED.name,
          organization_type = CASE
            WHEN organizations.organization_type = 'other' THEN EXCLUDED.organization_type
            ELSE organizations.organization_type
          END,
          sector = coalesce(EXCLUDED.sector, organizations.sector),
          source_url = coalesce(EXCLUDED.source_url, organizations.source_url),
          updated_at = now()
        RETURNING id
        """,
        (name, normalized, organization_type, sector, source_url),
    )
    return cur.fetchone()[0]
