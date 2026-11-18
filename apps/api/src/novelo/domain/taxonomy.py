"""Taxonomia fechada e versionada da triagem (fonte dos eixos «estado fino, tipologia, estação, cor, género, tamanho»).

Versão explícita (`TAXONOMY_VERSION`): alterar valores ou acrescentar eixos é uma decisão visível —
nova versão aqui, migração (CHECKs das colunas enum), `just gen` e traduções no web. O bilhete #57
(lotes de escoamento) importa `EXPORT_KEY_AXES` daqui: a chave do lote é (estado, tipologia, estação, género);
cor e tamanho nunca entram na chave, ficam como filtros para responder a pedidos do comprador.

Os StrEnum guardam o valor em inglês na base de dados e no contrato; as traduções vivem no web
(`apps/web/src/lib/vocab.ts` + messages/*.json), como o resto de `domain/vocab.py`.
"""

from dataclasses import dataclass
from enum import StrEnum

from novelo.domain.vocab import TextileDestination

TAXONOMY_VERSION = 1


class FineState(StrEnum):
    """Estado fino: 4 graus de qualidade reutilizável + reciclar/rejeitar, mapeado nos 3 destinos.

    Os graus seguem a letra usada no comércio de roupa usada (A é a melhor); `recycle` e `reject`
    mantêm o significado dos 3 destinos que a plataforma já usa (`TextileDestination`).
    """

    GRADE_A = "grade_a"  # como nova: sem defeitos, aspeto de nova
    GRADE_B = "grade_b"  # muito boa: sinais ligeiros de uso
    GRADE_C = "grade_c"  # boa: sinais normais de uso, plenamente utilizável
    GRADE_D = "grade_d"  # suficiente: sinais visíveis, ainda utilizável
    RECYCLE = "recycle"  # gasta/danificada, mas o tecido serve como matéria-prima
    REJECT = "reject"  # suja, molhada, com bafio ou sem valor recuperável


DESTINATION_BY_FINE_STATE: dict[FineState, TextileDestination] = {
    FineState.GRADE_A: TextileDestination.REUSE,
    FineState.GRADE_B: TextileDestination.REUSE,
    FineState.GRADE_C: TextileDestination.REUSE,
    FineState.GRADE_D: TextileDestination.REUSE,
    FineState.RECYCLE: TextileDestination.RECYCLE,
    FineState.REJECT: TextileDestination.REJECT,
}


def destination_for(fine_state: FineState) -> TextileDestination:
    """Os 4 graus são reutilização; reciclar e rejeitar mantêm o destino."""
    return DESTINATION_BY_FINE_STATE[fine_state]


class Season(StrEnum):
    """Estação: quando faz sentido voltar a colocar a peça em uso (critério da Retex)."""

    ALL_SEASON = "all_season"  # todo o ano
    WARM = "warm"  # primavera/verão
    COLD = "cold"  # outono/inverno


class Colour(StrEnum):
    """Cor observada na peça (nunca entra na chave do lote de escoamento; só filtros)."""

    BLACK = "black"
    WHITE = "white"
    GREY = "grey"
    BEIGE = "beige"
    BROWN = "brown"
    RED = "red"
    ORANGE = "orange"
    YELLOW = "yellow"
    GREEN = "green"
    BLUE = "blue"
    PINK = "pink"
    MULTICOLOUR = "multicolour"  # estampados e misturas
    UNKNOWN = "unknown"  # foto escura ou ilegível


class Gender(StrEnum):
    """Género/segmento como o mercado compra (entra na chave do lote de escoamento)."""

    MEN = "men"  # homem
    WOMEN = "women"  # mulher
    KIDS = "kids"  # criança
    BABIES = "babies"  # bebé


class SizeBand(StrEnum):
    """Tamanho em bandas, lido SÓ da etiqueta. Nunca se deduz da foto.

    Bandas e não tamanhos exatos: as etiquetas variam (letras, P/M/G, numerais). Numerais
    («42», «98») ficam `unknown` — as tabelas EU de homem e de mulher conflituam e a função
    não inventa o mapeamento (regra zero); o operador, com a etiqueta à mão, escolhe a banda.
    """

    XS = "xs"
    S = "s"
    M = "m"
    L = "l"
    XL = "xl"
    XXL = "xxl"  # XXL e acima (3XL, 4XL…)
    UNKNOWN = "unknown"  # etiqueta ilegível, ausente, numérica ou «tamanho único»


class Provenance(StrEnum):
    """De onde vem o valor de um atributo: proposto pela IA e aceite, ou definido pelo operador."""

    CONFIRMED = "confirmed"  # valor definido pelo operador (a palavra final é humana)
    AI = "ai"  # proposto pela IA e aceite sem alteração


