"""Small helpers for building the public search corpus from ETL data."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import re
import unicodedata


@dataclass(frozen=True)
class SearchDocument:
    entity_type: str
    entity_id: str
    title: str
    subtitle: str | None = None
    body: str | None = None
    key_fact: str | None = None
    route: str | None = None
    source_url: str | None = None


def normalize_search_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", ascii_text.strip().lower())


def normalize_alias(value: str | None) -> str:
    text = normalize_search_text(value)
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def content_hash(value: str | None) -> str:
    return sha256(normalize_search_text(value).encode("utf-8")).hexdigest()


def chunk_text(text: str, max_chars: int = 1200, overlap: int = 160) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []
    if max_chars <= overlap:
        raise ValueError("max_chars must be greater than overlap")

    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + max_chars, len(cleaned))
        if end < len(cleaned):
            split_at = cleaned.rfind(". ", start, end)
            if split_at > start + max_chars // 2:
                end = split_at + 1
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start = max(0, end - overlap)
    return chunks


def build_search_document(
    *,
    entity_type: str,
    entity_id: str,
    title: str | None,
    subtitle: str | None = None,
    body_parts: list[str | None] | None = None,
    key_fact: str | None = None,
    route: str | None = None,
    source_url: str | None = None,
) -> SearchDocument | None:
    clean_title = title.strip() if title else ""
    if not clean_title:
        return None

    body = " ".join(part.strip() for part in body_parts or [] if part and part.strip())
    return SearchDocument(
        entity_type=entity_type,
        entity_id=entity_id,
        title=clean_title,
        subtitle=subtitle.strip() if subtitle else None,
        body=body or None,
        key_fact=key_fact.strip() if key_fact else None,
        route=route,
        source_url=source_url,
    )
