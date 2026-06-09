"""Shared async HTTP client with timeout + retry for external APIs."""
from __future__ import annotations

from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings


class ExternalAPIError(Exception):
    """Raised when an external API call fails after retries."""


_USER_AGENT = "OrbitGuard-AI/1.0 (academic POC; FIAP Global Solution)"


def _retry():
    return retry(
        reraise=True,
        stop=stop_after_attempt(settings.http_retries + 1),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type(
            # OSError covers socket.gaierror (DNS) and other low-level failures
            (httpx.TransportError, httpx.HTTPStatusError, ExternalAPIError, OSError)
        ),
    )


@_retry()
async def fetch_text(url: str, params: dict[str, Any] | None = None) -> str:
    """GET a URL and return the raw text body. Raises ExternalAPIError on failure."""
    try:
        async with httpx.AsyncClient(
            timeout=settings.http_timeout, headers={"User-Agent": _USER_AGENT}
        ) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.text
    except httpx.HTTPError as exc:  # noqa: BLE001
        raise ExternalAPIError(f"GET {url} failed: {exc}") from exc


@_retry()
async def fetch_json(url: str, params: dict[str, Any] | None = None) -> Any:
    """GET a URL and return parsed JSON. Raises ExternalAPIError on failure."""
    try:
        async with httpx.AsyncClient(
            timeout=settings.http_timeout, headers={"User-Agent": _USER_AGENT}
        ) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as exc:  # noqa: BLE001
        raise ExternalAPIError(f"GET {url} failed: {exc}") from exc
