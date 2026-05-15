"""Base classes for photo sources."""

from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass(frozen=True)
class PoliticianRow:
    """Subset of `politicians` needed to look up a photo.

    `position_types` is derived from responsibility_positions (e.g. 'alcalde',
    'consejero', 'ministro') and lets level-specific sources narrow their search.
    Empty for plain deputies who only hold a parliamentary seat.
    """
    id: str
    congress_id: str
    full_name: str
    first_name: str
    last_name: str
    cod_parlamentario: Optional[str]
    wikidata_qid: Optional[str]
    party_acronym: Optional[str]
    position_types: tuple[str, ...] = ()
    active_legislature_number: Optional[int] = None


@dataclass(frozen=True)
class SourceMatch:
    """A successful photo lookup.

    photo_bytes is already validated + normalized (512x512 WebP) by the source.
    wikidata_qid is set when the match is anchored on a Wikidata entity, so the
    pipeline can persist it for stable matching next run.

    source_url is the original CDN URL of the image (before downloading). When
    stored, it gives us provenance and refresh hints (ETag / Last-Modified).
    """
    photo_bytes: bytes
    source: str
    wikidata_qid: Optional[str] = None
    source_url: Optional[str] = None
    source_etag: Optional[str] = None
    source_last_modified: Optional[str] = None


class PhotoSource(Protocol):
    """Implement `name`, `priority`, and `find()`. Lower priority runs first."""

    name: str
    priority: int

    def find(self, politician: PoliticianRow) -> Optional[SourceMatch]:
        ...
