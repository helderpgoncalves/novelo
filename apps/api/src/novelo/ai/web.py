"""Pesquisa na web do copiloto: tipos, configuração dos server tools do OpenRouter e higiene do que entra e sai.

Funções puras (sem rede). Regras:
- O que vem da web é DADO não confiável: limpa-se, corta-se e descartam-se frases que parecem instruções.
- As consultas saem da UE e não podem levar dados pessoais nem números internos do Novelo.
- Os números dos excertos servem para o verificador os reconhecer como «externos»; nunca entram em contas nem KPIs.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlsplit

from novelo.core.config import Settings

MAX_QUERY_CHARS = 200
MAX_CITATIONS = 8
EXCERPT_CHARS_MODEL = 1200  # o que o modelo lê de cada resultado
EXCERPT_CHARS_UI = 280  # excerto curto mostrado nas fontes
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_UUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE)
_LONG_DIGITS = re.compile(r"(?<!\d)(?:\+?\d[\d ]{7,}\d)(?!\d)")  # telefone, NIF, cartão
_URL_CREDENTIALS = re.compile(r"https?://[^/\s]*@", re.IGNORECASE)
_SECRET = re.compile(r"\b(sk-[A-Za-z0-9_-]{10,}|api[_ -]?key|password|palavra[- ]passe|bearer)\b", re.IGNORECASE)
_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
_YEAR = re.compile(r"^(19|20)\d{2}$")
_INVISIBLE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff\u00ad]")
_TAGS = re.compile(r"<[^>]{1,200}>")


@dataclass(frozen=True)
class WebCitation:
    """Uma fonte web (anotação `url_citation` do OpenRouter), já limpa."""

    url: str
    title: str
    domain: str
    content: str


@dataclass
class WebSearchResult:
    query: str
    citations: list[WebCitation] = field(default_factory=list)
    requests: int = 0  # `usage.server_tool_use.web_search_requests`
    cost_usd: float | None = None


class WebSearchUnavailableError(Exception):
    """O fornecedor não oferece pesquisa neste pedido (região sem motor, ZDR, função não disponível)."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


# --- Server tools -----------------------------------------------------------------------------------


