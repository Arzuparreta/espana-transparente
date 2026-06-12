"""Supabase Storage wrapper for the politician-photos bucket."""

import os
import re
import unicodedata
from typing import Optional

import httpx

BUCKET = "politician-photos"

SUPABASE_URL = (os.getenv("SUPABASE_URL")
                or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
                or "").rstrip("/")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


class StorageError(Exception):
    pass


def _require_service_key() -> str:
    if not SUPABASE_URL:
        raise StorageError("SUPABASE_URL is required for photo uploads")
    if not SERVICE_ROLE_KEY:
        raise StorageError(
            "SUPABASE_SERVICE_ROLE_KEY is required for photo uploads "
            "(set it in the environment / GitHub Actions secrets)"
        )
    return SERVICE_ROLE_KEY


def _auth_headers(token: str) -> dict[str, str]:
    """Support both legacy JWT service_role keys and new sb_secret keys."""
    headers = {"apikey": token}
    if not token.startswith("sb_"):
        headers["Authorization"] = f"Bearer {token}"
    return headers


def public_url(key: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{key}"


def upload_photo(data: bytes, key: str, *, content_type: str = "image/webp") -> str:
    """Upload `data` to `bucket/key` with upsert. Returns the public URL."""
    token = _require_service_key()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}"
    headers = {
        **_auth_headers(token),
        "Content-Type": content_type,
        "x-upsert": "true",
        "Cache-Control": "max-age=604800",  # 7 days — pipeline owns refresh cadence
    }
    try:
        resp = httpx.post(url, content=data, headers=headers, timeout=60.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        body = getattr(getattr(exc, "response", None), "text", "")
        raise StorageError(f"upload failed for {key}: {exc} {body}") from exc
    return public_url(key)


def upload_variants(variants: dict[int, bytes], *, congress_id: str, content_hash: str) -> dict[str, str]:
    """Upload immutable responsive variants keyed by content hash."""
    urls: dict[str, str] = {}
    for size, data in sorted(variants.items()):
        key = politician_variant_key(congress_id, content_hash, size)
        urls[str(size)] = upload_photo(data, key)
    return urls


def ensure_bucket(*, public: bool = True) -> None:
    """Create the politician-photos bucket if it doesn't exist. Idempotent."""
    token = _require_service_key()
    headers = {**_auth_headers(token), "Content-Type": "application/json"}

    get = httpx.get(f"{SUPABASE_URL}/storage/v1/bucket/{BUCKET}", headers=headers, timeout=30.0)
    if get.status_code == 200:
        return
    if get.status_code not in (400, 404):
        raise StorageError(f"unexpected status fetching bucket: {get.status_code} {get.text}")

    payload = {
        "id": BUCKET,
        "name": BUCKET,
        "public": public,
        "file_size_limit": 10 * 1024 * 1024,
        "allowed_mime_types": ["image/webp", "image/jpeg", "image/png"],
    }
    create = httpx.post(f"{SUPABASE_URL}/storage/v1/bucket", headers=headers,
                        json=payload, timeout=30.0)
    if create.status_code not in (200, 201):
        raise StorageError(f"create bucket failed: {create.status_code} {create.text}")


def politician_key(congress_id: str) -> str:
    """Legacy public-object path for compatibility with older tests/callers."""
    return f"politicians/{_slugify(congress_id)}.webp"


def politician_variant_key(congress_id: str, content_hash: str, size: int) -> str:
    return f"politicians/{_slugify(congress_id)}/{content_hash}/{size}.webp"


def public_official_variant_key(slug: str, content_hash: str, size: int) -> str:
    return f"public-officials/{slug}/{content_hash}/{size}.webp"


def _slugify(value: str) -> str:
    nfkd = unicodedata.normalize("NFKD", value)
    ascii_slug = "".join(c for c in nfkd if not unicodedata.combining(c)).lower()
    ascii_slug = re.sub(r"[^a-z0-9._-]+", "-", ascii_slug).strip("-")
    ascii_slug = re.sub(r"-{2,}", "-", ascii_slug)
    return ascii_slug


# Public alias for reuse outside this module (e.g. public_officials_wikidata.py).
slugify = _slugify


def from_storage_url(url: Optional[str]) -> bool:
    """True if `url` looks like one of ours (used to decide whether to refresh)."""
    if not url:
        return False
    return f"/storage/v1/object/public/{BUCKET}/" in url
