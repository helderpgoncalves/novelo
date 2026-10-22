import pytest

from novelo.domain.reuse import EntityReuse, ReuseShares, reusable, reuse_shares


def test_shares_by_hand() -> None:
    entities = [
        EntityReuse("A", reuse_t=30, total_t=40, weighed=True),  # 75%
        EntityReuse("B", reuse_t=10, total_t=40, weighed=True),  # 25%
        EntityReuse("C", reuse_t=20, total_t=20, weighed=False),  # 100%, mas percentagens: fora do intervalo
    ]
    s = reuse_shares(entities)
    assert s is not None
    assert s.central == pytest.approx(0.6)  # (30 + 10 + 20) / 100
    assert s.low == pytest.approx(0.25) and s.high == pytest.approx(0.75)


def test_vitrus_2025_by_hand() -> None:
    # textile_flows.csv: Ultriplo 97,7223 / 134,1301 (pesado), Sarah 59,316 / 118,632 (pesado), Nova Etapa 21,4415 /
    # 42,883 e Vitrus 0,515 / 5,621 (percentagens). Central 178,9948 / 301,2661 = 59,41%; intervalo 50,0% a 72,86%.
    entities = [
        EntityReuse("Ultriplo", 97.7223, 134.1301, True),
        EntityReuse("H Sarah Trading", 59.316, 118.632, True),
        EntityReuse("Nova Etapa", 21.4415, 42.883, False),
        EntityReuse("Vitrus", 0.515, 5.621, False),
    ]
    s = reuse_shares(entities)
    assert s is not None
    assert s.central == pytest.approx(178.9948 / 301.2661)
    assert round(s.central * 100, 1) == 59.4
    assert s.low == pytest.approx(0.5) and round(s.high or 0, 4) == 0.7286


def test_no_weighed_entity_gives_no_range_and_nothing_collected_gives_none() -> None:
    s = reuse_shares([EntityReuse("X", 5, 10, weighed=False)])
    assert s == ReuseShares(central=0.5, low=None, high=None)
    assert reuse_shares([]) is None
    with pytest.raises(ValueError):
        reuse_shares([EntityReuse("X", 11, 10, weighed=True)])


def test_reusable_tonnes_and_cost_by_hand() -> None:
    r = reusable(200, 24_000, ReuseShares(0.6, 0.25, 0.75))
    assert r.tonnes == pytest.approx(120)  # 200 × 0,6
    assert r.tonnes_low == pytest.approx(50) and r.tonnes_high == pytest.approx(150)
    assert r.eur_per_tonne == pytest.approx(200)  # 24 000 / 120
    empty = reusable(0, 5_000, ReuseShares(0.6, None, None))
    assert empty.tonnes == 0 and empty.eur_per_tonne is None and empty.tonnes_low is None
