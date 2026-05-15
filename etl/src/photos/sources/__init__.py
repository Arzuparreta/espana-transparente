"""Photo sources, ordered by priority (lower = preferred).

Add new sources by appending to ALL_SOURCES. The pipeline tries each in order
until one returns valid bytes for a given politician.
"""

from .base import PhotoSource, PoliticianRow, SourceMatch
from .wikidata import WikidataSource
from .congreso import CongresoOficialSource
from .alcaldes_wikidata import AlcaldesWikidataSource

ALL_SOURCES: list[PhotoSource] = [
    CongresoOficialSource(),     # priority 1: retrato oficial del Congreso
    WikidataSource(),            # priority 2: P1768 / nombre + Commons P18
    AlcaldesWikidataSource(),    # priority 3: Wikidata vía P39 = alcalde de <municipio>
]

__all__ = [
    "PhotoSource",
    "PoliticianRow",
    "SourceMatch",
    "ALL_SOURCES",
    "WikidataSource",
    "CongresoOficialSource",
    "AlcaldesWikidataSource",
]
