"""Logs em JSON, um objeto por linha, com request_id em cada pedido."""

import json
import logging
import time
import uuid
from contextvars import ContextVar
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Engine
from starlette.types import ASGIApp, Message, Receive, Scope, Send

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
# Contador de consultas SQL do pedido em curso (só existe com LOG_LEVEL=debug, ver `install_query_counter`).
_query_count_var: ContextVar[list[int] | None] = ContextVar("query_count", default=None)
# Campos estruturados que o middleware acrescenta ao registo do pedido (agregáveis por rota e duração).
_REQUEST_FIELDS = ("method", "route", "status", "duration_ms", "queries")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        for key in _REQUEST_FIELDS:
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())


def _count_query(*_: Any) -> None:
    counter = _query_count_var.get()
    if counter is not None:
        counter[0] += 1


def install_query_counter(engine: Engine) -> None:
    """Conta as consultas SQL de cada pedido (modo debug): apanha N+1 ao ler o log, sem mexer no código."""
    if not event.contains(engine, "before_cursor_execute", _count_query):
        event.listen(engine, "before_cursor_execute", _count_query)


def _route_template(scope: Scope) -> str:
    """`/api/v1/planning/scenarios/{scenario_id}`: o caminho com os parâmetros por nome (a rota guarda o relativo)."""
    if scope.get("route") is None:
        return "unmatched"
    template: str = scope["path"]
    for name, value in (scope.get("path_params") or {}).items():
        template = template.replace(f"/{value}", f"/{{{name}}}", 1)
    return template


class RequestLoggingMiddleware:
    """ASGI puro (sem BaseHTTPMiddleware) para não prender ligações à base de dados."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.log = logging.getLogger("novelo.request")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        rid = uuid.uuid4().hex[:12]
        request_id_var.set(rid)
        started = time.perf_counter()
        status = 500
        counter = [0] if self.log.isEnabledFor(logging.DEBUG) else None
        _query_count_var.set(counter)

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", rid.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            ms = (time.perf_counter() - started) * 1000
            # `route` é o modelo (`/scenarios/{scenario_id}`), não o URL com ids: é o que se pode agregar para p95.
            route = _route_template(scope)
            fields: dict[str, Any] = {
                "method": scope["method"],
                "route": route,
                "status": status,
                "duration_ms": round(ms, 1),
            }
            if counter is not None:
                fields["queries"] = counter[0]
            self.log.info("%s %s %s %.0fms", scope["method"], scope["path"], status, ms, extra=fields)
