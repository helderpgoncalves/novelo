"""Pesquisa na web do copiloto: política (quem pode), estado de um pedido e comando `/websearch`.

Service sem FastAPI. O que vem da web é dado não confiável e «fonte externa»: guarda-se à parte dos factos do Novelo
(`excerpts`) e só o verificador o usa, para reconhecer números citados com rótulo. Nunca entra em contas nem KPIs.
"""

import datetime as dt
import re
from dataclasses import dataclass, field
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from novelo.ai.web import EXCERPT_CHARS_MODEL, WebCitation, clean_excerpt, short_excerpt
from novelo.core.config import Settings, get_settings
from novelo.features.copilot.schemas import CopilotSource, CopilotWebSearchEvent, WebSearchReason, WebSearchState
from novelo.features.copilot.schemas_memory import CopilotSettings
from novelo.features.users.models import User

WEB_UNAVAILABLE_TEXT = {
    "pt-PT": "Nota: a pesquisa na web não está disponível neste momento; respondi só com os dados do Novelo.",
    "en": "Note: web search is not available right now; I answered with Novelo data only.",
}
WEBSEARCH_REPLY = {
    "pt-PT": {
        "on": "Pesquisa na web ligada: pesquiso só quando o assunto é externo ao Novelo (legislação, benchmarks, preços) e cito sempre a fonte.",
        "off": "Pesquisa na web desligada: respondo só com os dados do Novelo.",
        "status_on": "A pesquisa na web está ligada. Usa «/websearch off» para a desligar.",
        "status_off": "A pesquisa na web está desligada. Usa «/websearch on» para a ligar.",
        "disabled_by_system": "A pesquisa na web não está disponível neste sistema.",
        "region": "A pesquisa na web não está disponível nesta região.",
        "guest": "A pesquisa na web não está disponível para convidados.",
        "usage": "Usa «/websearch on» ou «/websearch off».",
    },
    "en": {
        "on": "Web search is on: I search only when the topic is outside Novelo (law, benchmarks, prices) and always cite the source.",
        "off": "Web search is off: I answer with Novelo data only.",
        "status_on": "Web search is on. Use «/websearch off» to turn it off.",
        "status_off": "Web search is off. Use «/websearch on» to turn it on.",
        "disabled_by_system": "Web search is not available on this system.",
        "region": "Web search is not available in this region.",
        "guest": "Web search is not available for guests.",
        "usage": "Use «/websearch on» or «/websearch off».",
    },
}
_COMMAND = re.compile(r"^/websearch(?:\s+(on|off|auto|ligar|desligar))?\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class WebPolicy:
    """Pode o copiloto pesquisar na web neste pedido? (sistema, região, papel e preferência do utilizador)."""

    search: bool
    reason: WebSearchReason | None = None


def policy_for(user: User, settings: CopilotSettings, cfg: Settings | None = None) -> WebPolicy:
    cfg = cfg or get_settings()
    if not cfg.web_search_enabled:
        return WebPolicy(False, "disabled_by_system")
    if not cfg.web_region_supported:
        return WebPolicy(False, "region")
    if user.role == "guest" and not cfg.web_search_guests:
        return WebPolicy(False, "guest")
    if settings.web_search == "off":
        return WebPolicy(False, "disabled_by_user")
    return WebPolicy(True)


def parse_command(text: str) -> tuple[bool, str | None]:
    """(é o comando `/websearch`, valor pedido: «auto», «off» ou nada)."""
    m = _COMMAND.match(text.strip())
    if m is None:
        return (text.strip().lower().startswith("/websearch"), None)
    arg = (m.group(1) or "").lower()
    return True, {"on": "auto", "ligar": "auto", "auto": "auto", "off": "off", "desligar": "off"}.get(arg)


def today_line(cfg: Settings | None = None, now: dt.datetime | None = None) -> tuple[str, dict[str, object]]:
    """Data de hoje no fuso configurado: linha para o `[context]` e os factos que o verificador aceita (ano, mês, dia...)."""
    cfg = cfg or get_settings()
    try:
        tz = ZoneInfo(cfg.server_tools_timezone)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    moment = (now or dt.datetime.now(tz)).astimezone(tz)
    quarter = (moment.month - 1) // 3 + 1
    line = f"today: {moment.date().isoformat()} ({moment:%A}, timezone {tz.key}; quarter Q{quarter})"
    facts: dict[str, object] = {
        "today_year": moment.year,
        "today_month": moment.month,
        "today_day": moment.day,
        "today_quarter": quarter,
        "next_year": moment.year + 1,
        "previous_year": moment.year - 1,
    }
    return line, facts


@dataclass
class WebSession:
    """Estado da pesquisa web de UM pedido do utilizador."""

    policy: WebPolicy
    max_calls: int
    calls: int = 0
    requests: int = 0
    citations: list[WebCitation] = field(default_factory=list)
    unavailable: bool = False  # o fornecedor recusou a pesquisa neste pedido: a resposta avisa

    def add(self, citations: list[WebCitation]) -> None:
        """Guarda fontes novas, sempre limpas (defesa em profundidade: o adaptador já as limpou uma vez)."""
        known = {c.url for c in self.citations}
        for c in citations:
            if c.url not in known:
                known.add(c.url)
                self.citations.append(
                    WebCitation(
                        c.url,
                        clean_excerpt(c.title, 140) or c.domain,
                        c.domain,
                        clean_excerpt(c.content, EXCERPT_CHARS_MODEL),
                    )
                )

    @property
    def excerpts(self) -> list[str]:
        """Texto das fontes web para o verificador (nunca para os factos do Novelo)."""
        return [f"{c.title}. {c.content}" for c in self.citations]

    def sources(self) -> list[CopilotSource]:
        return [
            CopilotSource(
                kind="web",
                label=c.title,
                ref=c.url,
                domain=c.domain,
                excerpt=short_excerpt(c.content) or None,
                external=True,
            )
            for c in self.citations
        ]

    def for_model(self, citations: list[WebCitation]) -> list[dict[str, object]]:
        return [
            {
                "n": i,
                "title": c.title,
                "url": c.url,
                "domain": c.domain,
                "excerpt": c.content[:EXCERPT_CHARS_MODEL],
            }
            for i, c in enumerate(citations, start=1)
        ]


def event(
    state: WebSearchState,
    *,
    query: str | None = None,
    results: int = 0,
    requests: int = 0,
    reason: WebSearchReason | None = None,
) -> CopilotWebSearchEvent:
    return CopilotWebSearchEvent(
        state=state,
        query=query,
        results=results,
        requests=requests,
        reason=reason,
    )
