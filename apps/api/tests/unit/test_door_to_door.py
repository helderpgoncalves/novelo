import pytest

from novelo.domain.door_to_door import (
    Crewing,
    Pass,
    assign_days,
    circuit_passes,
    day_group,
    fits,
    kg_per_round,
    pickups_per_year,
    round_loads,
)


def test_day_groups_follow_the_shift_plan() -> None:
    assert [day_group(d) for d in range(1, 8)] == ["weekday"] * 5 + ["saturday", "sunday"]
    with pytest.raises(ValueError):
        day_group(0)


def test_round_and_pickups_by_hand() -> None:
    assert kg_per_round(5.2) == pytest.approx(100.0)  # 5,2 t × 1000 / 52 semanas
    assert pickups_per_year(1.0, 25.0) == pytest.approx(40.0)  # 1 000 kg / 25 kg
    with pytest.raises(ValueError):
        pickups_per_year(1.0, 0.0)
    with pytest.raises(ValueError):
        kg_per_round(-1.0)


def test_passes_only_on_days_with_a_vehicle_and_the_first_shift_wins() -> None:
    crewing = [
        Crewing("weekday", 1, "AA-00-AA", 2),  # tarde
        Crewing("weekday", 0, "ZZ-99-ZZ", 3),  # manhã: ganha
    ]
    # terça, quinta e sábado no circuito, mas sem viatura ao sábado: o sábado cai
    assert circuit_passes("C7", [6, 2, 4, 4], crewing) == [
        Pass("C7", 2, "ZZ-99-ZZ", 3),
        Pass("C7", 4, "ZZ-99-ZZ", 3),
    ]
    assert circuit_passes("C8", [1, 3, 5], []) == []  # circuito sem viatura no planeamento


def test_each_parish_takes_the_least_loaded_round() -> None:
    # A (10,4 t) entra primeiro e empata: fica com segunda (200 kg). B e C empatam em 5,2 t: B primeiro (código).
    # B: segunda já tem 200 kg, quarta 0 -> quarta (100 kg). C só tem segunda -> 200 + 100 = 300 kg.
    passes = {
        "A": [Pass("X", 3), Pass("X", 1)],
        "B": [Pass("X", 1), Pass("X", 3)],
        "C": [Pass("X", 1)],
        "D": [],
    }
    out = assign_days({"C": 5.2, "B": 5.2, "A": 10.4, "D": 1.0, "E": 2.0}, passes)
    assert [(a.zone_id, a.circuit, a.weekday) for a in out] == [("A", "X", 1), ("B", "X", 3), ("C", "X", 1)]
    assert out[0].kg_per_round == pytest.approx(200.0)
    assert round_loads(out) == {("X", 1): pytest.approx(300.0), ("X", 3): pytest.approx(100.0)}


def test_capacity_check_never_invents_a_free_capacity() -> None:
    assert fits(300, 250, 4000) is False
    assert fits(200, 250, 4000) is True
    assert fits(300, None, 4000) is None  # capacidade livre por validar: não se sabe
    assert fits(5000, None, 4000) is False  # acima da capacidade total da viatura não cabe de certeza
