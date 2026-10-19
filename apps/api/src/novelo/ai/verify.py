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
