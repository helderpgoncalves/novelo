"""Ecrãs do web que o copiloto conhece: rota, nome nas duas línguas e se exigem administrador.

É a lista fechada que o servidor usa para menções a ecrãs e para a linha de contexto da página: a rota que o
cliente envia só é reconhecida se estiver aqui (sem texto livre do cliente no prompt).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Page:
    key: str
    pt: str
    en: str
    route: str  # padrão TanStack (com $param)
    icon: str
    admin_only: bool = False

    def label(self, locale: str) -> str:
        return self.en if locale == "en" else self.pt


PAGES: tuple[Page, ...] = (
    Page("home", "Início", "Home", "/", "home"),
    Page("simulator", "Simulador", "Simulator", "/simulator", "sliders-horizontal"),
    Page("scenarios", "Cenários", "Scenarios", "/scenarios", "layers"),
    Page("scenario", "Cenário", "Scenario", "/scenarios/$scenarioId", "layers"),
    Page("compare", "Comparar cenários", "Compare scenarios", "/scenarios/compare", "columns-2"),
    Page("assumptions", "Pressupostos", "Assumptions", "/assumptions", "list-checks"),
    Page("pilot", "Piloto", "Pilot", "/pilot", "flag"),
    Page("map", "Mapa", "Map", "/map", "map"),
    Page("municipal", "Rede municipal", "Municipal network", "/municipal", "network"),
    Page("validation", "Validação", "Validation", "/validation", "badge-check"),
    Page("circuits", "Circuitos", "Circuits", "/circuits", "route"),
    Page("fleet", "Frota", "Fleet", "/fleet", "truck"),
    Page("localities", "Localidades", "Localities", "/localities", "map-pin"),
    Page("data_quality", "Qualidade dos dados", "Data quality", "/data-quality", "shield-check"),
    Page("lots", "Lotes", "Lots", "/lots", "package"),
    Page("lot", "Lote", "Lot", "/lots/$code", "package"),
    Page("triage", "Triagem", "Sorting", "/triage", "scan"),
    Page("reports", "Relatórios", "Reports", "/reports", "file-text"),
    Page("account", "Conta", "Account", "/account", "user"),
    Page("users", "Utilizadores", "Users", "/users", "users", admin_only=True),
    Page("admin_ai", "Gestão de IA", "AI management", "/admin/ai", "bot", admin_only=True),
)
BY_KEY = {p.key: p for p in PAGES}
BY_ROUTE = {p.route: p for p in PAGES}


def page_for_route(route: str) -> Page | None:
    return BY_ROUTE.get(route.rstrip("/") or "/")
