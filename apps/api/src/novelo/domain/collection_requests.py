"""As regras do pedido de recolha: morada, limites de sacos, corte de 48 h, ausências e retenção.

Matemática pura — sem FastAPI, sem SQLAlchemy, sem I/O. A entidade é única para cidadão e local/B2B
(decisão da spec #54): as regras são as mesmas, mudando o teto de sacos e a morada.

Decisões documentadas (ver também `docs/engenharia/dados-e-modelo.md`):

- **Morada normalizada** — a chave de «1 ativo por morada» é lexical: minúsculas, sem acentos, sem
  pontuação, espaços colapsados e indicadores ordinais (º ª °) retirados. Não é geocodificação nem
  expande abreviações (Av. ≠ Avenida): a mesma morada escrita de outra forma dá a mesma chave, mas
  duas formas distintas da mesma rua dão chaves distintas — o gestor vê as exceções na fila de despacho.
  O local/B2B não escreve morada: a chave institucional é `localidade:<uuid>` (espaço de nomes à parte;
  uma morada normalizada nunca contém «:»).
- **Limites de sacos** — cidadão 1–5; local 1–20 (teto B2B, **estimativa**). Acima do teto não é erro:
  é **recolha especial** e cai na fila de exceções do gestor.
- **Corte de 48 h** — aplicado à data (a recolha só tem dia, não hora): a data pedida tem de ser, pelo
  menos, hoje + 2 dias. Um pedido feito segunda-feira marca quarta-feira o mais cedo.
- **Ausências** — a visita que não encontra o saco conta como ausência; à 3.ª o pedido expira.
- **Retenção da morada** — 12 meses (mesma categoria RGPD dos logs de magic link, ADR da conta de
  doador): a morada vive só ligada ao pedido, nunca no perfil da conta; passado o prazo é purgada à
  leitura (`address` e `address_key` a nulo, o pedido fica para o histórico e os agregados).
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Final
from uuid import UUID

from novelo.domain.vocab import CollectionRequestState, RequestExceptionReason, RequestOutcome, RequestSubject

CITIZEN_BAG_MIN: Final = 1
CITIZEN_BAG_MAX: Final = 5  # 1–5 sacos por pedido de cidadão (decisão da spec #54)
LOCAL_BAG_MIN: Final = 1
LOCAL_BAG_MAX: Final = 20  # teto B2B — estimativa; acima é recolha especial
SPECIAL_VOLUME_ABOVE: Final = LOCAL_BAG_MAX
# O local pode pedir acima do teto (cai na fila de exceções); 500 é só o travão de sanidade do campo.
LOCAL_BAG_HARD_MAX: Final = 500
CUTOFF_DAYS: Final = 2  # corte de 48 h aplicado à data: dois dias completos de margem
MAX_ABSENCES: Final = 3  # expira à 3.ª ausência
ADDRESS_RETENTION_MONTHS: Final = 12  # morada retida 12 meses (categoria RGPD; ADR da conta de doador)

# Indicadores ordinais saem antes do NFKD: assim «nº» e «n.º» colapsam ambos para «n».
_ORDINALS = str.maketrans("", "", "ºª°")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_address(raw: str) -> str:
    """A chave lexical da morada: minúsculas, sem acentos, sem pontuação, ordinais fora, espaços colapsados.

    Letras e dígitos em contacto separam-se («nº42» → «n 42») para «nº 42» e «n.º 42» baterem certo.
    """
    text = raw.translate(_ORDINALS)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.casefold()
    text = re.sub(r"(?<=[a-z])(?=[0-9])|(?<=[0-9])(?=[a-z])", " ", text)
    return _NON_ALNUM.sub(" ", text).strip()


def locality_address_key(locality_id: UUID) -> str:
    """A chave de morada institucional do local/B2B: deriva do sítio, nunca de morada escrita."""
    return f"localidade:{locality_id}"


def bag_limits(subject: RequestSubject) -> tuple[int, int]:
    """(mínimo, máximo) de sacos que auto-aceitam: cidadão 1–5; local 1–20 (teto B2B, estimativa).

    Acima do máximo do local o pedido continua válido — é recolha especial (`is_special_volume`).
    """
    return (CITIZEN_BAG_MIN, CITIZEN_BAG_MAX) if subject is RequestSubject.CITIZEN else (LOCAL_BAG_MIN, LOCAL_BAG_MAX)


def hard_bag_max(subject: RequestSubject) -> int:
    """O limite de validação do sujeito: acima disto é 422, não exceção (cidadão 5; local 500)."""
    return CITIZEN_BAG_MAX if subject is RequestSubject.CITIZEN else LOCAL_BAG_HARD_MAX


def bags_out_of_range(subject: RequestSubject, bag_count: int) -> bool:
    """Fora do que o campo aceita (mínimo do sujeito … limite de validação). Acima do teto do local conta."""
    low = bag_limits(subject)[0]
    return not (low <= bag_count <= hard_bag_max(subject))


def is_special_volume(bag_count: int) -> bool:
    """Acima do teto de 20 sacos (local/B2B): recolha especial, despachada pelo gestor."""
    return bag_count > SPECIAL_VOLUME_ABOVE


def passes_cutoff(requested_date: date, today: date) -> bool:
    """O corte de 48 h à data: a recolha tem de ser, pelo menos, hoje + 2 dias."""
    return requested_date >= today + timedelta(days=CUTOFF_DAYS)


@dataclass(frozen=True, slots=True)
class Decision:
    """O resultado das regras de auto-aceite: agendado, ou exceção com o motivo (precedência fixa)."""

    state: CollectionRequestState
    exception_reason: RequestExceptionReason | None


def decide(
    *,
    subject: RequestSubject,
    bag_count: int,
    requested_date: date,
    today: date,
    urgent: bool,
    in_round: bool,
) -> Decision:
    """As regras de auto-aceite, por ordem de precedência: urgência > volume especial > corte > ronda.

    A urgência domina porque o gestor tem de a ver como urgência, mesmo que também esteja fora de
    ronda ou fora do prazo. `bag_count` fora do limite de validação do sujeito levanta `ValueError` —
    os limites validam-se antes (a API devolve 422; o domínio não deixa passar o que não devia chegar).
    """
    low, high = bag_limits(subject)
    if not (low <= bag_count <= hard_bag_max(subject)):
        raise ValueError(f"bag_count out of range: {bag_count}")
    if urgent:
        return Decision(CollectionRequestState.EXCEPTION, RequestExceptionReason.URGENCY)
    if is_special_volume(bag_count):
        return Decision(CollectionRequestState.EXCEPTION, RequestExceptionReason.SPECIAL_VOLUME)
    if not passes_cutoff(requested_date, today):
        return Decision(CollectionRequestState.EXCEPTION, RequestExceptionReason.CUTOFF)
    if not in_round:
        return Decision(CollectionRequestState.EXCEPTION, RequestExceptionReason.OUT_OF_ROUND)
    return Decision(CollectionRequestState.SCHEDULED, None)


@dataclass(frozen=True, slots=True)
class OutcomeResult:
    """O pedido depois da visita: o novo estado e o total de ausências acumuladas."""

    state: CollectionRequestState
    missed_count: int


def apply_outcome(state: CollectionRequestState, missed_count: int, outcome: RequestOutcome) -> OutcomeResult:
    """Aplica o resultado da visita. Só um pedido `scheduled` a recebe; a 3.ª ausência expira.

    Recolhido fecha o pedido (as ausências anteriores ficam contadas, para o histórico). Outros
    estados levantam `ValueError` — a API mapeia para 409.
    """
    if state is not CollectionRequestState.SCHEDULED:
        raise ValueError(f"outcome only applies to scheduled requests, got {state}")
    if outcome is RequestOutcome.COLLECTED:
        return OutcomeResult(CollectionRequestState.COLLECTED, missed_count)
    count = missed_count + 1
    if count >= MAX_ABSENCES:
        return OutcomeResult(CollectionRequestState.EXPIRED, count)
    return OutcomeResult(CollectionRequestState.SCHEDULED, count)


def address_retained_until(created_at: datetime) -> datetime:
    """A morada retém-se 12 meses de calendário (29 de fevereiro aperta para 28; a hora mantém-se)."""
    year = created_at.year + ADDRESS_RETENTION_MONTHS // 12
    month = created_at.month + ADDRESS_RETENTION_MONTHS % 12
    while month > 12:
        month -= 12
        year += 1
    day = created_at.day
    while True:
        try:
            return created_at.replace(year=year, month=month, day=day)
        except ValueError:
            day -= 1  # ex.: 29 de fevereiro em ano não bissexto
