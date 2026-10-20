"""Defesa em profundidade barata: CSRF por Origin/Referer, cabeçalhos seguros e limite de corpo em `/auth`.

Cabeçalhos: em produção o nginx do `web` já acrescenta nosniff, X-Frame-Options e Referrer-Policy (e a CSP);
a API repetir os mesmos duplicava-os na resposta. Por isso só os acrescenta em desenvolvimento (sem nginx) e, sempre,
o que o nginx não tem (`Cache-Control: no-store` nas respostas de autenticação).
"""

import json
from urllib.parse import urlsplit

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from novelo.core.config import get_settings

AUTH_PREFIX = "/api/v1/auth"
AUTH_BODY_LIMIT = 16 * 1024  # os pedidos de autenticação são JSON minúsculo
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
SECURITY_HEADERS: list[tuple[bytes, bytes]] = [
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"x-frame-options", b"DENY"),
]


def origin_of(url: str) -> str | None:
    """`esquema://host[:porta]` em minúsculas, ou `None` (vazio, `null`, sem esquema ou sem host)."""
    parts = urlsplit(url.strip())
    if not parts.scheme or not parts.hostname:
        return None
    port = f":{parts.port}" if parts.port else ""
    return f"{parts.scheme.lower()}://{parts.hostname.lower()}{port}"


def allowed_origins() -> set[str]:
    """Origens que podem fazer pedidos de escrita com cookies: `CORS_ORIGINS` e `APP_URL`."""
    s = get_settings()
    found = {o for o in (origin_of(u) for u in [*s.cors_origins, s.app_url]) if o}
    if s.environment == "development":  # localhost e 127.0.0.1 são o mesmo sítio no desenvolvimento
        found |= {o.replace("//localhost", "//127.0.0.1") for o in found} | {
            o.replace("//127.0.0.1", "//localhost") for o in found
        }
    return found


def cross_site_write(method: str, headers: dict[bytes, bytes]) -> bool:
    """CSRF: escrita cujo `Origin` (ou, sem ele, `Referer`) não é uma origem nossa. Sem nenhum dos dois (clientes
    que não são browsers) passa: o ataque exige um browser, e o browser envia sempre `Origin` nas escritas."""
    if method not in UNSAFE_METHODS:
        return False
    origin = headers.get(b"origin")
    source = origin if origin is not None else headers.get(b"referer")
    if source is None:
        return False
    return origin_of(source.decode("latin-1")) not in allowed_origins()


def _json_response(status: int, code: str, message: str) -> tuple[Message, Message]:
    body = json.dumps({"code": code, "message": message}).encode()
    start: Message = {
        "type": "http.response.start",
        "status": status,
        "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
    }
    return start, {"type": "http.response.body", "body": body}


class HardeningMiddleware:
    """ASGI puro. Rejeita com 413 corpos grandes em `/auth` (pela declaração `Content-Length`)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                present = {k for k, _ in message.get("headers", [])}
                wanted = list(SECURITY_HEADERS) if get_settings().environment == "development" else []
                if scope["path"].startswith(AUTH_PREFIX):
                    wanted.append((b"cache-control", b"no-store"))
                extra = [(k, v) for k, v in wanted if k not in present]
                message["headers"] = [*message.get("headers", []), *extra]
            await send(message)

        if cross_site_write(scope["method"], dict(scope["headers"])):
            start, body_msg = _json_response(403, "forbidden", "Cross-site request blocked")
            await send_wrapper(start)
            await send_wrapper(body_msg)
            return
        if scope["method"] == "POST" and scope["path"].startswith(AUTH_PREFIX):
            declared = dict(scope["headers"]).get(b"content-length", b"0")
            if declared.isdigit() and int(declared) > AUTH_BODY_LIMIT:
                body = json.dumps({"code": "bad_request", "message": "Request body too large"}).encode()
                await send_wrapper(
                    {
                        "type": "http.response.start",
                        "status": 413,
                        "headers": [
                            (b"content-type", b"application/json"),
                            (b"content-length", str(len(body)).encode()),
                        ],
                    }
                )
                await send_wrapper({"type": "http.response.body", "body": body})
                return
        await self.app(scope, receive, send_wrapper)
