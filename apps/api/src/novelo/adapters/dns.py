"""Consulta DNS por DoH (Cloudflare) com timeout curto: sem dependências novas. Só lê registos públicos."""

import logging
from typing import Protocol

import httpx

log = logging.getLogger(__name__)
DOH_URL = "https://cloudflare-dns.com/dns-query"


class DnsResolver(Protocol):
    async def query(self, name: str, rtype: str) -> list[str] | None:
        """Valores do registo (TXT sem aspas); lista vazia se não existe; `None` se a consulta falhou."""
        ...


class DohResolver:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None, timeout_s: float = 3.0) -> None:
        self._transport, self._timeout = transport, timeout_s

    async def query(self, name: str, rtype: str) -> list[str] | None:
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as http:
                resp = await http.get(
                    DOH_URL, params={"name": name, "type": rtype}, headers={"accept": "application/dns-json"}
                )
            resp.raise_for_status()
            body = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("DNS (DoH) falhou: %s", exc.__class__.__name__)
            return None
        answers = body.get("Answer") or []
        values: list[str] = []
        for a in answers:
            data = str(a.get("data", ""))
            if rtype == "TXT":
                data = data.replace('" "', "").strip('"')
            values.append(data)
        return values


def get_dns_resolver() -> DnsResolver:
    return DohResolver()
