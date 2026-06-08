import os

import httpx
from openai import OpenAI

from app.config import settings

_SYSTEM_CA_BUNDLE = "/etc/ssl/certs/ca-certificates.crt"


def _ssl_verify() -> "str | bool":
    # Prefer the system CA bundle so that corporate SSL inspection proxies
    # (e.g. Fortinet) are trusted. Fall back to True (httpx default) if the
    # bundle is absent, which works in standard environments.
    if os.path.isfile(_SYSTEM_CA_BUNDLE):
        return _SYSTEM_CA_BUNDLE
    return True


def get_client() -> OpenAI:
    http_client = httpx.Client(verify=_ssl_verify())
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
        http_client=http_client,
    )
