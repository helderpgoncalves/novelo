"""Política de paragem: a escada discreta de frequências e a agenda pública. Funções puras, sem I/O.

ADR «Política de paragem» (#42) e ADR «Captura anual é derivada» (#53):

  visitas por ano do degrau   v_r = 52 ÷ semanas do degrau      (semanal 52, quinzenal 26, mensal 13, trimestral 4)
  captura ao degrau           c_r = min(1, c · v_r ÷ 26)        (o prior de captura vale ao degrau QUINZENAL)

Sem aviso, o otimizador escolhe o degrau de cada freguesia na escada: mais frequência capta mais (a taxa × o
degrau, limitada pela procura na união de canais) mas custa mais rondas ao estaleiro; menos frequência poupa
paragens onde há menos procura. O aviso «sacos prontos» garante paragem à parte da escada (constraint dura no
MIP, fora daqui). Os DEGRAUS são pressupostos com fonte em docs/engenharia/dados-e-modelo.md (prática da
Vitrus, a confirmar): semanal, quinzenal, mensal (4 semanas) e trimestral (13 semanas).

A agenda pública é dado introduzido: deriva-se do plano escolhido, e nenhuma visita publicada é saltada —
quem publica conta com a visita (ADR: a agenda pública é uma promessa do serviço municipal).
"""

from collections.abc import Sequence
from dataclasses import dataclass

from novelo.domain.vocab import CollectionFrequency

# Degraus da escada, do mais frequente ao mais raro, em semanas entre visitas (PRESSUPOSTO com fonte em
# dados-e-modelo.md: prática da Vitrus a confirmar; o mensal é 4 semanas, o trimestral 13).
RUNG_WEEKS: dict[CollectionFrequency, int] = {
    CollectionFrequency.WEEKLY: 1,
    CollectionFrequency.BIWEEKLY: 2,
    CollectionFrequency.MONTHLY: 4,
    CollectionFrequency.QUARTERLY: 13,
}
LADDER: tuple[CollectionFrequency, ...] = tuple(RUNG_WEEKS)

# Ancoragem da captura: o prior de captura do modo (c) vale ao degrau quinzenal (26 visitas por ano, a
# omissão de hoje). Outros degraus escalam linearmente (taxa × degrau), limitada a 1.
ANCHOR_VISITS_PER_YEAR = 52 / RUNG_WEEKS[CollectionFrequency.BIWEEKLY]


def weeks_of(rung: CollectionFrequency) -> int:
    """Semanas entre visitas do degrau."""
    return RUNG_WEEKS[rung]


def visits_per_year(rung: CollectionFrequency) -> float:
    """Visitas por ano do degrau: 52 ÷ semanas (semanal 52, quinzenal 26, mensal 13, trimestral 4)."""
    return 52 / RUNG_WEEKS[rung]


def rung_of_weeks(weeks: float) -> CollectionFrequency | None:
    """O degrau com exatamente `weeks` semanas entre visitas; None fora da escada (ex.: 3 semanas)."""
    for rung, w in RUNG_WEEKS.items():
        if abs(w - weeks) < 1e-9:
            return rung
    return None


def rung_capture(capture: float, visits: float) -> float:
    """Captura ao ritmo de `visits` visitas por ano: o prior `capture` vale ao degrau quinzenal (26/ano).

    Taxa × degrau (ADR «Captura anual é derivada»), limitada a 1: a união de canais limita sempre à
    procura da freguesia. À quinzenal pura devolve `capture` intacto (cenários fixos de hoje ficam iguais).
    """
    if capture < 0 or visits <= 0:
        raise ValueError("captura não negativa e visitas positivas")
    return min(1.0, capture * visits / ANCHOR_VISITS_PER_YEAR)


@dataclass(frozen=True)
class PublishedVisit:
    """Uma ronda publicada na agenda: freguesia, canal, dia e cadência (a promessa ao cidadão)."""

    parish_code: str
    parish_name: str
    channel: str  # valor de `CollectionMode`
    weekday: int | None  # 1 = segunda ... 5 = sexta; None = sem slot (não publica)
    every_weeks: float
    rounds_year: float
    frequency: CollectionFrequency | None = None  # o degrau escolhido; None na política fixa


def public_agenda(visits: Sequence[PublishedVisit]) -> list[PublishedVisit]:
    """A agenda pública: só as rondas publicadas (com dia e cadência), por dia, freguesia e canal.

    Dado introduzido, derivado do plano escolhido — nunca reagenda nem salta: cada linha daqui é uma
    visita que o serviço municipal promete fazer (ADR: visita publicada nunca é saltada).
    """
    published = [v for v in visits if v.weekday is not None and v.every_weeks > 0]
    return sorted(published, key=lambda v: (v.weekday or 0, v.parish_code, v.channel))
