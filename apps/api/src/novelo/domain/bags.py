"""Códigos do cidadão: o QR do saco ativado e o QR de conta (segundo portador, entrega mão a mão).

Puro: nada de I/O — a geração recebe o escolhedor para ser determinística nos testes. O alfabeto é o
dos lotes (sem 0/O/1/I/L): os códigos leem-se bem em etiquetas e QR impressos.

Modelo de confiança (ADR #35): o QR de conta é um **portador de crédito**, nunca uma credencial de
sessão — quem o mostra atribui a entrega à própria conta; o scan só etiqueta o lote com o código
pseudónimo. Com 32⁶ ≈ 1.1 mil milhões de combinações e limites de taxa na leitura, adivinhar um código
não é prático no MVP; rotação fica para #64/#66.
"""

from collections.abc import Callable, Sequence

# O mesmo alfabeto dos lotes (`features/lots/service.py`): sem 0/O/1/I/L.
ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

BAG_CODE_PREFIX = "NVL-"  # saco da plataforma ativado no app
ACCOUNT_CODE_PREFIX = "NVA-"  # QR de conta: entrega mão a mão, sem saco da plataforma
REDEMPTION_CODE_PREFIX = "RDM-"  # código de resgate (#65): o ÚNICO que o parceiro vê — zero dados
CODE_CHARS = 6

# Teto de sacos ativos por conta (estimativa, #63): um agregado familiar não precisa de mais;
# sem teto, gerar códigos em série era abuso trivial. Desativar não conta para o teto.
MAX_ACTIVE_BAGS = 10

type Chooser = Callable[[Sequence[str]], str]


def _new_code(prefix: str, chooser: Chooser) -> str:
    body = "".join(chooser(ALPHABET) for _ in range(CODE_CHARS))
    return f"{prefix}{body}"


def new_bag_code(rng: Chooser | None = None) -> str:
    """Código do saco ativado (`NVL-XXXXXX`): é o que a viatura lê no scan e entra em `lot_units.code`."""
    return _new_code(BAG_CODE_PREFIX, rng or _default())


def new_account_code(rng: Chooser | None = None) -> str:
    """Código pseudónimo da conta (`NVA-XXXXXX`): o payload do QR de conta, sem qualquer dado pessoal."""
    return _new_code(ACCOUNT_CODE_PREFIX, rng or _default())


def new_redemption_code(rng: Chooser | None = None) -> str:
    """Código de resgate pseudónimo (`RDM-XXXXXX`, #65): a ÚNICA coisa que o parceiro vê — nunca sabe
    quem trocou (ADR «resgate por código pseudónimo»); mesmo alfabeto dos sacos, legível em QR impresso."""
    return _new_code(REDEMPTION_CODE_PREFIX, rng or _default())


def _default() -> Chooser:
    import secrets  # noqa: PLC0415  (aleatoriedade criptográfica só no caminho real; testes injetam o escolhedor)

    return secrets.choice