class TriageAxis(StrEnum):
    """Os seis eixos da taxonomia; o eval mede a IA em cada um."""

    FINE_STATE = "fine_state"  # estado
    GARMENT_TYPE = "garment_type"  # tipologia
    SEASON = "season"  # estação
    COLOUR = "colour"  # cor
    GENDER = "gender"  # género
    SIZE_BAND = "size_band"  # tamanho


# Chave do lote de escoamento (bilhete #57 importa isto): cor e tamanho ficam de fora.
EXPORT_KEY_AXES: tuple[TriageAxis, ...] = (
    TriageAxis.FINE_STATE,
    TriageAxis.GARMENT_TYPE,
    TriageAxis.SEASON,
    TriageAxis.GENDER,
)

# Eixos cuja exatidão da IA ainda não se dá por garantida: o eval marca-os «prometido»
# até a métrica aguentar (ver GENDER_SIZE_PROMISE_THRESHOLD em ai/eval_triage.py).
PROMISED_AXES: tuple[TriageAxis, ...] = (TriageAxis.GENDER, TriageAxis.SIZE_BAND)

# Etiquetas de letra → banda. Numerais, «one size» e texto ilegível não mapeiam (UNKNOWN).
_SIZE_LETTERS: dict[str, SizeBand] = {
    "XS": SizeBand.XS,
    "S": SizeBand.S,
    "P": SizeBand.S,  # pequeno
    "M": SizeBand.M,
    "L": SizeBand.L,
    "G": SizeBand.L,  # grande
    "XL": SizeBand.XL,
    "GG": SizeBand.XL,  # extra grande
    "XXL": SizeBand.XXL,
    "XG": SizeBand.XXL,
    "3XL": SizeBand.XXL,
    "4XL": SizeBand.XXL,
    "XXL+": SizeBand.XXL,
}
_ONE_SIZE = {"OS", "ONE SIZE", "TAMANHO UNICO", "TAMANHO UNICA", "UNICA", "UNIQUE SIZE"}


def size_band_from_label(raw: str | None) -> SizeBand:
    """Converte o tamanho escrito na etiqueta numa banda fechada; `unknown` quando não dá para mapear.

    Só letras de banda (XS–XXL, PT P/M/G/GG/XG, 3XL/4XL): o resto é `unknown`, nunca um palpite.
    """
    if not raw:
        return SizeBand.UNKNOWN
    text = raw.strip().upper()
    if text in _ONE_SIZE:
        return SizeBand.UNKNOWN
    return _SIZE_LETTERS.get(text, SizeBand.UNKNOWN)


# --- Proveniência e rótulos dourados -----------------------------------------------------------------


@dataclass(frozen=True)
class AttributeSource:
    """De onde veio o valor de um eixo e a confiança que lhe acompanha («confirmado» vale 1.0)."""

    axis: TriageAxis
    origin: Provenance
    confidence: float


def attribute_provenance(
    proposed: dict[TriageAxis, str | None],
    final: dict[TriageAxis, str | None],
    ai_confidence: float,
) -> dict[TriageAxis, AttributeSource]:
    """Selo por eixo: «IA» quando o operador aceitou o valor proposto, «confirmado» quando definiu o valor.

    A confiança guardada é a da proposta nos valores aceites e 1.0 nos definidos pelo operador.
    Eixos sem valor final (peças antigas, anteriores à taxonomia) não têm selo.
    """
    sources: dict[TriageAxis, AttributeSource] = {}
    for axis in TriageAxis:
        value = final.get(axis)
        if value is None:
            continue
        accepted = proposed.get(axis) == value and axis in proposed
        origin = Provenance.AI if accepted else Provenance.CONFIRMED
        sources[axis] = AttributeSource(axis, origin, ai_confidence if accepted else 1.0)
    return sources


def corrected_axes(
    proposed: dict[TriageAxis, str | None], final: dict[TriageAxis, str | None]
) -> list[tuple[TriageAxis, str, str]]:
    """Correções do operador a valores propostos pela IA: os rótulos dourados.

    Só conta quando há proposta E valor final diferente — sem proposta não há o que medir,
    e limpar um valor proposto não gera par (proposto, corrigido) comparável.
    """
    corrections: list[tuple[TriageAxis, str, str]] = []
    for axis in TriageAxis:
        ai_value = proposed.get(axis)
        operator_value = final.get(axis)
        if ai_value is not None and operator_value is not None and ai_value != operator_value:
            corrections.append((axis, ai_value, operator_value))
    return corrections
