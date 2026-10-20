"""Defesa em profundidade barata: cabeçalhos seguros e limite de corpo nas rotas públicas de autenticação."""

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

AUTH_PREFIX = "/api/v1/auth"
AUTH_BODY_LIMIT = 16 * 1024  # os pedidos de autenticação são JSON minúsculo
SECURITY_HEADERS: list[tuple[bytes, bytes]] = [
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"x-frame-options", b"DENY"),
]


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
                extra = [(k, v) for k, v in SECURITY_HEADERS if k not in present]
                message["headers"] = [*message.get("headers", []), *extra]
            await send(message)

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
