import ssl

import httpx
from openai import OpenAI


def _build_ssl_context() -> ssl.SSLContext:
    # ssl.create_default_context() enables VERIFY_X509_STRICT which rejects
    # CA certs that lack AKI/SKI extensions (e.g. Fortinet SSL inspection
    # proxies). Using SSLContext(PROTOCOL_TLS_CLIENT) + load_default_certs()
    # keeps hostname verification and full cert validation but skips that
    # strict flag, so the corporate CA is accepted.
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.load_default_certs()
    return ctx


def get_client(api_key: str) -> OpenAI:
    http_client = httpx.Client(verify=_build_ssl_context())
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        http_client=http_client,
    )
