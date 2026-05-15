"""Congreso official source: downloads the official portrait via cod_parlamentario."""

import time
from typing import Optional

from ..validate import PhotoValidationError, download_with_final_url, to_webp_square
from .base import PhotoSource, PoliticianRow, SourceMatch

REQUEST_DELAY = 1.5  # CLAUDE.md: do not lower this for congreso.es


class CongresoOficialSource:
    name = "congreso_oficial"
    priority = 1

    def __init__(self) -> None:
        self._last_request_at: float = 0.0

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < REQUEST_DELAY:
            time.sleep(REQUEST_DELAY - elapsed)
        self._last_request_at = time.monotonic()

    def find(self, politician: PoliticianRow) -> Optional[SourceMatch]:
        if not politician.cod_parlamentario:
            return None
        legislature_number = politician.active_legislature_number or 15
        url = (
            "https://www.congreso.es/docu/imgweb/diputados/"
            f"{politician.cod_parlamentario}_{legislature_number}.jpg"
        )
        self._throttle()
        try:
            downloaded = download_with_final_url(url)
            normalized = to_webp_square(downloaded.data)
        except PhotoValidationError as exc:
            print(f"[congreso_oficial] {politician.full_name} ({politician.cod_parlamentario}): {exc}")
            return None
        return SourceMatch(
            photo_bytes=normalized,
            source=self.name,
            source_url=downloaded.final_url,
            source_etag=downloaded.etag,
            source_last_modified=downloaded.last_modified,
        )
