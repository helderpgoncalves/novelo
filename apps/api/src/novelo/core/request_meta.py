"""Origem do pedido (IP e user-agent) para a auditoria."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request

from novelo.core.ratelimit import client_ip


@dataclass(frozen=True)
class RequestMeta:
    ip: str | None
    user_agent: str | None


def get_request_meta(request: Request) -> RequestMeta:
    ip = client_ip(request)
    ua = request.headers.get("user-agent")
    return RequestMeta(ip[:45] if ip and ip != "unknown" else None, ua[:255] if ua else None)


Meta = Annotated[RequestMeta, Depends(get_request_meta)]
