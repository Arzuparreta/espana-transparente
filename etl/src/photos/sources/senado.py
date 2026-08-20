"""Senado official source: re-hosts the portrait senado.es already publishes.

Senators arrive from `senado.py` with `photo_url` already pointing at the
official senado.es portrait, so there is nothing to look up — the job is to
pull those bytes into our own versioned Storage pipeline so senators get the
same responsive variants as deputies. Until then the frontend falls back to the
senado.es URL directly, which works for visitors but is unoptimized.

senado.es sits behind Akamai and refuses datacenter traffic on the static
`/legisNN/senadores/fotos/` path even with full browser headers, so this source
is expected to be unavailable from the VPS runner. `CIRCUIT_BREAK_AFTER`
consecutive network failures retire it for the rest of the run rather than
letting it re-fail once per senator: a blocked source is one fact, not 191.
"""

from typing import Optional

from common.http_headers import BROWSER_UA

from ..validate import PhotoValidationError, download_with_final_url, to_webp_square
from .base import PhotoSource, PoliticianRow, SourceMatch

SENADO_PHOTO_PREFIX = "https://www.senado.es/legis"
CIRCUIT_BREAK_AFTER = 3

IMAGE_HEADERS = {
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": "https://www.senado.es/",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-origin",
}


class SenadoOficialSource:
    name = "senado_oficial"
    priority = 2

    def __init__(self) -> None:
        self._consecutive_failures = 0
        self._retired = False

    def find(self, politician: PoliticianRow) -> Optional[SourceMatch]:
        url = politician.photo_url
        if not url or not url.startswith(SENADO_PHOTO_PREFIX):
            return None
        if self._retired:
            return None

        try:
            downloaded = download_with_final_url(
                url, user_agent=BROWSER_UA, extra_headers=IMAGE_HEADERS
            )
            normalized = to_webp_square(downloaded.data)
        except PhotoValidationError as exc:
            self._consecutive_failures += 1
            if self._consecutive_failures >= CIRCUIT_BREAK_AFTER:
                self._retired = True
                print(
                    f"[senado_oficial] retired for this run after "
                    f"{self._consecutive_failures} consecutive failures "
                    f"(last: {exc}) — senate portraits stay on their source URL"
                )
            else:
                print(f"[senado_oficial] {politician.full_name}: {exc}")
            return None

        self._consecutive_failures = 0
        return SourceMatch(
            photo_bytes=normalized,
            source=self.name,
            source_url=downloaded.final_url,
            source_etag=downloaded.etag,
            source_last_modified=downloaded.last_modified,
        )
