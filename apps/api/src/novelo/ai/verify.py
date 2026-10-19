"""Verificador de números: o modelo escreve a explicação, mas só pode usar números que o otimizador produziu."""

import re
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


_DECIMALS = re.compile(r"\d+(?:[.,](\d+))?")
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
    ("301,3" vem de 301,27; "23" vem de 22,9). `also_allowed` são textos cujos números o utilizador já escreveu.
    """
    allowed = fact_numbers(facts) | numbers_in(also_allowed)
    bad: set[float] = set()
    for match in _DECIMALS.finditer(_normalise(text)):
        digits = len(match.group(1) or "")
        value = float(match.group(0).replace(",", "."))
        half_step = 0.5 * 10**-digits + 1e-9
        if not any(abs(f - value) <= half_step for f in allowed):
            bad.add(round(value, 4))
    return bad
