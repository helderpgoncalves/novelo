"""A fonte do peso do lote: o medido na paragem ganha sempre à estimativa das peças. Valores calculados à mão."""

from novelo.domain.vocab import LotWeightSource
from novelo.features.lots.service import lot_weight


def test_measured_weight_wins() -> None:
    # 4200 g + 3800 g = 8000 g = 8,0 kg medidos, mesmo com 600 g estimados nas peças.
    assert lot_weight(8000, 600) == (8.0, LotWeightSource.MEASURED)


def test_estimated_is_the_fallback() -> None:
    # Sem balança: 600 g estimados = 0,6 kg, e diz-se que é estimativa.
    assert lot_weight(None, 600) == (0.6, LotWeightSource.ESTIMATED)
    assert lot_weight(0, 600) == (0.6, LotWeightSource.ESTIMATED)  # zero pesado = ninguém passou pela balança
    assert lot_weight(None, None) == (0.0, LotWeightSource.ESTIMATED)


def test_rounding_to_grams() -> None:
    # 4300 g → 4,3 kg; 1234 g → 1,234 kg (três casas: o grama mantém-se).
    assert lot_weight(4300, None) == (4.3, LotWeightSource.MEASURED)
    assert lot_weight(1234, None) == (1.234, LotWeightSource.MEASURED)
