import pytest

from novelo.domain.door_to_door import Crewing, Pass, circuit_passes, day_group, weekdays_served


def test_day_groups_follow_the_shift_plan() -> None:
    assert [day_group(d) for d in range(1, 8)] == ["weekday"] * 5 + ["saturday", "sunday"]
    with pytest.raises(ValueError):
        day_group(0)


def test_passes_on_every_circuit_day_and_the_first_shift_wins() -> None:
    crewing = [
        Crewing("weekday", 1, "AA-00-AA", 2),  # tarde
        Crewing("weekday", 0, "ZZ-99-ZZ", 3),  # manhã: ganha
    ]
    # terça, quinta e sábado no circuito; sem viatura ao sábado na folha de turnos: o sábado conta na mesma (a folha
    # tem erros, Vitrus 22 out 2026), com a viatura nula
    assert circuit_passes("C7", [6, 2, 4, 4], crewing) == [
        Pass("C7", 2, "ZZ-99-ZZ", 3),
        Pass("C7", 4, "ZZ-99-ZZ", 3),
        Pass("C7", 6, None, None),
    ]
    assert circuit_passes("C8", [1, 3], []) == [Pass("C8", 1), Pass("C8", 3)]  # circuito sem viatura na folha


def test_weekdays_served_counts_distinct_days() -> None:
    # moloks C1 de segunda a domingo e PAP C7 à terça, quinta e sábado: 7 dias distintos, não 10 passagens
    molok = [Pass("C1", d) for d in range(1, 8)]
    pap = [Pass("C7", 2), Pass("C7", 4), Pass("C7", 6)]
    assert weekdays_served(molok + pap) == 7
    assert weekdays_served([*pap, Pass("C9", 1), Pass("C9", 3)]) == 5  # 2, 4, 6 + 1, 3
    assert weekdays_served([]) == 0