@dataclass(frozen=True)
class ServerTools:
    """Quais server tools do OpenRouter vão num pedido e com que limites."""

    web_search: bool = False
    web_fetch: bool = False
    datetime: bool = False
    engine: str = "auto"
    max_results: int = 5
    max_calls: int = 3
    max_cost_usd: float = 0.0
    context_size: str = "low"
    allowed_domains: tuple[str, ...] = ()
    excluded_domains: tuple[str, ...] = ()
    fetch_allowed: tuple[str, ...] = ()
    fetch_blocked: tuple[str, ...] = ()
    fetch_max_tokens: int = 12000
    timezone: str = "Europe/Lisbon"

    @property
    def any(self) -> bool:
        return self.web_search or self.web_fetch or self.datetime

    def search_tool(self, *, max_uses: int | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {
            "engine": self.engine,
            "max_results": self.max_results,
            "max_total_results": self.max_results * (max_uses or self.max_calls),
            "search_context_size": self.context_size,
        }
        if max_uses:
            params["max_uses"] = max_uses
        # `allowed_domains` e `excluded_domains` não se combinam (Perplexity, Firecrawl): ganha a lista de permitidos
        if self.allowed_domains:
            params["allowed_domains"] = list(self.allowed_domains)
        elif self.excluded_domains:
            params["excluded_domains"] = list(self.excluded_domains)
        return {"type": "openrouter:web_search", "parameters": params}

    def tools(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if self.web_search:
            out.append(self.search_tool(max_uses=self.max_calls))
        if self.web_fetch:
            fetch: dict[str, Any] = {"max_uses": 2, "max_content_tokens": self.fetch_max_tokens}
            if self.fetch_allowed:
                fetch["allowed_domains"] = list(self.fetch_allowed)
            if self.fetch_blocked:
                fetch["blocked_domains"] = list(self.fetch_blocked)
            out.append({"type": "openrouter:web_fetch", "parameters": fetch})
        if self.datetime:
            out.append({"type": "openrouter:datetime", "parameters": {"timezone": self.timezone}})
        return out

    def stop_when(self) -> list[dict[str, Any]]:
        """Condições do ciclo de server tools (substituem `max_tool_calls`): passos e teto de gasto por pedido."""
        steps = (self.max_calls if self.web_search else 0) + (2 if self.web_fetch else 0) + (1 if self.datetime else 0)
        out: list[dict[str, Any]] = [{"type": "step_count_is", "step_count": max(1, steps)}]
        if self.max_cost_usd > 0:
            out.append({"type": "max_cost", "max_cost_in_dollars": self.max_cost_usd})
        return out


def server_tools_from(s: Settings, *, search: bool, fetch: bool) -> ServerTools:
    """Configuração a partir do ambiente. `search` e `fetch` dizem se este pedido os pode usar."""
    return ServerTools(
        web_search=search and s.web_search_available,
        web_fetch=fetch and s.web_fetch_enabled and s.web_region_supported,
        datetime=s.server_tools_datetime_enabled,
        engine=s.web_search_engine_effective,
        max_results=s.web_search_max_results,
        max_calls=s.web_search_max_calls,
        max_cost_usd=s.web_search_max_cost_usd,
        context_size=s.web_search_context_size,
        allowed_domains=tuple(s.domains(s.web_search_allowed_domains)),
        excluded_domains=tuple(s.domains(s.web_search_excluded_domains)),
        fetch_allowed=tuple(s.domains(s.web_fetch_allowed_domains)),
        fetch_blocked=tuple(s.domains(s.web_fetch_blocked_domains)),
        fetch_max_tokens=s.web_fetch_max_content_tokens,
        timezone=s.server_tools_timezone,
    )


# --- Higiene do que sai (consultas) -----------------------------------------------------------------
# ruff: noqa: PLR0911


def _is_identifier(digits: str) -> bool:
    """Telefone, NIF ou cartão; uma sequência de anos («novidades 2025 2026») não é um identificador."""
    return not all(_YEAR.match(t) for t in digits.lstrip("+").split())


def sanitize_query(
    query: str, *, forbidden_terms: tuple[str, ...] = (), internal_numbers: frozenset[float] = frozenset()
) -> tuple[str | None, str | None]:
    """(consulta limpa, motivo da recusa). A consulta tem de ser genérica: sem pessoas, contas nem números internos."""
    q = _INVISIBLE.sub("", unicodedata.normalize("NFKC", query))
    q = re.sub(r"\s+", " ", q).strip()
    if len(q) < 3:
        return None, "too_short"
    if len(q) > MAX_QUERY_CHARS:
        return None, "too_long"
    if _EMAIL.search(q) or _URL_CREDENTIALS.search(q):
        return None, "personal_data"
    if _UUID.search(q) or _SECRET.search(q) or any(_is_identifier(m.group()) for m in _LONG_DIGITS.finditer(q)):
        return None, "identifier_or_secret"
    folded = q.casefold()
    if any(t and t.casefold() in folded for t in forbidden_terms if len(t) >= 3):
        return None, "personal_data"
    for raw in _NUMBER.findall(q):
        if _YEAR.match(raw):
            continue
        value = float(raw.replace(",", "."))
        if any(abs(value - n) < 1e-6 for n in internal_numbers if abs(n) >= 10):
            return None, "internal_number"
    return q, None


# --- Higiene do que entra (resultados) --------------------------------------------------------------


def domain_of(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host.removeprefix("www.")


def clean_excerpt(text: str, limit: int) -> str:
    """Texto web seguro para o prompt: sem etiquetas, controlo nem frases que parecem instruções; com limite."""
    from novelo.features.copilot.security import looks_like_injection  # noqa: PLC0415

    plain = _TAGS.sub(" ", _INVISIBLE.sub("", unicodedata.normalize("NFKC", text or "")))
    plain = "".join(c for c in plain if c in "\n\t" or unicodedata.category(c) != "Cc")
    parts = re.split(r"(?<=[.!?\n])\s+", plain)
    kept = [p.strip() for p in parts if p.strip() and not looks_like_injection(p)]
    return re.sub(r"\s+", " ", " ".join(kept)).strip()[:limit]


def parse_citations(annotations: Any) -> list[WebCitation]:
    """`annotations` de uma mensagem ou delta do OpenRouter (`url_citation`) -> fontes limpas e sem repetições."""
    out: list[WebCitation] = []
    seen: set[str] = set()
    for item in annotations if isinstance(annotations, list) else []:
        if not isinstance(item, dict) or item.get("type") != "url_citation":
            continue
        raw = item.get("url_citation")
        if not isinstance(raw, dict):
            continue
        url = str(raw.get("url") or "").strip()
        if not re.match(r"^https?://", url, re.IGNORECASE) or url in seen or len(url) > 500:
            continue
        seen.add(url)
        domain = domain_of(url)
        title = clean_excerpt(str(raw.get("title") or ""), 140) or domain
        out.append(
            WebCitation(
                url=url,
                title=title,
                domain=domain,
                content=clean_excerpt(str(raw.get("content") or ""), EXCERPT_CHARS_MODEL),
            )
        )
        if len(out) >= MAX_CITATIONS:
            break
    return out


def short_excerpt(text: str) -> str:
    return text[:EXCERPT_CHARS_UI].rstrip() + ("…" if len(text) > EXCERPT_CHARS_UI else "")


def user_urls(text: str) -> list[str]:
    """Links https que o utilizador escreveu (a leitura de páginas só se oferece com um deles)."""
    return [u.rstrip(".,;)") for u in re.findall(r"https://[^\s<>\"']+", text)][:3]
