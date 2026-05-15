"""Validate and normalize photo bytes.

Pipeline: download -> content-type/size validation -> Pillow open -> square crop
-> responsive WebP variants.
"""

import io
import hashlib
from dataclasses import dataclass
from typing import Optional, Iterable

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError

MIN_BYTES = 1024            # 1 KB — anything smaller is almost certainly an error page
MAX_BYTES = 10 * 1024 * 1024  # 10 MB — guard against huge originals
TARGET_SIZE = 512
WEBP_QUALITY = 85

_OK_PREFIXES = ("image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif")


class PhotoValidationError(Exception):
    pass


@dataclass(frozen=True)
class DownloadResult:
    data: bytes
    final_url: str
    content_type: str = "image/webp"
    etag: str | None = None
    last_modified: str | None = None


def download(url: str, *, user_agent: str = "Mozilla/5.0 (compatible; EspanaTransparente/1.0)",
             timeout: float = 30.0) -> bytes:
    """Download a photo with browser-like UA. Raises PhotoValidationError on failure."""
    return download_with_final_url(url, user_agent=user_agent, timeout=timeout).data


def download_with_final_url(
    url: str,
    *,
    user_agent: str = "Mozilla/5.0 (compatible; EspanaTransparente/1.0)",
    timeout: float = 30.0,
) -> DownloadResult:
    """Download a photo and return bytes plus the final redirect-resolved URL."""
    try:
        with httpx.Client(follow_redirects=True, timeout=timeout,
                          headers={"User-Agent": user_agent}) as client:
            resp = client.get(url)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise PhotoValidationError(f"download failed: {exc}") from exc

    ct = resp.headers.get("content-type", "").lower()
    if not any(ct.startswith(p) for p in _OK_PREFIXES):
        raise PhotoValidationError(f"unexpected content-type: {ct!r}")

    data = resp.content
    if len(data) < MIN_BYTES:
        raise PhotoValidationError(f"too small: {len(data)} bytes")
    if len(data) > MAX_BYTES:
        raise PhotoValidationError(f"too large: {len(data)} bytes")
    return DownloadResult(
        data=data,
        final_url=str(resp.url),
        content_type=ct,
        etag=resp.headers.get("etag"),
        last_modified=resp.headers.get("last-modified"),
    )


def _open_image(raw: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise PhotoValidationError(f"not a valid image: {exc}") from exc

    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return img


def _square_cover(img: Image.Image, *, size: int) -> Image.Image:
    rgba_img = img.convert("RGBA") if img.mode != "RGBA" else img
    # Bias the crop slightly upward because most source photos are headshots.
    squared = ImageOps.fit(
        rgba_img,
        (size, size),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.32),
    )
    return squared.convert("RGB")


def _encode_webp(img: Image.Image, *, quality: int = WEBP_QUALITY) -> bytes:
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue()


def to_webp_square(raw: bytes, *, size: int = TARGET_SIZE,
                   quality: int = WEBP_QUALITY) -> bytes:
    """Resize to a `size`x`size` WebP using cover-crop semantics."""
    img = _open_image(raw)
    squared = _square_cover(img, size=size)
    return _encode_webp(squared, quality=quality)


def build_responsive_variants(
    raw: bytes,
    *,
    sizes: Iterable[int] = (64, 128, 256, 512),
    quality: int = WEBP_QUALITY,
) -> dict[int, bytes]:
    """Generate deterministic square WebP variants from an image payload."""
    img = _open_image(raw)
    variants: dict[int, bytes] = {}
    for size in sorted(set(int(s) for s in sizes)):
        variants[size] = _encode_webp(_square_cover(img, size=size), quality=quality)
    return variants


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def average_hash_hex(raw: bytes, *, size: int = 8) -> str:
    """Simple perceptual hash for change detection across refreshes."""
    img = _open_image(raw).convert("L").resize((size, size), Image.Resampling.LANCZOS)
    pixels = list(img.tobytes())
    mean = sum(pixels) / len(pixels)
    bits = "".join("1" if px >= mean else "0" for px in pixels)
    return f"{int(bits, 2):0{size * size // 4}x}"


def fetch_and_normalize(url: str) -> Optional[bytes]:
    """Download + normalize. Returns WebP bytes, or None if validation fails.

    Logs the reason via print() so the pipeline output shows per-source failures.
    """
    try:
        raw = download(url)
        return to_webp_square(raw)
    except PhotoValidationError as exc:
        print(f"  ! validate failed for {url!s}: {exc}")
        return None
