import pytest

from novelo.domain.fleet import (
    Job,
    Slot,
    annuity_eur,
    assign_weekdays,
    hours,
    hours_per_vehicle_year,
    rounds_per_year,
    tour_km,
    trips_per_round,
    vehicle_days_per_week,
    vehicles_needed,
)


def test_rounds_and_trips_by_hand() -> None:
    assert rounds_per_year(2) == 26.0  # a cada 2 semanas
    assert rounds_per_year(4) == 13.0
    assert trips_per_round(0.0, 2000) == 1  # uma ronda sai sempre, mesmo vazia
    assert trips_per_round(2000.0, 2000) == 1  # cheia à justa: 1 viagem
    assert trips_per_round(2000.1, 2000) == 2
    assert trips_per_round(4500.0, 2000) == 3
    with pytest.raises(ValueError):
        rounds_per_year(0)
    with pytest.raises(ValueError):
        trips_per_round(10.0, 0.0)


def test_tour_follows_beardwood_halton_hammersley() -> None:
    # 9 portas em 4 km²: 0,7124 · √36 = 4,2744 km em linha reta; · 1,3 = 5,55672 km de estrada
    assert tour_km(9, 4.0, 1.3) == pytest.approx(5.55672)
    assert tour_km(9, 4.0, 1.0) == pytest.approx(4.2744)
    assert tour_km(0, 4.0, 1.3) == 0.0
    assert tour_km(9, None, 1.3) == 0.0  # sem área: só a ida e volta conta
    with pytest.raises(ValueError):
        tour_km(-1, 4.0, 1.3)


def test_hours_and_fleet_size_by_hand() -> None:
    # 60 km a 30 km/h = 2 h; 30 paragens · 2 min = 1 h
    assert hours(60.0, 30.0, 30.0, 2.0) == pytest.approx(3.0)
    assert hours_per_vehicle_year(7.0) == 1820.0  # 7 h · 5 dias · 52 semanas
    assert vehicles_needed(0.0, 7.0) == 0
    assert vehicles_needed(1.0, 7.0) == 1
    assert vehicles_needed(1820.0, 7.0) == 1  # cheia à justa
    assert vehicles_needed(1820.5, 7.0) == 2
    # 910 h/ano ÷ 52 ÷ 7 h = 2,5 dias de viatura por semana
    assert vehicle_days_per_week(910.0, 7.0) == pytest.approx(2.5)
    assert annuity_eur(42_500, 8) == pytest.approx(5312.5)
    with pytest.raises(ValueError):
        annuity_eur(1.0, 0)


def test_weekdays_balance_the_hours_deterministically() -> None:
    # a (3 h) entra primeiro e fica na segunda; b e c (2 h) empatam: b (id) na terça, c na quarta; d na quinta, e na
    # sexta; f (1 h) vai para o dia mais leve: quinta e sexta empatam com 1 h, fica a quinta (dia mais cedo)
    jobs = [Job("c", 2), Job("b", 2), Job("a", 3), Job("d", 1), Job("e", 1), Job("f", 1)]
    out = assign_weekdays(jobs, vehicles=1)
    assert {k: v.weekday for k, v in out.items()} == {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 4}
    assert all(v.vehicle == 1 for v in out.values())
    # com duas viaturas a segunda viatura começa quando a primeira já tem carga no mesmo dia
    two = assign_weekdays([Job(str(i), 1) for i in range(6)], vehicles=2)
    assert two["5"] == Slot(2, 1)
    assert assign_weekdays(jobs, vehicles=0) == {}
