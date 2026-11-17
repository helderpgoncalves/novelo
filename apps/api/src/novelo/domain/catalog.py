"""Catálogo e resgate (#65): tipos fechados e o teto de donativos indexado ao custo evitado.

Puro: nada de I/O, nada de SQLAlchemy. O teto de donativos (ADR «economia dos pontos») liga o
incentivo à poupança real: o valor-euro **doado a IPSS** num mês, por conta, nunca passa de
`cap_pct` % do custo evitado de aterro da têxtil que a conta já fez **pesar na balança** da viatura
(105,64 €/t — 40 € de TGR + 65,64 € de tarifa Resinorte; fonte «docs/engenharia/dados-e-modelo.md»,
Vitrus 22 out 2026). A âncora **1 000 pontos ≈ 5 €** é SEMPRE apresentação do valor do *donativo* —
nunca câmbio de pontos para euros (pontos não são dinheiro).

Modelo do teto: `measured_grams` são os quilos MEDIDOS de todos os sacos da conta (vida toda — o
crédito é por saco ao longo da vida; a expiração dos pontos não apaga o que foi desviado), e a
janela de contagem do valor doado é o mês de calendário. Conta sem quilos medidos não financia
donativos (pode continuar a resgatar prémios de parceiro e acumulado ambiental, que não custam €
ao município — os parceiros pagam os prémios).
"""

from enum import StrEnum

# Custo evitado de aterro, em cêntimos por tonelada: 105,64 €/t (fonte acima, obrigatória na regra zero).
AVOIDED_TREATMENT_EUR_CENTS_PER_T = 10_564
# Fração do custo evitado que financia donativos (pressuposto: 100% — o incentivo nunca custa mais
# que a poupança; configurável por ambiente em `core/config.py` como `POINTS_DONATION_CAP_PCT`).
DONATION_CAP_PCT = 100

# Divisor inteiro: grams × cents_per_t × pct // (100 % → ×100) // (g → t → ×1_000_000).
_DENOMINATOR = 100 * 1_000_000


def donation_cap_cents(measured_grams: int, *, cap_pct: int = DONATION_CAP_PCT) -> int:
    """Teto mensal do valor-euro de donativos a IPSS da conta, em cêntimos (arredondado por defeito).

    `floor(gramas × 105,64 €/t × pct% )` em aritmética inteira — nunca há ponto flutuante em dinheiro.
    Peso negativo não existe (CHECK na base); por defesa, também aqui vale 0. `cap_pct = 0` desliga o
    financiamento de donativos.
    """
    if measured_grams <= 0 or cap_pct <= 0:
        return 0
    return (measured_grams * AVOIDED_TREATMENT_EUR_CENTS_PER_T * cap_pct) // _DENOMINATOR


class CatalogItemKind(StrEnum):
    """As três prateleiras do catálogo (espec #54): o valor guardado na base é a string inglesa.

    Só o donativo IPSS tem âncora € (`donation_value_cents`) — e é APRESENTAÇÃO do valor do donativo
    (1 000 pontos ≈ 5 €), nunca câmbio. Prémios de parceiro são cedidos e PAGOS pelo parceiro
    (pagamento integral por código apresentado); o acumulado ambiental é conquista não monetária.
    """

    IPSS_DONATION = "ipss_donation"
    PARTNER_PRIZE = "partner_prize"
    ENVIRONMENTAL = "environmental"


class PartnerState(StrEnum):
    """Vida de um parceiro: a freguesia PROPÕE, a Vitrus APROVA (e pode pôr em pausa)."""

    PROPOSED = "proposed"  # proposto por uma freguesia; à espera de aprovação da Vitrus
    ACTIVE = "active"  # aprovado: pode ter prémios no catálogo e validar códigos apresentados
    INACTIVE = "inactive"  # pausa ou saída: os itens deixam de se poder resgatar


class RedemptionState(StrEnum):
    """Estado do código de resgate: nasce pendente e valida-se UMA única vez (pagamento integral)."""

    PENDING = "pending"  # código gerado, à espera de ser apresentado ao parceiro/IPSS
    VALIDATED = "validated"  # apresentado e validado: entregue e pago — nunca valida outra vez


__all__ = [
    "AVOIDED_TREATMENT_EUR_CENTS_PER_T",
    "DONATION_CAP_PCT",
    "CatalogItemKind",
    "PartnerState",
    "RedemptionState",
    "donation_cap_cents",
]
