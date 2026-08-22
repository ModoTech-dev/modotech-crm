"""
Extracts latitude/longitude from a Google Maps link, so agents can paste
a link the way they'd share one in any other chat app, instead of
manually typing coordinates.

Handles two cases:
- Direct URLs (most common — copied from the address bar, or from
  Maps' own "Share" button in many cases): coordinates are embedded
  right in the URL, e.g. .../place/Some+Place/@-1.2921,36.8219,15z
- Short links (maps.app.goo.gl, goo.gl/maps/...): these carry NO
  coordinates in the URL itself — the link only resolves to real
  coordinates after following its redirect, which requires an actual
  HTTP request. We only do this network round-trip when the direct
  patterns fail, so the common case stays fast.
"""
import re
from urllib.parse import unquote

import requests

_COORD_PATTERNS = [
    re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)"),       # .../@lat,lng,zoom — most common
    re.compile(r"[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)"),  # ?q=lat,lng
    re.compile(r"[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)"), # ?ll=lat,lng — older format
]
_PLACE_NAME_PATTERN = re.compile(r"/place/([^/@]+)")


def _try_extract_coords(url: str) -> tuple[float, float] | None:
    for pattern in _COORD_PATTERNS:
        match = pattern.search(url)
        if match:
            return float(match.group(1)), float(match.group(2))
    return None


def _extract_place_name(url: str) -> str:
    match = _PLACE_NAME_PATTERN.search(url)
    if not match:
        return ""
    return unquote(match.group(1)).replace("+", " ")


def parse_google_maps_url(url: str) -> dict | None:
    """Returns {"latitude", "longitude", "name"} or None if no
    coordinates could be found, even after resolving redirects."""
    coords = _try_extract_coords(url)
    resolved_url = url

    if not coords:
        try:
            # A real User-Agent matters here — some redirect services
            # behave differently (or refuse) for obvious non-browser
            # clients.
            resp = requests.get(
                url, allow_redirects=True, timeout=10,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ModotechCRM/1.0)"},
            )
            resolved_url = resp.url
            coords = _try_extract_coords(resolved_url)
        except requests.RequestException:
            return None

    if not coords:
        return None

    latitude, longitude = coords
    return {"latitude": latitude, "longitude": longitude, "name": _extract_place_name(resolved_url)}
