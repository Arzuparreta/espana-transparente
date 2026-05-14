"""Helpers for multilevel responsibility loading and money-data normalization."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import re
import unicodedata


def normalize_public_body(value: str | None) -> str | None:
    if not value:
        return None
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"\s+", " ", normalized).strip().upper()
    return normalized or None


def administration_level_from_bdns(nivel1: str | None) -> str | None:
    mapping = {
        "ESTADO": "state",
        "AUTONOMICA": "autonomic",
        "LOCAL": "municipal",
    }
    return mapping.get((nivel1 or "").upper())


def infer_contract_administration_level(
    awarding_body_normalized: str | None, ministry_normalized: str | None
) -> str | None:
    if ministry_normalized:
        return "state"

    body = awarding_body_normalized or ""
    if "AYUNTAMIENTO DE " in body or body.startswith("AYUNTAMIENTO DE "):
        return "municipal"

    autonomic_markers = (
        "CONSEJERIA ",
        "JUNTA DE ",
        "GOBIERNO DE ",
        "GENERALITAT ",
        "XUNTA DE ",
        "GOBIERNO VASCO",
        "PRINCIPADO DE ASTURIAS",
    )
    if any(marker in body for marker in autonomic_markers):
        return "autonomic"

    return None


def infer_municipal_territory(body_normalized: str | None) -> str | None:
    if not body_normalized:
        return None
    if body_normalized.startswith("AYUNTAMIENTO DE "):
        return body_normalized.replace("AYUNTAMIENTO DE ", "", 1).strip() or None
    return None


def month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return start, end


def iter_months(start: date, end: date) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    cursor = date(start.year, start.month, 1)
    last = date(end.year, end.month, 1)
    while cursor <= last:
        months.append((cursor.year, cursor.month))
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return months


def iter_date_chunks(start: date, end: date, days: int) -> list[tuple[date, date]]:
    chunks: list[tuple[date, date]] = []
    cursor = start
    while cursor <= end:
        chunk_end = min(end, cursor + timedelta(days=days - 1))
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return chunks


@dataclass(slots=True)
class ResponsibilityPosition:
    administration_level: str
    position_type: str
    territory_name: str | None
    territory_code: str | None
    organization_name: str
    organization_aliases: list[str]
    person_name: str
    political_party: str | None
    government: str | None
    start_date: str
    end_date: str | None
    source_url: str | None


@dataclass(slots=True)
class PublicBodyMapEntry:
    body_normalized: str
    administration_level: str
    territory_name: str | None
    territory_code: str | None
    ministry_or_department_normalized: str
    match_strategy: str
    start_date: str
    end_date: str | None
    source_url: str | None
