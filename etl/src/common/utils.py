"""utility functions for name normalization and fuzzy matching"""

import re
import unicodedata

from common.responsibility import normalize_public_body


def normalize_ministry(name: str | None) -> str | None:
    """UPPERCASE, strip accents, collapse whitespace.

    Used to align ministry names from BDNS and PCSP with `government_positions.organization_name`.
    Preserves punctuation (commas, ampersands) since ministry names contain them.
    """
    return normalize_public_body(name)


def extract_ministry_from_body(body: str | None) -> str | None:
    """Find the 'Ministerio de X' substring inside a free-text awarding body."""
    if not body:
        return None
    m = re.search(r"Ministerio[^.]*", body)
    return normalize_ministry(m.group(0)) if m else None


def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = name.encode("ascii", "ignore").decode("ascii")
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)
    name = re.sub(r"[^a-z\s]", "", name)
    return name


def parse_spanish_full_name(full_name: str) -> tuple[str, str]:
    """Split 'Apellido1 Apellido2, Nombre' or 'Nombre Apellido1 Apellido2'"""
    full_name = full_name.strip()
    if "," in full_name:
        surnames, first = full_name.split(",", 1)
        return first.strip(), surnames.strip()
    parts = full_name.split()
    if len(parts) >= 3:
        return " ".join(parts[:-2]), " ".join(parts[-2:])
    elif len(parts) == 2:
        return parts[0], parts[1]
    return full_name, ""


def extract_congress_id(url_or_id: str) -> str | None:
    """Extract congress internal ID from URL or string"""
    match = re.search(r"/(\d+)$", url_or_id)
    if match:
        return match.group(1)
    if url_or_id.isdigit():
        return url_or_id
    return None
