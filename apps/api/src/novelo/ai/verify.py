"""Verificador de números: o modelo escreve a explicação, mas só pode usar números que o otimizador produziu."""

import re
from dataclasses import dataclass
from typing import Any

_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
_GROUPING = re.compile(r"(?<=\d)[   ](?=\d{3}\b)")


def _normalise(text: str) -> str:
    return _GROUPING.sub("", text)


def numbers_in(text: str) -> set[float]:
    """Todos os números de um texto, em float (aceita vírgula ou ponto decimal e separador de milhares)."""
    return {round(float(n.replace(",", ".")), 4) for n in _NUMBER.findall(_normalise(text))}


def flatten(facts: Any) -> list[str]:
    if isinstance(facts, dict):
        return [s for v in facts.values() for s in flatten(v)]
    if isinstance(facts, list):
        return [s for v in facts for s in flatten(v)]
    return [str(facts)]


def unsupported_numbers(explanation: str, facts: Any) -> set[float]:
    """Números da explicação que não existem nos factos. Vazio = verificada."""
    allowed: set[float] = set()
    for chunk in flatten(facts):
        allowed |= numbers_in(chunk)
    return numbers_in(explanation) - allowed


# "1,234.56" (inglês), "1.234,56" (português antigo), "1.234", "1,5"; "P90", "Q3" ou "v2" não são números de dados
_NUMBER_TOKEN = re.compile(
    r"(?<![A-Za-z_\d])(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)"
)
_LIST_MARKER = re.compile(r"^[ \t]*\d{1,2}[.)](?=\s)", re.MULTILINE)  # "1. item" de uma lista numerada
_URL = re.compile(r"https?://[^\s)\]>]+", re.IGNORECASE)  # os dígitos de um endereço não são afirmações
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def fact_numbers(facts: Any) -> set[float]:
    """Todos os números verdadeiros de uma estrutura de factos: valores numéricos e números em textos.

    Ignora identificadores (UUID, datas ISO e chaves `id`/`*_id`), cujos dígitos não são factos.
    """
    out: set[float] = set()
    if isinstance(facts, dict):
        for key, value in facts.items():
            if str(key) == "id" or str(key).endswith("_id"):
                continue
            out |= fact_numbers(value)
    elif isinstance(facts, (list, tuple, set)):
        for value in facts:
            out |= fact_numbers(value)
    elif isinstance(facts, bool) or facts is None:
        pass
    elif isinstance(facts, (int, float)):
        out.add(round(float(facts), 6))
    elif isinstance(facts, str) and not _UUID.match(facts) and not _ISO_DATE.match(facts):
        out |= numbers_in(facts)
    return out


def unsupported_rounded(text: str, facts: Any, also_allowed: str = "") -> set[float]:
    """Números do texto sem correspondência nos factos, com tolerância de arredondamento.

    Um número escrito com d casas decimais aceita-se se algum facto, arredondado a d casas, der o mesmo valor
    ("301,3" vem de 301,27; "11" vem de 11,47). `also_allowed` são textos cujos números o utilizador já escreveu.
    """
    allowed = fact_numbers(facts) | numbers_in(also_allowed)
    allowed |= {abs(x) for x in allowed}  # "1,92 t a menos" vem de uma diferença de -1,92 calculada pela ferramenta
    bad: set[float] = set()
    for match in _NUMBER_TOKEN.finditer(_LIST_MARKER.sub("", _URL.sub(" ", _normalise(text)))):
        options = _readings(match.group(0))
        if not any(abs(f - value) <= half for f in allowed for value, half in options):
            bad.add(round(options[0][0], 4))
    return bad


def _readings(token: str) -> list[tuple[float, float]]:
    """Leituras possíveis de um número escrito: (valor, tolerância). Vírgula e ponto podem ser decimais ou milhares."""
    if "," in token and "." in token:  # o último separador é o decimal
        decimal = "," if token.rfind(",") > token.rfind(".") else "."
        thousands = "." if decimal == "," else ","
        clean = token.replace(thousands, "").replace(decimal, ".")
        return [(float(clean), 0.5 * 10 ** -len(token.rsplit(decimal, 1)[1]) + 1e-9)]
    groups = re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", token)
    decimals = len(re.split(r"[.,]", token)[1]) if re.search(r"[.,]", token) else 0
    as_decimal = (
        float(token.replace(",", ".")) if not groups or token.count(",") + token.count(".") == 1 else float("nan"),
        0.5 * 10**-decimals + 1e-9,
    )
    if groups:  # "37.198" ou "37,198": também se lê como 37 198 (arredondado ou truncado)
        integer = (float(re.sub(r"[.,]", "", token)), 1.0 + 1e-9)
        return [integer] if as_decimal[0] != as_decimal[0] else [as_decimal, integer]
    return [as_decimal]


# --- Números de fontes web ------------------------------------------------------------------------------------
# Um número que só existe num excerto de uma página web (e não nos dados do Novelo) pode ser citado, mas tem de vir
# rotulado como «fonte externa» e nunca entra em contas nem KPIs. Um número inventado não está em lado nenhum.

_EXTERNAL_LABEL = re.compile(
    r"fontes? externas?|external sources?|source:\s|fonte:\s|segundo\s|de acordo com|according to|\]\(https?://|https?://",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class NumberCheck:
    unsupported: set[float]  # sem origem nos dados do Novelo nem nos excertos web
    external: set[float]  # só existem em excertos web desta volta (aceites se o texto os rotular)


def has_external_label(text: str) -> bool:
    return bool(_EXTERNAL_LABEL.search(text))


def check_numbers(text: str, facts: Any, external: list[str], also_allowed: str = "") -> NumberCheck:
    """Separa os números sem origem dos que só vêm de excertos web.

    `facts` são os dados do Novelo (ferramentas, ecrã, menções); `external` são os excertos das citações web do turno.
    Os números externos só se aceitam se o texto os rotular («fonte externa», ligação); senão ficam não suportados.
    """
    internal_bad = unsupported_rounded(text, facts, also_allowed)
    if not internal_bad or not external:
        return NumberCheck(internal_bad, set())
    still_bad = unsupported_rounded(text, [facts, external], also_allowed)
    found = internal_bad - still_bad
    if found and not has_external_label(text):
        return NumberCheck(internal_bad, set())
    return NumberCheck(still_bad, found)
